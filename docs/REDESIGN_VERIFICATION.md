# Redesign verification · 30 October 2026

The redesigned frontend and additive CMS/API changes were verified locally on an isolated PostgreSQL 15 test database. Existing databases and administrator accounts were not modified. No production deployment or remote push was performed.

## Executed checks

| Check | Actual result |
| --- | --- |
| ESLint | PASS, zero warnings |
| TypeScript, both workspaces | PASS; production Next build also checks the final header |
| Unit tests | 19/19 PASS; includes publication gates, sporting identity, inquiry validation, exact birthday/leap-year privacy boundaries and Kazakh glyph coverage |
| Integration tests against compiled API | 50/50 PASS; includes actual PostgreSQL uniqueness, seed idempotence, draft visibility, academy CSRF/RBAC/retention, minor-profile redaction and current/historical roster separation |
| Complete Playwright suite | 81/81 PASS on desktop 1440, tablet 768 and mobile 390; Chrome, one worker |
| Final affected-route browser recheck | 27/27 PASS after the final API roster safeguard |
| Production API and Next.js builds | PASS; existing standalone deployment preserved |
| Fresh migration + repeated seed drill | PASS; retained 20 players, 20 roster memberships, 36 archive matches and 4 articles; repeated seed preserved an edited player |
| Source security pattern scan | PASS; this is not a penetration test |
| npm dependency audit | 0 vulnerabilities |
| Gallery on-demand playback | PASS: readyState 4, 960 × 720 video, no media error |
| Supplied asset integrity | All 9 original SHA-256 values match the reviewed ZIP; original root ZIP untouched; PSG captures excluded |
| Responsive screenshots | PASS: 35 captures and 105 rendered views; no overflow, missing images or page errors |

Intermediate failing browser runs exposed link-font overhead, small-label contrast, decorative-wordmark contrast, a missing CMS header selector, and native modal Tab boundary behavior. These were fixed and the complete 81-test production-browser suite passed. An initial connection failure came from the development API watcher; final checks use the compiled API. No security protection or assertion was disabled to obtain the pass.

## Lighthouse: measured limitation

Twelve sequential cold mobile measurements (three per route), Lighthouse 13.5.0, Chrome, production standalone frontend and compiled API on localhost HTTP/1.1. Browser acceptance and build jobs had finished before this series. No thresholds or throttling were relaxed. The final API roster safeguard affects the new team endpoint; it does not change these measured routes or the frontend build.

| Route | Performance median | LCP median | CLS max | Accessibility | SEO |
| --- | --- | --- | --- | --- | --- |
| `/kk` | 93 | 3.171 s | 0 | 100 | 100 |
| `/kk/team` | 95 | 2.943 s | 0 | 100 | 100 |
| `/kk/matches` | 98 | 2.432 s | 0 | 100 | 100 |
| `/kk/news` | 97 | 2.654 s | 0 | 100 | 100 |

Performance >=90, zero layout shift and automated Accessibility/SEO 100 were achieved on all four measured routes. **The preferred LCP <2.5 s target was not achieved on home, the preserved `/team` route, or news.** The existing strict Lighthouse command therefore exited 1. This is a retained failed performance gate, not a passing check. The new photographic home has a higher local HTTP/1.1 LCP than the older text-led baseline. Test and optimize real production ingress/HTTP2 and field Web Vitals before declaring the LCP goal achieved; this redesign has not been measured on a deployed domain. Raw reports remain in `docs/verification/redesign/lighthouse/run-*`; the compact committed aggregate is linked below.

## Review evidence

- [Design analysis](REDESIGN_DESIGN_ANALYSIS.md)
- [Implementation, changed-file map and release instructions](REDESIGN_IMPLEMENTATION.md)
- [Lighthouse aggregate](verification/redesign/lighthouse/aggregate.json)
- [Desktop before](verification/redesign/before/home-1440.png) · [Desktop after](verification/redesign/after/kk-1440.png)
- [Mobile before](verification/redesign/before/home-390.png) · [Mobile after](verification/redesign/after/kk-390.png)
- [Academy desktop](verification/redesign/after/kk-academy-1440.png) · [Academy mobile](verification/redesign/after/kk-academy-390.png)
- [Sponsor and asset approval table](../design-assets/README.md)
- [Reviewed asset ZIP](../design-assets/ordabasy-design-assets-reviewed.zip)

The 35 full-page screenshots cover seven new/public views at 390, 768, 1024, 1440 and 1920 pixels. Russian and English versions additionally receive overflow checks at all five widths. All captures remain locally available; representative before/after and academy captures are committed. PSG screenshots are private local references only and are ignored by Git.
