import { supabase } from './supabase';
import type { Track, NewTrack } from '../types/track';

export async function fetchTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Track[];
}

export async function createTrack(track: NewTrack): Promise<Track> {
  const { data, error } = await supabase
    .from('tracks')
    .insert(track)
    .select()
    .single();
  if (error) throw error;
  return data as Track;
}

export async function importTracks(newTracks: NewTrack[]): Promise<Track[]> {
  if (newTracks.length === 0) return [];
  const { data, error } = await supabase
    .from('tracks')
    .insert(newTracks)
    .select();
  if (error) throw error;
  return data as Track[];
}

export async function updateTrack(id: string, patch: Partial<NewTrack>): Promise<Track> {
  const { data, error } = await supabase
    .from('tracks')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Track;
}

export async function deleteTrack(id: string): Promise<void> {
  const { error } = await supabase.from('tracks').delete().eq('id', id);
  if (error) throw error;
}
