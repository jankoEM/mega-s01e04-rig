import type { DigestRow, NightDigest } from '../digest/types.js';

// A row is marked (class `warn`) when a job retried 3 times or more, or its last status is fail.
function isMarked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>job</th>
                <th>owner</th>
                <th>runs</th>
                <th>retries</th>
                <th>last status</th>
                <th>last error</th>
                <th>first</th>
                <th>last</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => {
                const cls = isMarked(row) ? 'warn' : undefined;
                return (
                  <tr class={cls}>
                    <td>{row.job}</td>
                    <td>{row.owner ?? '—'}</td>
                    <td>{row.runs}</td>
                    <td>{row.retries}</td>
                    <td>{row.lastStatus}</td>
                    <td>{row.lastError ?? '—'}</td>
                    <td>{row.firstAt}</td>
                    <td>{row.lastAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p class="mute">
            ok {digest.counts.ok} · retry {digest.counts.retry} · fail {digest.counts.fail}
          </p>
        </>
      )}
      {digest.badLines > 0 ? (
        <p class="mute">
          {digest.badLines} bad {digest.badLines === 1 ? 'line' : 'lines'} skipped
        </p>
      ) : null}
    </>
  );
}
