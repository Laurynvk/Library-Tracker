import { supabase } from './supabase';
import type { Track, NewTrack } from '../types/track';

export async function fetchTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false });
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

/**
 * Returns a new array of tracks sorted by `created_at` descending
 * (most recently added first). Tracks missing a valid `created_at`
 * fall back to their existing relative order in the input array,
 * and are placed after tracks that do have a timestamp.
 */
export function sortByMostRecentlyAdded(tracks: Track[]): Track[] {
  return tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => {
      const at = a.track.created_at ? Date.parse(a.track.created_at) : NaN;
      const bt = b.track.created_at ? Date.parse(b.track.created_at) : NaN;
      const aValid = Number.isFinite(at);
      const bValid = Number.isFinite(bt);
      if (aValid && bValid) return bt - at;
      if (aValid) return -1;
      if (bValid) return 1;
      return a.index - b.index;
    })
    .map(({ track }) => track);
}
