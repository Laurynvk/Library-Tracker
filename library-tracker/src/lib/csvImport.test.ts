import { describe, it, expect } from 'vitest';
import {
  fuzzyMatchStatus,
  mapRow,
  applyFilter,
  getFilterValues,
  parseCSVText,
} from './csvImport';

describe('fuzzyMatchStatus', () => {
  it('maps known values', () => {
    expect(fuzzyMatchStatus('briefed')).toBe('briefed');
    expect(fuzzyMatchStatus('BRIEFED')).toBe('briefed');
    expect(fuzzyMatchStatus('Brief received')).toBe('briefed');
    expect(fuzzyMatchStatus('in progress')).toBe('writing');
    expect(fuzzyMatchStatus('WIP')).toBe('writing');
    expect(fuzzyMatchStatus('on hold')).toBe('holding');
    expect(fuzzyMatchStatus('passed')).toBe('rejected');
    expect(fuzzyMatchStatus('needs rev')).toBe('needs_rev');
    expect(fuzzyMatchStatus('Revised')).toBe('revised');
    expect(fuzzyMatchStatus('Need to deliver')).toBe('need_to_deliver');
    expect(fuzzyMatchStatus('needs to deliver')).toBe('need_to_deliver');
  });

  it('defaults unknown values to briefed', () => {
    expect(fuzzyMatchStatus('some random thing')).toBe('briefed');
    expect(fuzzyMatchStatus('')).toBe('briefed');
  });
});

describe('mapRow', () => {
  it('maps a full row correctly', () => {
    const raw: Record<string, string> = {
      TITLE: 'Summer Drive',
      VERS: 'v1.00',
      'PROJECT CODE': 'APM-001',
      STATUS: 'approved',
      'DATE DUE': '2026-06-01',
      'ALBUM / ORDER': 'Album A',
      LABEL: 'APM Music',
      WRITERS: 'LK, JB',
      FKA: 'Old Title',
      'COMP INT': 'LK',
    };
    const row = mapRow(raw);
    expect(row).not.toBeNull();
    expect(row!.title).toBe('Summer Drive');
    expect(row!.version).toBe('v1.00');
    expect(row!.code).toBe('APM-001');
    expect(row!.status).toBe('approved');
    expect(row!.album).toBe('Album A');
    expect(row!.publisher).toBe('APM Music');
    expect(row!.collaborators).toEqual(['LK', 'JB']);
    expect(row!.notes).toBe('FKA: Old Title');
    expect(row!._comp_int).toBe('LK');
  });

  it('returns null for rows without a title', () => {
    expect(mapRow({ TITLE: '' })).toBeNull();
    expect(mapRow({ TITLE: '   ' })).toBeNull();
  });

  it('handles missing optional fields gracefully', () => {
    const row = mapRow({ TITLE: 'My Track' });
    expect(row).not.toBeNull();
    expect(row!.code).toBeNull();
    expect(row!.album).toBeNull();
    expect(row!.notes).toBeNull();
    expect(row!.collaborators).toEqual([]);
  });

  it('handles invalid date gracefully', () => {
    const row = mapRow({ TITLE: 'My Track', 'DATE DUE': 'not a date' });
    expect(row).not.toBeNull();
    expect(row!.due_date).toBeNull();
  });

  it('parses a valid date', () => {
    const row = mapRow({ TITLE: 'My Track', 'DATE DUE': '2026-06-01' });
    expect(row).not.toBeNull();
    expect(row!.due_date).toBe('2026-06-01');
  });
});

