import mammoth from 'npm:mammoth';

export interface ParsedBrief {
  code: string | null;
  album: string | null;
  publisher: string | null;
  due_date: string | null;
  fee: string | null;
  file_naming: string | null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const SYSTEM_PROMPT = `You are a metadata extractor for music library briefs. Extract project metadata and return ONLY valid JSON with exactly these keys:
- code: project/track reference code or number (string or null if not found)
- album: album or collection name (string or null)
- publisher: publisher or label name (string or null)
- due_date: deadline in ISO 8601 format YYYY-MM-DD (string or null)
- fee: fee or budget amount including currency symbol e.g. "£500", "$1,200" (string or null)
- file_naming: file naming convention or template if explicitly stated e.g. "LABEL_ALBUM_TrackName_v1.00" (string or null)

Return only the JSON object. No explanation, no markdown fences.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'Server misconfigured: missing API key' }), { status: 500 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const rawText = formData.get('text') as string | null;

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

  let content: ContentBlock[];

  if (rawText) {
    content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${rawText}` }];
  } else if (file) {
    const bytes = await file.arrayBuffer();
    const mime = file.type;

    if (mime === 'text/plain') {
      const text = new TextDecoder().decode(bytes);
      content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${text}` }];
    } else if (mime === 'application/pdf') {
      const b64 = toBase64(new Uint8Array(bytes));
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
        { type: 'text', text: 'Extract metadata from this brief.' },
      ];
    } else if (mime === 'image/png' || mime === 'image/jpeg') {
      const b64 = toBase64(new Uint8Array(bytes));
      content = [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: 'Extract metadata from this brief image.' },
      ];
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${result.value}` }];
    } else {
      return new Response(JSON.stringify({ error: `Unsupported file type: ${mime}` }), { status: 400 });
    }
  } else {
    return new Response(JSON.stringify({ error: 'No file or text provided' }), { status: 400 });
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    console.error('Claude error:', err);
    return new Response(JSON.stringify({ error: 'AI extraction failed' }), { status: 500 });
  }

  const claudeData = await claudeRes.json();
  const raw = claudeData.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: ParsedBrief;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('JSON parse failed:', raw);
    return new Response(JSON.stringify({ error: 'Could not parse AI response' }), { status: 500 });
  }

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
});
