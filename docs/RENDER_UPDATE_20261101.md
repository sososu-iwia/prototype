# Render update — 1 November 2026

This release combines the premium redesign merged into `main` at
`47eb41caec3889081dad97e8a6987250aa7a646a` with the existing Render deployment
support from `bb88e96cec7892c80d1ecbf9af6837beaec3a0d5`.

The approved new pages, hero images, gallery video and sponsor assets are retained.
The deployment integration adds HTTPS API resolution, bounded cold-start waits,
same-origin admin proxying, the existing Free demo media mode and the runtime
migration/least-privilege gate. It does not activate a paid plan or new uploads.

Both services use `codex/render-update-20261101` with **After CI Checks Pass**.
Keep the existing database, service IDs, environment secrets and public domains.
Do not create replacement services or reset PostgreSQL. Review the PR before a
later normal merge into `main`, then switch the Blueprint and both service branches
together. The previous Render branch remains available as a code rollback target.

## Release before deployment

The additive `20261030000000_premium_club` migration adds sponsor and academy
tables, team categories and achievement metadata. All five original migrations
are unchanged. It must be applied before deploying the new API image.

1. Verify the local checks and the exact release commit's GitHub Quality checks.
2. With the owner's separate approval, temporarily allow only the operator's
   current `/32` to the existing database; use TLS `verify-full`.
3. Make a fresh private custom-format PostgreSQL backup and verify its archive.
4. Restore into an isolated disposable PostgreSQL 17 instance. Rehearse the new
   migration and idempotent seed there; compare the original records and account
   hashes. Only the existing seed's reviewed team/achievement classification may
   change; preserve editorial text and existing identities.
5. Run `scripts/render-release.mjs` with the existing owner URL, existing runtime
   role/password, `RENDER_DATABASE_NAME=ordabasy_demo` and
   `RENDER_SEED_ON_DEPLOY=true`. Do not use `--provision-runtime` on this database.
   The premium seed uses a bounded 120-second transaction budget for external TLS
   round trips, matching the existing archive seed.
6. Close external access again before deploying. The API keeps using Render's
   private network and its restricted DML role.
7. Review the Blueprint's manual-sync plan: update the existing web/API source
   branches only; retain the database and its Free plan. Verify both deployments,
   the new public pages/assets, all three languages and the existing admin login.

New academy inquiry collection remains disabled until an editor approves the CMS
configuration and a server-only `INQUIRY_RATE_SECRET` is configured. S3 uploads
remain explicitly disabled in the owner's Free demo configuration.

## Dependency fix

The merged source's GitHub check fails on
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The lockfile overrides `minimatch` to patched `11.0.1`. The existing ESLint and
TypeScript ESLint consumers use its compatible named APIs; lint, type checking,
tests and audit verify the resulting dependency tree. Audit is not bypassed.
