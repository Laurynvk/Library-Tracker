export interface ParsedBrief {
  code: string | null;
  album: string | null;
  publisher: string | null;
  due_date: string | null;
  fee: string | null;
  file_naming: string | null;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-brief`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function parseBriefFile(file: File): Promise<ParsedBrief> {
  const body = new FormData();
  body.append('file', file);
  return callParseBrief(body);
}

export async function parseBriefText(text: string): Promise<ParsedBrief> {
  const body = new FormData();
  body.append('text', text);
  return callParseBrief(body);
}

async function callParseBrief(body: FormData): Promise<ParsedBrief> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON_KEY}` },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Brief parsing failed');
  }
  return res.json();
}
