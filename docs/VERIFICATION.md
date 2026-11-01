> Доработка трёх медиаэлементов от 1 ноября 2026: [партнёры, Hero и видео](MEDIA_UPGRADE_20261101.md). Результаты ниже сохранены как история предыдущих этапов.

# Текущий проверенный результат — 24 октября 2026

Полный актуальный [отчёт A–I](RELEASE_FINALIZATION.md), [exit codes](verification/2026-10-24/checks-final.json), [артефакты](verification/2026-10-24/ARTIFACTS.md). Unit 14/14, integration 41/41 (native/DML/Docker), E2E 57/57 без retries, build/lint/typecheck/security/audit=0/restore/migrations/Compose smoke — PASS после последних изменений приложения. Дополнительно HTTPS production-flags drill 8 групп, 33 SEO pages +25 assertions, 12 public visual shots и admin в трёх размерах.

Lighthouse разделён по транспорту: финальный Caddy/local TLS/H2 — 12 холодных замеров, медианы 2,181/1,915/2,013/1,970 с, CLS0, Accessibility/SEO100; direct native HTTP/1.1 — две страницы выше LCP цели. Неудачные промежуточные результаты сохранены. CODE_COMPLETE относится к проверенному локальному объёму, PRODUCTION_DEPLOYED=false; настоящий DNS/ACME/S3 IAM/VPS, hosted CI и редакционная приёмка ещё не проверены.

---

> Актуальная независимая проверка от 24 октября 2026: [RELEASE_FINALIZATION.md](RELEASE_FINALIZATION.md). Ниже сохранена история 19 октября; её числа не являются результатами текущего релиза.

> Замеры ниже относятся к первичной миграции. Этап Professional CMS: [отчёт](ADMIN_IMPLEMENTATION.md), логи `verification/logs/admin-*`. Lighthouse этого этапа отдельно не перезапускался.

# Проверки выпуска — 19 октября 2026

Проверялась локальная production-сборка, не Netlify. Node 24.11.1, Next.js 16.4.2, React 19.3.1, NestJS 12, Prisma 7.10.1, PostgreSQL отдельной БД `ordabasy_codex_20261019`, системный Chrome через Playwright. Bootstrap/E2E пользователи имеют случайные пароли только в памяти тестов и удаляются после прогона.

## Реальные проверки

- `npm run build`: API (Prisma generate, TypeScript, bundled seed) и Next.js production — проходят. Next работает через `.next/standalone`, API проверялся с реальной PostgreSQL.
- `npm run lint`, `npm run typecheck`: проходят, strict TS и zero warnings.
- `npm test`: **7/7**. Сортировка и per-90/нулевые минуты; DTO/mass assignment; переводные namespace/fallback; полный импорт; физические пути картинок; фактические glyphs Kazakh/Russian/English; timezone/settings.
- `npm run test:integration`: **14/14** с реальной БД. Включает консольный bootstrap ADMIN и запрет перезаписи пароля, login/HttpOnly cookie, CSRF/Origin, RBAC и владение статьёй, player/news/match CRUD, приватность draft, пагинацию, безопасный upload и отказ disguised SVG, audit, logout/revocation. Ранее тест обнаружил пропущенный publication predicate в detail article; он исправлен, повтор прошёл.
- `npm ci --ignore-scripts --dry-run`: manifests и lockfile согласованы. `npm audit --audit-level=low`: **0 vulnerabilities**. Обновлены уязвимые Prisma/Swagger/Sharp/esbuild; peer checks не отключались. `security:scan` — проходит (pattern scan, не pentest).
- `docker compose config --quiet` и production overlay — проходят. **Docker image build/up не выполнены:** установлен CLI, но Docker daemon/socket недоступен. Это ограничение среды, а не успешный контейнерный smoke test. Backup/restore/HTTPS на реальном VPS не выполнялись.
- 12 исходных снимков `docs/baseline` и 12 итоговых `docs/verification`: 1440/768/390 px, главная/about/team/matches. Финальный `browser-issues.json` — пустой: console errors, resource 4xx и horizontal overflow в этих сценариях не обнаружены. Отдельный HTTP-запрос неизвестного профиля возвращает **404**, старые HTML URL — **308**.

## Браузерные сценарии

Playwright содержит 26 E2E на desktop/mobile с kk/ru/en: навигация/меню/Escape, locale сохранение, позиционные фильтры и клавиатурный профиль, матчи, статья, gallery dialog/focus trap/focus restore, 404, login state, полноценный news/player/match CRUD, допустимый/опасный upload, logout и закрытый API после выхода, отдельный frontend при недоступном API, WCAG axe на основных страницах.

