# FC Ordabasy redesign · 30 October 2026

## Reference and existing baseline

Reviewed the live https://www.psg.fr/en page and navigation on 30 October 2026, plus the existing Next.js homepage, public API, Prisma models, CMS, roster integrity rules, media pipeline and deployment configuration. Before screenshots are retained under `docs/verification/redesign/before`.

PSG uses an immersive photographic lead story, a restrained header, a distinct fixture rail, editorial card sizes, uppercase athletic typography, repeated media patterns and a broad institutional footer. Its navigation separates teams, facilities and services; the academy is reached through club facilities. Sponsors sit on clear logo surfaces. These are structural principles, not assets to copy. Mobile reflows the editorial hierarchy and collapses navigation into a menu. Motion should support discovery, with no required autoplay.

## Original Ordabasy direction

- Preserve the existing crest, licensed Noto Sans with full Kazakh glyphs and repository photography.
- Navy #07142C / deep navy #030D20, blue #067AB9, cyan #31D5E6, white and muted #B9C7D8. Gold #E7C16A is reserved for honours.
- Photographic hero with bottom-aligned editorial text, quiet rules and ample breathing room. Do not imply the archived hero photograph depicts the 2026 title ceremony.
- Separate fixture information from hero copy. Only verified future fixtures; truthful empty state otherwise.
- Light editorial news section, three independent team destinations, dark stadium honours, academy feature, roster, media and neutral sponsor grid.
- Original line-art SVG trophies; achievement type comes from data, never array position.
- Click/keyboard disclosure navigation, Escape, contained mobile focus, 44px controls, reduced-motion support.
- Shared presentation components and scoped CSS; server components by default. Retain existing APIs and CMS controls, extend PostgreSQL with additive migrations.

## Content release rules

2026 title: https://eurasia.football/en/news-en/ordabasy-kazakhstan-premier-league-champions-2026/ confirms 26 October and the prior 2023 title. The supplied Qazinform URL could not be fetched during this review. Ordabasy M participation: https://kffleague.kz/ru/matches/1536. Do not infer a current First League entry or publish unverified rosters, coach names, academy fees, trial dates or sponsor levels. New academy editorial content remains draft until club review; the public shell clearly explains pending admission information. Inquiry collection requires an explicitly enabled CMS setting and approved privacy/contact information. Existing history is preserved.

## Responsive reference review

Desktop and 390px reference captures are in `design-assets/references/psg-review/` and are excluded from the asset ZIP and public files. At 390px PSG breaks its large lead headline into short lines, maintains the image-led hierarchy and horizontally browses fixture cards; the full navigation is opened with a menu button. Ordabasy uses a native modal drawer with keyboard focus containment and static fixture information. The 2011 cup win was additionally validated against the league's historical final record: https://pfl.kz/kaz/cup_kaz_2011/.
