import { db } from "./db";
type Migration = { name: string; checksum: string };
export async function verifyVercelRuntime(expected: Migration[]) {
  const stage = process.env.VERCEL_ENV;
  if (!["production", "preview", "development"].includes(stage || ""))
    throw new Error("Explicit Vercel deployment environment is required");
  const [role] = await db.$queryRaw<{ name: string; unsafe: boolean }[]>`
    SELECT current_user AS name,
      (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
       OR has_schema_privilege(current_user, 'public', 'CREATE')
       OR has_table_privilege(current_user, '"_prisma_migrations"', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege(current_user, '"DeploymentEnvironment"', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))) AS unsafe
    FROM pg_roles WHERE rolname=current_user`;
  const marker = await db.deploymentEnvironment.findUnique({
    where: { id: "environment" },
  });
  if (
    !role ||
    role.unsafe ||
    role.name !== `ordabasy_${stage}` ||
    marker?.stage !== stage
  )
    throw new Error(
      "Database role or environment does not match this deployment",
    );
  const rows = await db.$queryRaw<
    {
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }[]
  >`
    SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  if (rows.some((row) => !row.finished_at && !row.rolled_back_at))
    throw new Error("Resolve the failed migration before deploying");
  for (const migration of expected) {
    const active = rows.filter(
      (r) => r.migration_name === migration.name && !r.rolled_back_at,
    );
    if (
      !active.some((r) => r.finished_at && r.checksum === migration.checksum) ||
      active.some((r) => !r.finished_at)
    )
      throw new Error("Apply the reviewed database release before deploying");
  }
}
