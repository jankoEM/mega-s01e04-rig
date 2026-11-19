import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = createApp(config);

const line = (at: string, job: string, status: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ at, job, status, ...extra });

function writeNight(night: string, lines: string[]) {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n') + '\n');
}

const NORMAL = '2026-03-01';
writeNight(NORMAL, [
  line('2026-03-01T05:00:00+01:00', 'zeta/render', 'ok', { owner: 'rook' }),
  line('2026-03-01T01:00:00+01:00', 'alpha/sync', 'retry', { owner: 'rook', error: 'lock held' }),
  line('2026-03-01T01:01:00+01:00', 'alpha/sync', 'retry', { owner: 'rook', error: 'lock held' }),
  line('2026-03-01T01:02:00+01:00', 'alpha/sync', 'retry', { owner: 'rook', error: 'lock held' }),
  line('2026-03-01T01:03:00+01:00', 'alpha/sync', 'ok', { owner: 'rook' }),
  line('2026-03-01T02:00:00+01:00', 'beta/digest', 'ok'),
  line('2026-03-01T03:00:00+01:00', 'gamma/backup', 'fail', { owner: 'lane-07', error: 'quota exceeded' }),
]);

const EMPTY = '2026-03-02';
writeNight(EMPTY, []);

const BAD = '2026-03-03';
writeNight(BAD, [
  line('2026-03-03T01:00:00+01:00', 'delta/job', 'ok', { owner: 'rook' }),
  '{"at":"2026-03-03T02:00:00+01:00","job":"delta/job"',
  line('2026-03-03T03:00:00+01:00', 'epsilon/job', 'fail', { owner: 'rook' }),
]);

describe('digest page and JSON routes', () => {
  it('a normal night: page lists each job, the dash owner and warn rows; JSON keeps the page order', async () => {
    const page = await app.request(`/digest/${NORMAL}`);
    const html = await page.text();
    expect(page.status).toBe(200);
    for (const job of ['alpha/sync', 'beta/digest', 'gamma/backup', 'zeta/render']) {
      expect(html).toContain(job);
    }
    expect(html).toContain('—');
    expect(html).toContain('class="warn"');

    const api = await app.request(`/api/digest/${NORMAL}`);
    expect(api.status).toBe(200);
    const body = (await api.json()) as { rows: { job: string }[] };
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/sync', 'beta/digest', 'gamma/backup', 'zeta/render']);

    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('a night with no file: both routes 404', async () => {
    const page = await app.request('/digest/1999-01-01');
    expect(page.status).toBe(404);
    const api = await app.request('/api/digest/1999-01-01');
    expect(api.status).toBe(404);
    expect(await api.json()).toHaveProperty('error');
  });

  it('an empty file: page says nothing ran; JSON has no rows', async () => {
    const page = await app.request(`/digest/${EMPTY}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');

    const api = await app.request(`/api/digest/${EMPTY}`);
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({ rows: [] });
  });

  it('a bad line: both 200, badLines 1, page says so, valid rows stay', async () => {
    const page = await app.request(`/digest/${BAD}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('1 bad line skipped');
    expect(html).toContain('delta/job');
    expect(html).toContain('epsilon/job');

    const api = await app.request(`/api/digest/${BAD}`);
    expect(api.status).toBe(200);
    const body = (await api.json()) as { badLines: number; rows: { job: string }[] };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['delta/job', 'epsilon/job']);
  });

  it('an invalid night name: both 404', async () => {
    expect((await app.request('/digest/not-a-night')).status).toBe(404);
    expect((await app.request('/api/digest/not-a-night')).status).toBe(404);
  });
});
