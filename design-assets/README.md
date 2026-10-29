# FC Ordabasy design assets

Inventory reviewed on 30 October 2026 (Asia/Almaty). All nine originals supplied in the root `ordabasy-design-assets.zip` were extracted without altering their bytes. The root ZIP is preserved. No PSG assets are included in the reviewed ZIP or public application. Separate desktop/mobile screenshots in `references/psg-review/` are private review evidence only and are excluded from the ZIP.

`references/` contains the supplied achievements screenshot and sponsor collage, for private design reference only. They are not served by Next.js. `sponsors/` contains seven individual original logo files. `club/` is reserved for newly approved club originals; the existing club photography and logo remain in their existing project locations.

Optimized WebP derivatives are in `apps/web/public/media/sponsors/`. They preserve aspect ratio, colors, and transparency where present, use no enlargement and no cropping, and fit within 640 × 320 pixels. The public grid must use a white surface and `object-fit: contain`. Do not infer publication or a partnership from the existence of a logo file.

## Sponsor verification and approvals

A supplied logo authorizes its preparation for the requested redesign. It is not independent evidence of a current sponsorship or formal partner brand approval. The club should confirm the contractual period, exact legal entity, branding permission, and any tier before publication. No tiers have been invented. The dates below record evidence, not inferred contract end dates.

| Company | Image available | Official partnership verified | Logo approved | Action needed |
| --- | --- | --- | --- | --- |
| Bank RBK | `IMG_5658.png`, 1280 × 631 PNG with alpha | Yes, 2026 partnership documented by a bank-attributed public announcement [1], corroborated by a season-specific report [2] | User supplied for this redesign; formal partner sign-off not supplied | Eligible for publication following existing CMS verification rules; confirm validity dates and brand sign-off. No tier asserted. |
| Eurasia | `IMG_5660.webp`, 1600 × 900 WebP with alpha | Not individually verified. Secondary reports mention an insurer, but this asset specifically says **life insurance company** | User supplied; formal sign-off not supplied | Keep DRAFT. Confirm exact legal entity, current agreement and whether this life-insurance logo is the intended partner. |
| Integra Construction | `IMG_5664.png` is actually JPEG, 242 × 84 | Official club announcement confirms a private-management/privatization memorandum [3], which does **not** establish sponsorship | User supplied; formal sign-off not supplied | Keep DRAFT as sponsor. Confirm relationship and obtain higher-resolution official logo if larger rendering is required. |
| ERG | `IMG_5665.png` is actually JPEG, 300 × 141 | A 24 June 2026 report explicitly documents the club partnership memorandum and links the original club Instagram announcement [4]. Original Instagram could not be fetched [5] | User supplied; formal sign-off not supplied | Keep DRAFT until club administrator approves the source/period and logo. Report supports partnership, but contract duration and independent original-source access remain unresolved. |
| SCAT Airlines | `IMG_5666.webp` is actually JPEG, 1280 × 277 | No completed official agreement verified; July report says a deal **will** be signed [6] | User supplied; formal sign-off not supplied | Keep DRAFT. Obtain the completed announcement/agreement and validity period. |
| Global Coffee | `IMG_5672.png` is actually JPEG, 224 × 224 | Not verified in reviewed announcements | User supplied; formal sign-off not supplied | Keep DRAFT. Club must supply current agreement, approved destination URL, and higher-resolution logo if necessary. |
| City Hotel | `IMG_5673.png`, 447 × 447 PNG | Not verified in reviewed announcements | User supplied; formal sign-off not supplied | Keep DRAFT. Confirm the exact hotel/legal entity and current agreement. |
| World Class Shymkent | Visible in collage; no individual image | Not verified | No individual asset/sign-off | Create DRAFT CMS placeholder with no public logo. Club supplies approved asset and current agreement. |
| ESEN | Readable in collage; no individual image | Not verified | No individual asset/sign-off | Create DRAFT CMS placeholder; confirm exact legal entity and supply approved asset/agreement. |
| OLIMPBET | Readable in collage; no individual image | Current 2026 agreement not verified | No individual asset/sign-off | Keep DRAFT, request current documentation; exclude any age-restricted promotion from academy/youth pages. |
| Other collage logo, lower row after City Hotel | Individual image missing; lettering cannot be read confidently | Not verified | No | Manual brand identification required. Do not guess the name. |
| Other collage logo, lower row between the orange wordmark and circular logo | Individual image missing; lettering cannot be read confidently | Not verified | No | Manual brand identification required. Do not guess the name. |
| Other collage circular logo, lower row before World Class | Individual image missing; lettering cannot be read confidently | Not verified | No | Manual brand identification required. Do not guess the name. |

Absence of a found announcement is not proof that no partnership exists. It means the public CMS record must stay DRAFT until the club provides evidence.

## Sources

1. [Bank RBK-attributed announcement, Tengrinews, 14 September 2026](https://tengrinews.kz/kazakhstan_news/pervoy-raketki-mira-7-500-begunov-kakie-sportivnyie-608459/amp/). Identifies FC Ordabasy as the bank's partner. Reviewed as a legitimate partner statement carried by a publisher; the notice identifies it as advertising material. Its unrelated sporting assertions were not imported.
2. [Bank RBK 2026 season partnership, Finratings](https://finratings.kz/news/12779-bank-rbk-stal-partnerom-fk-ordabasy-na-sezon-2026/). Supports the season, without establishing contract start/end dates or a tier.
3. [FC Ordabasy official private-management memorandum, 16 February 2026](https://fcordabasy.kz/ru/blog/ordabasy-fk-klubty-zekemensik-basqaruga-kosiru-turaly-memorandumga-qol-qoidy). Relationship evidence only; not a sponsorship announcement.
4. [ERG partnership report linking club announcement, Sportarena, 24 June 2026](https://sportarena.kz/football/1057057-prezident-ordabasy-kyzaybaev-i-gendirektor-ERG-shamiev-podpisali-soglashenie-o-partnrstve.html).
5. [Original club Instagram post linked by source 4](https://www.instagram.com/p/DZ7OY7zDpbs/). Link discovered, but content not independently retrieved in this audit.
6. [SCAT prospective partnership report, 22 July 2026](https://asnews.kz/ru/kpl/4497-novyi-sponsor-dlya-ordabasy-shymkentskii-klub-podpishet-kontrakt-s-aviakompaniei-scat/). Describes a future deal; insufficient to publish SCAT as a current sponsor.

## Packaging and verification

`asset-manifest.json` records detected MIME types (including misleading extensions), dimensions, original SHA-256 hashes, provenance, alt text, derivatives, and publication gates. `ordabasy-design-assets-reviewed.zip` includes these originals, references, documentation, and optimized derivatives. It is a new archive and does not replace the user's original ZIP.

The original logos for Integra (242 × 84), ERG (300 × 141), and Global Coffee (224 × 224) have limited resolution. No replacement or invented logo was downloaded. Use compact grid rendering or request authorized vector/high-resolution assets.

The 2026 Bank RBK row is seeded as a public, user-supplied logo supported by the documented seasonal partnership. Its year-end date is a conservative website expiry, not a claim about an undisclosed contract end date. Other rows and missing-logo placeholders stay DRAFT. Formal branding approval and exact contractual dates remain club responsibilities.