Первичные прогоны **не были успешными**. Они выявили: отсутствующий poster, будущую UTC-дату служебной заметки относительно Asia/Almaty, фокус на Tab в native dialog, 200 вместо streamed 404, гонку locale-cookie с prefetch, низкий контраст старых цветов и промежуточной opacity-анимации. Исправления включают scoped loading states, явный focus loop, запрет изменения cookie из prefetch, немедленное сохранение языка и читаемую slide-анимацию без исчезающего текста. Один тестовый selector также ожидал старую таблицу до завершения search; добавлено ожидание отфильтрованной строки.

Итоговый статус E2E и Lighthouse приведён ниже. Все первичные неуспешные прогоны исправлены и повторены.

## Производительность: условия и пределы

Lighthouse использует стандартный mobile preset и simulated throttling, localhost HTTP, production frontend и локальный API/DB. Первые замеры делались одновременно с браузерными тестами и не использованы как итоговые. Выявленный CLS около 0.30 устранён резервированием загрузочной высоты/preload шрифтов; повторный замер показал 0.00.

Последний набор запускается последовательно по четырём страницам отдельно от E2E. Полные JSON в `docs/verification/lighthouse`, итоговые числа — `summary.json`. Это один лабораторный прогон на машине разработчика, не полевая статистика и не гарантия для VPS. INP не измерялся полевым RUM; TBT Lighthouse не выдаётся за INP.

## Непроверенные зависимости

Реальный API-Football key/тариф/лицензия отсутствуют: проверен честный empty fallback без провайдера, но не живой upstream. Актуальность roster, матчей, истории и медиа-права требует редактора. Реального production домена/SMTP/S3 нет; основной вариант хранения — volume на одном VPS.

## Итог функциональных проверок

Последний полный E2E: **26/26**, 40,7 с, без retry. Лог: `docs/verification/logs/e2e.txt`. Окончательные DTO и общий traffic limiter отдельно перепроверены integration-тестами. При совмещённых первых прогонах общий IP-лимит 300/min действительно отклонил допустимый CRUD; для типичного SSR-трафика он поднят до 1000/min, а login 10 неуспешных/15 минут и upload 20/min сохранены. Сообщение о 429 локализовано отдельно от неверного пароля.

Дополнительно выполнена **изолированная production-only установка API** в `/private/tmp`: 284 dependency packages, без Next.js. Скопированные compiled artifacts запустились с Argon2/Sharp/Prisma adapter, `/ready` вернул 200, API прочитал все 20 игроков из PostgreSQL, migration CLI сообщил об отсутствии ожидающих миграций. Это native smoke test на macOS, **не замена Docker/Linux build**. TypeScript остаётся транзитивным peer-инструментом Prisma CLI, а не frontend dependency.

Состояние БД после очистки тестов: 20 игроков, 36 матчей, 4 news (3 draft и 1 служебная заметка), 0 тестовых пользователей. Нового постоянного администратора владелец создаёт собственным паролем по README; проверка bootstrap не оставляет демо-учётных данных.

## Финальный Lighthouse mobile

| Страница | Performance | Accessibility | Best Practices | SEO | LCP, с |   CLS |
| -------- | ----------: | ------------: | -------------: | --: | -----: | ----: |
| /        |          92 |            96 |            100 | 100 |   3.33 | 0.000 |
| /team    |          93 |           100 |            100 | 100 |   3.27 | 0.000 |
| /matches |          95 |           100 |            100 | 100 |   2.94 | 0.000 |
| /news    |          96 |           100 |            100 | 100 |   2.79 | 0.000 |

Целевые пороги Lighthouse (90/95/95/95) достигнуты во всех четырёх отчётах. **Цель LCP <2,5 с в стандартной simulated mobile-среде пока не достигнута:** последний диапазон 2,79–3,33 с. CLS=0; полевой INP не измерялся. Нельзя считать эту работу подтверждением полевых Core Web Vitals или уже проверенным Docker-релизом.

Финальные `seo.json`: 24 URL, 0 ошибок canonical/hreflang/lang/CSP nonce. `browser-issues.json`: 0 console/network/overflow проблем на 12 комбинациях страниц и viewport. Логи build/unit/integration/E2E сохранены в `docs/verification/logs`.


## Последующий этап Professional CMS

Текущие проверки: unit **7/7**, integration **26/26**, E2E **28/28**, TypeScript/lint/build успешны, npm audit 0. Уход/возвращение игрока, сохранность истории, смена номера после reload, права, новый процесс API и S3 protocol fixture проверены. Реальные fresh migrations/repeat seed и PostgreSQL+media backup/restore drills выполнены в отдельных временных базах. Логи `verification/logs/admin-*`, подробности в [ADMIN_IMPLEMENTATION](ADMIN_IMPLEMENTATION.md). Все тестовые аккаунты/объекты удаляются после проверок.
