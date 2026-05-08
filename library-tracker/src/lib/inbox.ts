import { supabase } from './supabase';
import { updateTrack } from './tracks';
import type { InboxItem, StatusId, ActivityEvent } from '../types/track';

export async function fetchOrCreateInboxAddress(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('user_inbox_addresses')
    .select('address')
    .eq('user_id', userId)
    .single();

  if (existing) return existing.address;

  const slug = Math.random().toString(36).slice(2, 10);
  const address = `u_${slug}@inbound.librarytracker.app`;

  const { error } = await supabase
    .from('user_inbox_addresses')
    .insert({ user_id: userId, address });

  if (error) throw error;
  return address;
}

export async function activateInbox(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_inbox_addresses')
    .update({ activated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchInboxAddress(userId: string): Promise<{ address: string; activated_at: string | null } | null> {
  const { data } = await supabase
    .from('user_inbox_addresses')
    .select('address, activated_at')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function fetchPendingItems(userId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('user_id', userId)
    .eq('state', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

export async function approveProposal(item: InboxItem): Promise<void> {
  if (!item.track_id || !item.proposed_status) throw new Error('Cannot approve unmatched item');

  const emailEvent: ActivityEvent = {
    at: new Date().toISOString(),
    kind: 'email_matched',
    source: 'email',
    detail: item.excerpt,
  };
  const statusEvent: ActivityEvent = {
    at: new Date().toISOString(),
    kind: 'status_change',
    from: item.current_status ?? undefined,
    to: item.proposed_status,
    source: 'email',
  };

  const { data: track, error: fetchError } = await supabase
    .from('tracks')
    .select('activity')
    .eq('id', item.track_id)
    .single();
  if (fetchError) throw fetchError;

  const updatedActivity = [...(track.activity ?? []), emailEvent, statusEvent];

  await updateTrack(item.track_id, {
    status: item.proposed_status as StatusId,
    activity: updatedActivity,
  });

  const { error } = await supabase
    .from('inbox_items')
    .update({ state: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', item.id);
  if (error) throw error;
}

export async function dismissProposal(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('inbox_items')
    .update({ state: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}
