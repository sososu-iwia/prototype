export type AdminRow = Record<string, unknown>;
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

// Keep local edits and take newer values only for fields the editor did not
// change. Simultaneous edits to the same field require explicit confirmation.
export function rebaseDraft(base: AdminRow, local: AdminRow, remote: AdminRow) {
  const merged = { ...remote };
  const conflicts: string[] = [];
  for (const key of Object.keys(local)) {
    const own = JSON.stringify(local[key]);
    const original = JSON.stringify(base[key]);
    const latest = JSON.stringify(remote[key]);
    if (own === original) continue;
    merged[key] = local[key];
    if (latest !== original && latest !== own) conflicts.push(key);
  }
  return { merged, conflicts };
}
