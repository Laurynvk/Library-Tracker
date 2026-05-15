import { describe, it, expect } from 'vitest';
import { sortByMostRecentlyAdded } from './tracks';
import type { Track } from '../types/track';

function makeTrack(overrides: Partial<Track>): Track {
  return {
    id: overrides.id ?? 'id',
    created_at: overrides.created_at ?? '',
    code: null,
    title: overrides.title ?? 'Track',
    album: null,
    version: 'v1.00',
    status: 'briefed',
    invoice: 'unpaid',
    due_date: null,
    publisher: null,
    publisher_email: null,
    fee: null,
    brief_link: null,
    folder_path: null,
    brief_parsed_at: null,
    file_naming: null,
    collaborators: [],
    notes: null,
    activity: [],
    ...overrides,
  };
}

describe('sortByMostRecentlyAdded', () => {
  it('puts the most recently added track at the top', () => {
    const older = makeTrack({ id: 'older', title: 'Older', created_at: '2026-05-10T10:00:00Z' });
    const oldest = makeTrack({ id: 'oldest', title: 'Oldest', created_at: '2026-04-01T10:00:00Z' });
    const newest = makeTrack({ id: 'newest', title: 'Newest', created_at: '2026-05-15T10:00:00Z' });

    const sorted = sortByMostRecentlyAdded([older, oldest, newest]);

    expect(sorted.map((t) => t.id)).toEqual(['newest', 'older', 'oldest']);
  });

  it('places a freshly added track at the top of the list', () => {
    const existing = [
      makeTrack({ id: 'a', created_at: '2026-05-10T10:00:00Z' }),
      makeTrack({ id: 'b', created_at: '2026-05-11T10:00:00Z' }),
    ];
    const justAdded = makeTrack({ id: 'new', created_at: '2026-05-15T12:00:00Z' });

    const sorted = sortByMostRecentlyAdded([...existing, justAdded]);

    expect(sorted[0].id).toBe('new');
  });

  it('keeps tracks missing created_at after timestamped tracks, preserving their relative order', () => {
    const legacy1 = makeTrack({ id: 'legacy1', created_at: '' });
    const legacy2 = makeTrack({ id: 'legacy2', created_at: '' });
    const fresh = makeTrack({ id: 'fresh', created_at: '2026-05-15T10:00:00Z' });

    const sorted = sortByMostRecentlyAdded([legacy1, legacy2, fresh]);

    expect(sorted.map((t) => t.id)).toEqual(['fresh', 'legacy1', 'legacy2']);
  });

  it('does not mutate the input array', () => {
    const input = [
      makeTrack({ id: 'a', created_at: '2026-05-10T10:00:00Z' }),
      makeTrack({ id: 'b', created_at: '2026-05-15T10:00:00Z' }),
    ];
    const original = [...input];
    sortByMostRecentlyAdded(input);
    expect(input).toEqual(original);
  });
});
