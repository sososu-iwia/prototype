// Test tools may create/drop temporary databases and must never use the live DB.
export function assertTestDatabase(connection = process.env.DATABASE_URL) {
  let name = "";
  try {
    name = decodeURIComponent(new URL(connection || "").pathname.slice(1));
  } catch {
    /* rejected below */
  }
  if (
    !/^[a-z0-9_-]+$/i.test(name) ||
    !/(?:^|[_-])(?:test|codex)(?:[_-]|$)/i.test(name)
  )
    throw new Error(
      "Tests require a database name containing a distinct test/codex marker. Credentials and hostnames do not qualify.",
    );
}
