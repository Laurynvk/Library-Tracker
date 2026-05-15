import { describe, it, expect } from 'vitest';
import { tracksToCSV } from './csvExport';
import type { Track } from '../types/track';

const track: Track = {
  id: '1',
  created_at: '2026-05-01T00:00:00Z',
  code: 'APM-001',
  title: 'Summer Drive',
  album: 'Vol 1',
  version: 'v1.00',
  status: 'approved',
  invoice: 'unpaid',
  due_date: '2026-06-01',
  publisher: 'APM Music',
  publisher_email: null,
  fee: 500,
  brief_link: null,
  folder_path: null,
  brief_parsed_at: null,
  file_naming: null,
  collaborators: ['LK', 'JB'],
  notes: 'FKA: Old Title',
  activity: [],
};

describe('tracksToCSV', () => {
  it('produces a header row', () => {
    const csv = tracksToCSV([track]);
    const header = csv.split('\n')[0];
    expect(header).toContain('Code');
    expect(header).toContain('Title');
    expect(header).toContain('Status');
    expect(header).toContain('Publisher');
  });

  it('produces a data row with correct values', () => {
    const csv = tracksToCSV([track]);
    expect(csv).toContain('APM-001');
    expect(csv).toContain('Summer Drive');
    expect(csv).toContain('approved');
    expect(csv).toContain('APM Music');
    expect(csv).toContain('500');
  });

  it('joins collaborators with semicolons', () => {
    const csv = tracksToCSV([track]);
    expect(csv).toContain('LK;JB');
  });

  it('handles empty tracks array', () => {
    const csv = tracksToCSV([]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1); // header only
  });

  it('wraps values containing commas in quotes', () => {
    const csv = tracksToCSV([{ ...track, title: 'Hello, World' }]);
    expect(csv).toContain('"Hello, World"');
  });

  it('wraps values containing quotes in double-quotes and doubles internal quotes', () => {
    const csv = tracksToCSV([{ ...track, title: 'Say "Hello"' }]);
    expect(csv).toContain('"Say ""Hello"""');
  });

  it('wraps values containing newlines in double-quotes', () => {
    const csv = tracksToCSV([{ ...track, notes: 'line1\nline2' }]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('outputs empty string for null values', () => {
    const csv = tracksToCSV([{ ...track, code: null, album: null }]);
    const lines = csv.split('\n');
    const dataRow = lines[1];
    // code and album are null → should be empty (consecutive commas)
    expect(dataRow.startsWith(',')).toBe(true); // first field (code) is empty
  });
});
