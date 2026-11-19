import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isNightName,
  type DigestRow,
  type NightDigest,
  type ReadNight,
  type RunStatus,
  type StatusCounts,
} from './types.js';

type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// ISO date and time with an offset (or Z), as the log writes it.
const AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isStatus(value: unknown): value is RunStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

// The edge: one raw line in, a trusted RunLine or null (bad line) out.
function parseLine(raw: string): RunLine | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { at, job, status, owner, error } = data as Record<string, unknown>;
  if (typeof at !== 'string' || !AT_PATTERN.test(at) || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job.trim() === '') return null;
  if (!isStatus(status)) return null;
  return {
    at,
    job,
    status,
    owner: typeof owner === 'string' && owner.trim() !== '' ? owner : null,
    error: typeof error === 'string' && error !== '' ? error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNightName(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines += 1;
      continue;
    }
    const row = byJob.get(line.job);
    if (row === undefined) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs += 1;
    if (line.status === 'retry') row.retries += 1;
    row.lastStatus = line.status;
    if (line.error !== null) row.lastError = line.error;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of rows) counts[row.lastStatus] += 1;
  return { night, rows, badLines, counts };
};
