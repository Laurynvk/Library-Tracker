import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

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

    // SendGrid posts multipart/form-data
    const formData = await req.formData();
    const to = formData.get('to') as string;
    const from = formData.get('from') as string;
    const subject = (formData.get('subject') as string) ?? '(no subject)';
    const text = (formData.get('text') as string) ?? '';

    if (!to || !from) return new Response('ok', { status: 200 });

    // Extract the bare address from "Name <addr>" format
    const toAddress = to.match(/<(.+?)>/)?.[1] ?? to.trim();

    // Look up user by forwarding address
    const { data: addrRow, error: addrErr } = await supabase
      .from('user_inbox_addresses')
      .select('user_id')
      .eq('address', toAddress)
      .single();

    if (addrErr) { console.error('Address lookup error:', addrErr); return new Response('ok', { status: 200 }); }
    if (!addrRow) return new Response('ok', { status: 200 });

    const userId = addrRow.user_id;

    // Load user's tracks — no user_id filter since app is currently single-user
    const { data: tracks } = await supabase
      .from('tracks')
      .select('id, code, title, publisher, status');

    const trackList = (tracks ?? []).map((t: { id: string; code: string | null; title: string; publisher: string | null; status: string }) =>
      `- id:${t.id} | code:${t.code ?? '?'} | title:${t.title} | publisher:${t.publisher ?? '?'} | status:${t.status}`
    ).join('\n');

    // Ask Claude to match and propose
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    let parsed: { track_id: string | null; proposed_status: string | null; excerpt: string; relevant: boolean };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response('ok', { status: 200 });
    }

    // Validate Claude output
    const validStatuses = new Set(['brief','writing','written','revising','needs_rev','sent','approved','delivered','hold','rejected']);
    if (parsed.proposed_status && !validStatuses.has(parsed.proposed_status)) {
      parsed.proposed_status = null;
    }
    // Prevent prompt injection: ensure track_id is one of the loaded tracks
    if (parsed.track_id && !(tracks ?? []).find((t: { id: string }) => t.id === parsed.track_id)) {
      parsed.track_id = null;
    }

    if (!parsed.relevant) return new Response('ok', { status: 200 });

    // Look up current status for the matched track
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
    if (insertError) console.error('Insert error:', insertError);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('inbound-email error:', err);
    return new Response('ok', { status: 200 });
  }
});
