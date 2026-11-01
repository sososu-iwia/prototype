# Premium FC Ordabasy redesign

Latest follow-up: [Final visual QA and local launch](FINAL_VISUAL_QA.md). It supersedes the historical acceptance numbers below. Follow-up changes add searchable sponsors/achievements/inquiries, strict malformed-CSRF rejection, complete backup count verification, viewport-controlled 30 fps video, responsive career tables, balanced gallery grids, stable admin focus scrolling, the Next.js 16 route scroll override, corrected sticky-header spacing, explicit hero/poster preload, and expanded production-browser evidence scripts. No new schema migration was required.

Review branch: `codex/premium-redesign-20261030`. This is a local implementation and review handoff. No production deployment, merge, remote push, existing database mutation or administrator replacement has been performed. The original untracked root asset ZIP is preserved.

## Implemented experience

| Area | Implementation |
| --- | --- |
| Public homepage | Server-rendered photographic lead, separate verified fixture rail, editorial CMS news, team destinations, honours, academy feature, verified-player section, existing gallery and neutral partner grid |
| Navigation | Localized desktop disclosures for teams/academy/club; native modal mobile drawer, contained keyboard focus, Escape and focus restoration, visible focus styles |
| Honours | Data-driven LEAGUE/CUP/SUPERCUP/MILESTONE categories; original SVG artwork; navy stadium composition and gold featured 2026 card; no index-based classification |
| Teams | `/[locale]/teams/first-team`, `first-league`, `second-league`; shared views, publication gate, season selector, verified active roster memberships for the current season, historical memberships for past seasons, coaches, fixtures and results, aggregate confirmed-match statistics; club news clearly labelled as club news |
| Academy | `/[locale]/academy` and `/academy/admission`; CMS introduction, philosophy, age groups, coaches, facilities, programmes, requirements, trials, schedule, next steps, FAQ, contacts and privacy notice; honest unconfirmed/closed/open states |
| Inquiries | Optional form; server Zod validation, same-origin checks, signed same-site HttpOnly double-submit CSRF, minimum token age, honeypot, single-use token, PostgreSQL-backed 5-per-15-minute client limit; no child address or document collection |
| Inquiry administration | ADMIN/SUPER_ADMIN only; status workflow, optimistic version checks, immediate personal-field erasure, sanitized audit trail; 90-day expiry with hourly cleanup and cleanup before reads/submissions |
| Sponsors | New PostgreSQL entity; source/logo approval gates, validity window, sort order, optional approved link/tier, history-preserving archive, logo media references protected from deletion; no sponsor promotion on youth/academy pages |
| Localization | Existing next-intl KZ (`kk`)/RU/EN, persisted language cookie and localized routes; existing Noto font and full Kazakh alphabet retained |
| Assets | All 9 originals, MIME/dimension/hash inventory, 7 WebP derivatives, sponsor verification table, separate references, reviewed ZIP |

## Data and editorial evidence

The additive migration is `apps/api/prisma/migrations/20261030000000_premium_club/migration.sql`. It extends existing Team, StaffMember and ClubAchievement records and creates Sponsor, AcademyPage, AcademyInquiry and temporary InquiryRateBucket tables. The partial unique database index enforces club + competition + year for club honours. Existing players, memberships, seasons, accounts, news and archive rows are retained.

`apps/api/src/premium-content.ts` runs after the original seed, including on an already initialized installation. It reuses existing championship identities, classifies untouched legacy honours without changing their wording, and never overwrites editor-managed records. The untouched 2023 championship and 2011 cup archive rows are verified from the sources below. First League stays DRAFT. Ordabasy M participation is confirmed without importing an invented roster.

- 2026 and prior 2023 title: https://eurasia.football/en/news-en/ordabasy-kazakhstan-premier-league-champions-2026/ (26 October 2026). The supplied Qazinform page could not be fetched.
- 2011 Kazakhstan Cup: https://pfl.kz/kaz/cup_kaz_2011/ and UEFA's historical final report.
- Ordabasy M 2026 Second League participation: https://kffleague.kz/ru/matches/1536.
- Bank RBK 2026 partnership: bank-attributed announcement at https://tengrinews.kz/kazakhstan_news/pervoy-raketki-mira-7-500-begunov-kakie-sportivnyie-608459/amp/. The 2026 season validity ends at the start of 2027; no sponsorship tier is asserted.