describe('applyFilter', () => {
  const rows = [
    { title: 'A', _comp_int: 'LK', publisher: 'APM', status: 'approved', album: 'Vol1' },
    { title: 'B', _comp_int: 'JB', publisher: 'Extreme', status: 'writing', album: 'Vol2' },
    { title: 'C', _comp_int: 'LK', publisher: 'APM', status: 'delivered', album: 'Vol1' },
  ] as Parameters<typeof applyFilter>[0];

  it('filters by initials', () => {
    const result = applyFilter(rows, { type: 'initials', value: 'LK' });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r._comp_int.toLowerCase().includes('lk'))).toBe(true);
  });

  it('filters by label', () => {
    const result = applyFilter(rows, { type: 'label', value: 'APM' });
    expect(result).toHaveLength(2);
  });

  it('filters by status', () => {
    const result = applyFilter(rows, { type: 'status', value: 'approved' });
    expect(result).toHaveLength(1);
  });

  it('returns all rows when filter value is empty', () => {
    expect(applyFilter(rows, { type: 'initials', value: '' })).toHaveLength(3);
    expect(applyFilter(rows, null)).toHaveLength(3);
  });

  it('is case-insensitive', () => {
    expect(applyFilter(rows, { type: 'initials', value: 'lk' })).toHaveLength(2);
  });
});

describe('getFilterValues', () => {
  const rows = [
    { _comp_int: 'LK', publisher: 'APM', status: 'approved', album: 'Vol1' },
    { _comp_int: 'JB', publisher: 'Extreme', status: 'writing', album: 'Vol1' },
    { _comp_int: 'LK', publisher: 'APM', status: 'delivered', album: 'Vol2' },
  ] as Parameters<typeof getFilterValues>[0];

  it('returns unique sorted values for each filter type', () => {
    const vals = getFilterValues(rows);
    expect(vals.initials).toEqual(['JB', 'LK']);
    expect(vals.label).toEqual(['APM', 'Extreme']);
    expect(vals.status).toEqual(['approved', 'delivered', 'writing']);
    expect(vals.album).toEqual(['Vol1', 'Vol2']);
  });
});

describe('parseCSVText', () => {
  it('parses a CSV string into rows', () => {
    const csv = `TITLE,STATUS,COMP INT\nSummer Drive,approved,LK\nCity Pulse,writing,JB`;
    const { rows } = parseCSVText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Summer Drive');
    expect(rows[0].status).toBe('approved');
  });

  it('skips rows without a title', () => {
    const csv = `TITLE,STATUS\nSummer Drive,approved\n,writing`;
    const { rows } = parseCSVText(csv);
    expect(rows).toHaveLength(1);
  });

  it('counts unrecognised status values', () => {
    const csv = `TITLE,STATUS\nTrack A,approved\nTrack B,some weird status\nTrack C,another unknown`;
    const { rows, defaultedCount } = parseCSVText(csv);
    expect(rows).toHaveLength(3);
    expect(defaultedCount).toBe(2);
    expect(rows[1].status).toBe('briefed'); // defaulted
  });

  it('returns 0 defaultedCount when all statuses are recognised', () => {
    const csv = `TITLE,STATUS\nTrack A,approved\nTrack B,writing`;
    const { defaultedCount } = parseCSVText(csv);
    expect(defaultedCount).toBe(0);
  });

  it('strips a leading UTF-8 BOM so the first header still matches', () => {
    const BOM = String.fromCharCode(0xfeff);
    const csv = `${BOM}TITLE,STATUS\nSummer Drive,approved`;
    const { rows } = parseCSVText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Summer Drive');
    expect(rows[0].status).toBe('approved');
  });

  it('accepts the app\'s own export headers (Publisher, Due Date, Version, Code, Album)', () => {
    const csv = [
      'Code,Title,Version,Album,Publisher,Status,Invoice,Fee,Due Date,Notes,Collaborators,Created At',
      'APM-001,Summer Drive,v1.02,Volume A,APM Music,approved,unpaid,,2026-06-01,some notes,LK;JB,2026-05-01',
    ].join('\n');
    const { rows } = parseCSVText(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Summer Drive');
    expect(rows[0].publisher).toBe('APM Music');
    expect(rows[0].due_date).toBe('2026-06-01');
    expect(rows[0].version).toBe('v1.02');
    expect(rows[0].code).toBe('APM-001');
    expect(rows[0].album).toBe('Volume A');
    expect(rows[0].collaborators).toEqual(['LK', 'JB']);
  });
});
