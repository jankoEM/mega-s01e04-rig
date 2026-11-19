import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      night: '2026-10-28',
      badLines: 1,
      counts: { ok: 4, retry: 0, fail: 1 },
      rows: [
        {
          job: 'digest/render',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-29T05:41:09+01:00',
          lastAt: '2026-10-29T05:41:09+01:00',
        },
        {
          job: 'fixtures/refresh',
          owner: 'rook',
          runs: 4,
          retries: 3,
          lastStatus: 'ok',
          lastError: 'upstream 503',
          firstAt: '2026-10-29T01:30:00+01:00',
          lastAt: '2026-10-29T01:37:00+01:00',
        },
        {
          job: 'lane/sync',
          owner: 'rook',
          runs: 8,
          retries: 1,
          lastStatus: 'ok',
          lastError: 'lock held',
          firstAt: '2026-10-28T23:00:06+01:00',
          lastAt: '2026-10-29T05:00:04+01:00',
        },
        {
          job: 'notes/backup',
          owner: 'lane-07',
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'quota exceeded',
          firstAt: '2026-10-29T04:00:01+01:00',
          lastAt: '2026-10-29T04:00:01+01:00',
        },
        {
          job: 'rig/rotate-logs',
          owner: 'lane-07',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T23:00:02+01:00',
          lastAt: '2026-10-28T23:00:02+01:00',
        },
      ],
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight(join(tmp, 'no-such-dir'), '2026-10-28')).toBeNull();
  });

  it('returns null for a name that is not a night', () => {
    writeFileSync(join(tmp, 'secret.jsonl'), '');
    expect(readNight(join(tmp, 'x'), '../secret')).toBeNull();
    expect(readNight(tmp, 'secret')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts bad lines, skips blank ones, never throws', () => {
    const lines = [
      '{"at":"2026-01-02T01:00:00+01:00","job":"b","status":"retry","owner":"rook","error":"e1"}',
      '',
      'not json',
      '{"at":"2026-01-02T01:00:00+01:00","job":"b"',
      '{"job":"b","status":"ok","owner":"rook"}',
      '{"at":"yesterday","job":"b","status":"ok","owner":"rook"}',
      '{"at":"2026-01-02T01:05:00+01:00","status":"ok","owner":"rook"}',
      '{"at":"2026-01-02T01:05:00+01:00","job":"b","status":"done","owner":"rook"}',
      '[1,2]',
      'null',
      '   ',
      '{"at":"2026-01-02T01:10:00+01:00","job":"b","status":"fail","owner":null,"error":"e2"}',
      '{"at":"2026-01-02T00:30:00-05:00","job":"a","status":"retry"}',
    ];
    writeFileSync(join(tmp, '2026-01-02.jsonl'), lines.join('\r\n') + '\n');
    expect(readNight(tmp, '2026-01-02')).toEqual({
      night: '2026-01-02',
      badLines: 8,
      counts: { ok: 0, retry: 1, fail: 1 },
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 1,
          retries: 1,
          lastStatus: 'retry',
          lastError: null,
          firstAt: '2026-01-02T00:30:00-05:00',
          lastAt: '2026-01-02T00:30:00-05:00',
        },
        {
          job: 'b',
          owner: null,
          runs: 2,
          retries: 1,
          lastStatus: 'fail',
          lastError: 'e2',
          firstAt: '2026-01-02T01:00:00+01:00',
          lastAt: '2026-01-02T01:10:00+01:00',
        },
      ],
    });
  });
});