## CMS use

Use the existing localized `/admin` and existing accounts. Achievements, sponsors, academy and team presentation are added to the same workspace. Editors keep their previous permissions; the new informational modules and all personal inquiry records require ADMIN or SUPER_ADMIN. Staff can be associated with a team. Team category, overview, source, verification and publication state are editable. Academy content has named fields in each language. Sponsor logos use the existing upload/media picker, with approval and verification required before publication.

To enable inquiries, first approve and publish the academy privacy notice in Kazakh, add approved contacts, publish the academy record and enable inquiries. Set a unique server-only `INQUIRY_RATE_SECRET` of at least 32 characters in the API environment. Without these gates the public form remains unavailable. Inquiries do not promise a trial or admission and are never supplied to sponsors. The site explains its fixed 90-day retention. Persistent Node hosting runs cleanup on startup and hourly; on a host without persistent workers schedule `node apps/api/dist/purge-inquiries.js` at least hourly and monitor `inquiry_retention_failed`. Configure encrypted database disks/backups and expire backups under the club's approved retention policy; application redaction cannot erase historical infrastructure backups.

## Release and rollback

The existing Docker, Railway, Render and other deployment files are retained. Compose passes the optional inquiry secret to the API. No new package dependency was added.

1. Review the changes and approve club content. Back up the target database with the existing backup tooling.
2. Set existing environment variables; add `INQUIRY_RATE_SECRET` only if enabling inquiries.
3. Run `npm run db:migrate`, then `npm run db:seed` against the intended database. Do not run test scripts against production.
4. Build and deploy matching API and web commits using the existing infrastructure. Verify `/api/v1/ready` and all three localized pages.
5. Keep the additive tables/columns on rollback; deploy the previous application version without dropping records. No destructive down migration is supplied.

## Club approval still required

- First League team name, entry, season and roster. The public route only shows a pending section.
- Current first-team/reserve rosters, coaching assignments, future fixtures, verified statistics and any standings. Existing archive players remain accessible on the existing archive routes and are not presented as a verified current squad.
- All academy requirements, age groups, coaches, training sites, timetables, intake state, fees (if any), contact details and privacy wording. New factual editorial translations need club review.
- Sponsor agreements/periods and brand approvals for Eurasia, Integra, ERG, SCAT, Global Coffee and City Hotel. All remain DRAFT. Integra management/ownership is not labelled sponsorship; the supplied Eurasia life-insurance entity needs confirmation.
- Missing standalone World Class Shymkent, ESEN and OLIMPBET assets; three unreadable collage marks require manual identification. Age-restricted brands must never be promoted on youth pages.

See `design-assets/README.md` for the complete verification table, `design-assets/asset-manifest.json` for source hashes, and `docs/REDESIGN_VERIFICATION.md` for executed checks and screenshots.

## Source review map

- Public shell and homepage: `apps/web/components/layout/{Header,HeaderClient,Footer}.tsx`, `apps/web/components/editorial/*`, `apps/web/app/[locale]/page.tsx`, `apps/web/styles/editorial.css`.
- Shared new features: `apps/web/features/{teams,academy,sponsors}/*` and `apps/web/features/club/Achievements.tsx`; new localized routes under `apps/web/app/[locale]/{teams,academy,partners,privacy}`.
- Existing CMS integration: `apps/web/features/admin/Admin.tsx` and `schema.ts`, and all three message dictionaries. Existing player/news/match screens and lifecycle rules remain in place.
- API/data: `apps/api/prisma/schema.prisma`, additive migration, `src/{premium,premium-content,inquiry-retention,purge-inquiries}.ts`, plus extensions to `controllers.ts`, `domain.ts`, `cms.ts`, `storage.ts` and `main.ts`.
- Typed frontend API: `apps/web/lib/api/{types,server}.ts`; localized sitemap and existing about-page anchor IDs.
- Deployment: optional server-only inquiry variable in `.env.example`, `compose.yaml` and `compose.prod.yaml`.
- Verification: `tests/premium.test.ts`, `tests/integration/premium.test.ts`, `tests/e2e/premium.spec.ts`, updated public-navigation E2E and integration runner, and `scripts/redesign-visual.mjs`.
