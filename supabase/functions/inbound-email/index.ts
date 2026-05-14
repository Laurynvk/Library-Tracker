import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    // Webhook authentication — SendGrid sends the secret in a custom header
    const webhookSecret = Deno.env.get('SENDGRID_WEBHOOK_SECRET');
    if (webhookSecret) {
      const incoming = req.headers.get('x-webhook-secret');
      if (incoming !== webhookSecret) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (req.method !== 'POST') return new Response('ok', { status: 200 });

    const contentType = req.headers.get('content-type') ?? '';
    let to: string, from: string, subject: string, text: string;
    if (contentType.includes('application/json')) {
      const body = await req.json();
      to = body.to;
      from = body.from;
      subject = body.subject ?? '(no subject)';
      text = body.text ?? '';
    } else {
      const formData = await req.formData();
      to = formData.get('to') as string;
      from = formData.get('from') as string;
      subject = (formData.get('subject') as string) ?? '(no subject)';
      text = (formData.get('text') as string) ?? '';
    }

    console.log('to:', to, 'from:', from, 'subject:', subject);

    if (!to || !from) { console.log('Missing to/from'); return new Response('ok', { status: 200 }); }

    const toAddress = to.match(/<(.+?)>/)?.[1] ?? to.trim();
    console.log('toAddress:', toAddress);

    const { data: addrRow, error: addrErr } = await supabase
      .from('user_inbox_addresses')
      .select('user_id')
      .eq('address', toAddress)
      .single();

    console.log('addrRow:', JSON.stringify(addrRow), 'addrErr:', addrErr?.message);
    if (addrErr || !addrRow) return new Response('ok', { status: 200 });

    const userId = addrRow.user_id;

    const { data: tracks, error: tracksErr } = await supabase
      .from('tracks')
      .select('id, code, title, publisher, status');
    console.log('tracks count:', (tracks ?? []).length, 'tracksErr:', tracksErr?.message);

    const trackList = (tracks ?? []).map((t: { id: string; code: string | null; title: string; publisher: string | null; status: string }) =>
      `- id:${t.id} | code:${t.code ?? '?'} | title:${t.title} | publisher:${t.publisher ?? '?'} | status:${t.status}`
    ).join('\n');

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    console.log('Calling Claude API...');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 256,
        system: `You are an assistant for a music library tracker app. Given an email and a list of tracks, identify which track the email is about and propose a status update. Return ONLY valid JSON with this shape:
{
  "track_id": "<uuid or null>",
  "proposed_status": "<one of: brief|writing|written|revising|needs_rev|sent|approved|delivered|hold|rejected|null>",
  "excerpt": "<the 1-2 sentence quote from the email that led to your decision>",
  "relevant": <true if this email is about a track, false if it is spam or unrelated>
}`,
        messages: [{
          role: 'user',
          content: `Email subject: ${subject}\n\nEmail body:\n${text.slice(0, 2000)}\n\nTracks:\n${trackList}`,
        }],
      }),
    });

    console.log('Claude status:', claudeRes.status);
    const claudeBody = await claudeRes.json();
    console.log('Claude response:', JSON.stringify(claudeBody).slice(0, 300));

    if (!claudeRes.ok) {
      console.error('Claude API error:', claudeBody);
      return new Response('ok', { status: 200 });
    }

    const raw = (claudeBody.content?.[0]?.text?.trim() ?? '')
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
    console.log('Claude raw text:', raw);

    let parsed: { track_id: string | null; proposed_status: string | null; excerpt: string; relevant: boolean };
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse error:', e);
      return new Response('ok', { status: 200 });
    }

    const validStatuses = new Set(['brief','writing','written','revising','needs_rev','sent','approved','delivered','hold','rejected']);
    if (parsed.proposed_status && !validStatuses.has(parsed.proposed_status)) parsed.proposed_status = null;
    if (parsed.track_id && !(tracks ?? []).find((t: { id: string }) => t.id === parsed.track_id)) parsed.track_id = null;

    console.log('parsed:', JSON.stringify(parsed));
    if (!parsed.relevant) { console.log('Not relevant'); return new Response('ok', { status: 200 }); }

    let currentStatus: string | null = null;
    if (parsed.track_id) {
      const match = (tracks ?? []).find((t: { id: string; status: string }) => t.id === parsed.track_id);
      currentStatus = match?.status ?? null;
    }

    const { error: insertError } = await supabase.from('inbox_items').insert({
      user_id: userId,
      track_id: parsed.track_id ?? null,
      raw_email: text.slice(0, 10000),
      sender: from,
      subject,
      excerpt: parsed.excerpt,
      proposed_status: parsed.proposed_status ?? null,
      current_status: currentStatus,
      state: 'pending',
    });
    if (insertError) console.error('Insert error:', insertError.message);
    else console.log('Inserted inbox_item successfully');

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('inbound-email error:', err);
    return new Response('ok', { status: 200 });
  }
});
