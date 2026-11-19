// Shapes of the morning digest (plan.md § 1). The page, the JSON route and the status board
// all read a night through `readNight` and must show the same NightDigest (ADR 0001).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job, built from every valid line of that job in runs/<night>.jsonl.
export type DigestRow = {
  job: string;
  // null when the log has no owner for the job: keep the row, render it as `—`.
  // Taken from the job's last line.
  owner: string | null;
  // Number of valid lines for the job.
  runs: number;
  // Number of those lines with status `retry`.
  retries: number;
  // Status of the job's last line (file order).
  lastStatus: RunStatus;
  // `error` of the job's last line that carries one, null when no line does.
  // It can be set while lastStatus is `ok` (the job failed earlier, then recovered).
  lastError: string | null;
  // `at` of the job's first and last line (file order), exactly as written in the log:
  // offset kept, never converted (styleguide: times).
  firstAt: string;
  lastAt: string;
};

// Number of jobs (rows) by their last status. ok + retry + fail === rows.length.
export type StatusCounts = { ok: number; retry: number; fail: number };

export type NightDigest = {
  // YYYY-MM-DD, the file name without `.jsonl`.
  night: string;
  // Sorted by job, ascending (plain code-unit order). Empty when the file is empty.
  rows: DigestRow[];
  // Lines that are not blank and are not a valid run line (not JSON, or no valid `at`, `job`
  // or `status`). Counted, never thrown.
  badLines: number;
  counts: StatusCounts;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file (or `night` is not a
// valid night name): routes answer 404. An empty file gives a digest with rows: [].
// Never throws on file content.
// The implementation is `readNight` in `./read.js`:
//   import { readNight } from './digest/read.js';
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;

// A night name is YYYY-MM-DD; anything else never reaches the file system.
export const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isNightName(value: string): boolean {
  return NIGHT_PATTERN.test(value);
}
