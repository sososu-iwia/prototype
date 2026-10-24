# FC Ordabasy: проверка и передача 24 октября 2026

Проверяется существующее приложение Next.js/NestJS/Prisma, а не архивный HTML. Ветка `codex/production-hardening-20261024`, исходный HEAD `1251c95`. Исходные незакоммиченные изменения сохранены; автоматического commit/push/deploy не было. Проверки относятся к рабочему дереву, не к опубликованному тегу. Исторические отчёты 19 октября и прежние неудачные прогоны сохранены.

**Статус: локальный функциональный объём CODE_COMPLETE; PRODUCTION_DEPLOYED=false.** Финальные native/Docker/HTTPS проверки завершены, production-ingress Lighthouse gate локально пройден. Прямой HTTP/1.1 preview не проходит LCP на двух страницах и сохранён как FAIL. Реальные VPS/DNS/private S3, публичный ACME, hosted CI и редакционная приёмка остаются непроверенными. Полный внешний Definition of Done не закрыт; «100%» не заявляется.

## A. Что исправлено

| Файлы | Изменение и результат для пользователя |
| --- | --- |
| `apps/api/src/main.ts`, `config.ts` | Безопасные 400/413/415 для JSON parser; no-store на приватных ошибках; точные HTTPS origins и отказ при опечатке storage; явное доверие только настроенному proxy. Просмотр медиатеки больше не расходует upload limit. Временная недоступность медиа — 503/no-store, отсутствующий объект — 404/no-store. |
| `package-lock.json`, `tests/integration/api.test.ts` | Совместимое обновление body-parser до 2.4.0, без обновления всего стека; регрессия с поздними байтами сжатого запроса. Проверено корректное дерево двух совместимых Express-зависимостей. |
| Оба package.json, lockfile, API regression | Multer 2.5.0 для прямого и вложенного Nest пути, fast-uri 3.1.9. Root override устраняет закреплённый Nest Multer 2.4.0 без downgrade фреймворка. Дополнительный тест проверяет физическое разрешение обоих parser-путей в настоящем runtime. |
| `apps/api/src/controllers.ts`, `management.ts` | Защищённое получение актуальной admin-записи по ID для разрешения конфликта. User DTO не раскрывает passwordHash. Существующие SessionGuard/CSRF/RBAC и одна авторизация сохранены. |
| `apps/api/src/controllers.ts`, API regression | Подтверждённая гонка: деактивация во время Argon2 раньше позволяла создать более позднюю сессию (201). Повторная проверка active/version/passwordHash под общей mutation lock перед Session.create теперь возвращает 401 и не создаёт сессию. |
| `apps/web/features/admin/drafts.ts`, `Admin.tsx`, `schema.ts`, переводы | Типизированное объединение локальной формы с актуальной версией; подтверждение при изменении одинакового поля, Cancel сохраняет форму. Кнопки и поля блокируются до окончания сохранения и обновления списка; исправлена воспроизведённая гонка Archive. |
| `Admin.tsx`, E2E conflicts/modules | Отложенный autofocus больше не отбирает уже выбранное поле формы. Контролируемая browser-регрессия фокусирует Citizenship при mount до следующего кадра; прежний код перехватывал фокус и мог терять быстрый ввод, новый сохраняет его. Проверка Tab/Shift+Tab выполняется после штатного начального кадра. |
| `apps/web/styles/app.css`, admin page | Только в админке шапка статична, компактный workspace без перекрытия форм. Общее публичное оформление не заменялось. Полная перепись большого Admin.tsx не выполнялась: отдельно вынесена логика draft/version. |
| `apps/api/src/statistics.ts`, Prisma schema, `20261024000000_statistics_indexes` | Пакетное чтение статистики вместо запроса на каждого игрока; событие соперника не зачисляется клубу при историческом пересечении. Добавлены два индекса, без удаления записей. Сохранены отдельные confirmed/match-derived источники. |
| `apps/api/src/storage.ts` | Точные SQL-проверки ссылок, включая JSON-массивы и варианты изображений, вместо загрузки всех материалов/поиска подстроки. Защита используемого asset и очистка всех unused вариантов проверяются тестами. |
| `Header*`, `Squad*`, `Gallery*`, `PlayerCard.tsx`, root layout | Публичные клиентские компоненты получают только необходимые подписи и поля карточек. Полный словарь и история игрока больше не передаются на клиент ради небольшой карточки. Полный Intl provider сохранён в админке. |
| `next.config.ts`, `proxy.ts`, public E2E | Отключён experimental inlineCss: стандартный внешний stylesheet с тем же content hash кешируется отдельно, не дублируется в HTML/RSC. Для hero team/about/matches/news добавлены ранние HTTP preload hints с media conditions; font/style hints Next сохраняются. Home с текстовым LCP не получает дополнительный высокий image priority. Browser contract проверяет ровно один подходящий размер фона. |
| `scripts/build-critical-media.mjs`, `HeroPreload.tsx`, новые media | AVIF из тех же оригиналов с прежним кадрированием, компактный логотип; совпадающий responsive preload и WebP fallback. Оригиналы, архивный CSS и public legacy.css сохранены. |
| `scripts/build-fonts.mjs`, primary WOFF2/CSS | Preload шрифта уменьшен 48 408 → 25 892 bytes (−46,5%). Сохранены семейство/версия/алфавиты, обычные kerning/ligatures и веса CSS 400–900; старые fallback-файлы остаются. Генератор проверяет точное совпадение outlines и positions контрольных KK/RU/EN строк со старым subset recipe при шести весах (`logs/font-subset.log`). Неиспользуемые opt-in small caps/fractions/alternate digits исключены из primary. |
| `apps/web/styles/app.css`, public E2E | Восстановлено исходное cover/center кадрирование и hover изображений галереи внутри picture: старый селектор direct-child img перестал применяться после responsive markup. Проверяется фактическая высота изображения в карточке. |
| Matches page, `NextMatch.tsx`, `select-next.ts`, app.css | По сравнению с baseline восстановлены мобильный H1 главной (48 px при 390 px) и отдельный блок ближайшего матча под hero. Ближайший матч выбирается только из будущих опубликованных подтверждённых матчей клуба, в том числе выездных; чужой матч не подставляется. Unit проверяет выбор без мутации массива, browser — реальный опубликованный fixture, названия, дату, логотип и axe. |
| `package.json`, оба Dockerfile, test build scripts | Генерация Prisma перед typecheck после npm ci; OpenSSL/CA до установки Prisma, а не только в поздней build-стадии; интеграционные тесты фактического compiled API; последовательные интеграционные наборы. Тайм-ауты приложения не увеличены. |
| `playwright.config.ts`, E2E admin/roles/public | Последовательный браузерный прогон; длинный news/player/match CRUD разделён на три независимых сценария с прежними лимитами. Покрытие сохранено и расширено управлением ролями/геометрией picture. |
| `scripts/verify-backup.mjs`, `verify-migrations.mjs` | И исходный URL, и генерируемые recovery/migration URL проходят assertTestDatabase; новые имена содержат отдельный маркер test. |
| Compose, `infra/runtime-role.sql`, CI | PostgreSQL 17/Unicode locale; production URL ограниченной DML-роли отдельно от migration owner; optional immutable image overlay для отката; собственная изолированная Docker-проверка S3/volumes/restore. Backup/dump исключены из build context. CI сохраняет артефакты и использует Node 24/PG17 client tools. |
| `.dockerignore` | Дополнительно исключены вложенные env, private-key файлы и локальные credential/config каталоги. Реальные секреты и пользовательские настройки не изменялись. |

Исправление body-parser соответствует [официальному advisory Express, CVE-2026-111181](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828). Актуальность остальных зависимостей оценивается результатом audit на дату проверки, не обещанием отсутствия будущих уязвимостей.

Возврат к внешнему CSS соответствует описанным [Next.js ограничениям inlineCss](https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss): большой общий CSS дублировался в initial HTML и RSC. Это изменение доставки, исходный legacy.css не рефакторился. Предварительные A/B замеры из временной копии не заменяют финальные три прогона каждой страницы.

### Матрица функций и воспроизведение недостатков

| Область | Статус / доказательство | Недостаток и воспроизведение |
| --- | --- | --- |
| Чистая установка, API/web build | Автоматизировано: npm ci, typecheck, build | Ранее typecheck после npm ci без Prisma generate падал; устранено pretypecheck. |
| Login/logout, CSRF, роли, сессии | Integration API/CMS + E2E admin/roles | Ранее oversized JSON давал 500: POST `/api/v1/auth/login` с JSON >256 KiB; теперь 413. |
| Игрок, уход/возвращение, история, номер | Integration CMS/integrity + E2E roster | Проверяются активный фиксированный период, отмена будущего плана и новый период без пересечения. Данные вне тестовой БД не менялись. |
| Две вкладки | Unit drafts + E2E conflicts | Открыть одну запись в двух вкладках, сохранить вторую, затем первую: 409; Refresh version сохраняет свои поля и принимает нетронутые удалённые. |
| Save → Archive | E2E admin с остановленным GET списка | Ранее кликабельная кнопка во время reload молча игнорировалась busy-guard; теперь disabled до завершения GET. |
| Новости, медиа | Integration CMS + browser CRUD | Publish/draft/publish сохраняет permalink; JPEG/PNG/WebP, alt KK/RU/EN, отказ SVG, защита variant, очистка unused. Отключение fixture S3 GET теперь даёт 503/no-store и восстановление 200. |
| Матчи/статистика | Integration integrity/CMS | Событие игрока за другую команду не входит в клубные показатели; повторный event key/POST не удваивает данные. |
| Кириллический поиск | Проверен UTF-8/en_US.UTF-8 | В БД с LC_CTYPE=C поиск без регистра не находит казахские/русские имена. Новый volume исправлен; существующий C-volume требует отдельной migration/restore процедуры, автоматической смены locale нет. |
| Public маршруты/языки/SEO/дизайн | E2E, SEO и visual scripts | Точные результаты текущего прогона — B/C. Фото-права и окончательное визуальное согласование остаются у владельца. |
| Backup/restore, Docker PG17/S3 | Native drill и isolated Compose drill | Реальная offsite копия, IAM, TLS и restore у выбранного провайдера заблокированы отсутствием инфраструктуры. |
| CI в GitHub | Workflow подготовлен, локальные эквиваленты проверяются | **IMPLEMENTED_BUT_UNVERIFIED:** workflow на чистом GitHub checkout не запускался, push не выполнялся. |
| API-Football | Fallback проверен | **BLOCKED_BY_PROVIDER:** нет легитимного ключа/тарифа; живая таблица не выдумывается. |

## B. Проверки

Native: macOS, Node 24.11.1/npm 11.6.2, отдельный PostgreSQL 15 на `127.0.0.1:55424`, БД `ordabasy_finalization_utf8_test`, UTF-8/en_US.UTF-8. Системный PostgreSQL пользователя не затрагивался. Docker: Linux arm64, PostgreSQL 17, S3 protocol test service. Все тестовые имена проходят `tests/helpers/test-database.ts`. Реальные секреты, production dumps и аккаунты не включены в доказательства.

Последний native набор выполнен также в чистом source export без исходных node_modules/dist/.next/.env: собственный `npm ci`, миграции и тесты. 369 application/config/test файлов совпали SHA-256 с рабочим деревом (`application-source.json`, `logs/source-export-identity.log`). Это проверка подготовленных исходников, а не GitHub hosted CI на committed checkout. Дополнительно выполнена production-сборка непосредственно в рабочем проекте; браузерные проверки используют её.

Проверки выполнены после последних изменений приложения, включая восстановление baseline и новые регрессии. Полные логи: `verification/2026-10-24/logs/`; машинные exit codes: `verification/2026-10-24/checks-final.json`. Эти тяжёлые артефакты остаются на диске/в CI, Markdown включён в Git.

| Команда | PASS/FAIL/BLOCKED | Количество тестов | Лог/доказательство |
| --- | --- | --- | --- |
| `npm ci` (Node 24.11.1, npm 11.6.2) | PASS, exit 0 | — | `logs/npm-ci-final.log` |
| `npm run lint` | PASS, exit 0 | 0 warnings | `logs/lint-final.log` |
| `npm run typecheck` | PASS, exit 0 | Prisma + API/web | `logs/typecheck-final.log` |
| `npm test` | PASS, exit 0 | 14/14 | `logs/unit-final.log` |
| `npm run test:integration` | PASS, exit 0 | 41/41 | `logs/integration-final.log`; отдельный DML-role прогон |
| `npm run build` | PASS, exit 0 | API + web production; source export и рабочий проект | `logs/build-final.log`, `logs/workspace-build-final.log` |
| `npm run security:scan` | PASS, exit 0 | source checks | `logs/security-scan-final.log` |
| `npm audit --audit-level=low` | PASS, exit 0 | 0 vulnerabilities | `logs/npm-audit-final.log` |
| `npm run test:e2e` | PASS, exit 0 | 57/57, 2,6 мин; без retries | `logs/e2e-final.log`, 3 viewports |
| `npm run test:restore` | PASS, exit 0 | отдельная DB/media recovery | `logs/restore-final.log` |
| `npm run test:migrations` | PASS, exit 0 | fresh migrate + repeat seed + editor preservation | `logs/migrations-final.log` |
| Compose dev/prod/release config | PASS, exit 0 | 3 конфигурации | `logs/compose-config-final.log`, `compose-production-config-final.log`, `release-config-final.log` |
| `caddy validate` в официальном image | PASS, exit 0 | синтаксис с fixture domain | `logs/caddy-config-final.log`; сертификат не выпускался |
| `node scripts/seo-check.mjs` | PASS, exit 0 | 33 страницы | `seo.json`, `logs/seo-final.log` |
| Robots/sitemap/noindex/404/redirect/cookie probe | PASS, exit 0 | 25 assertions; 3 настоящих draft slugs исключены | `seo-extra.json`, `logs/seo-extra-final.log` |
| `node scripts/visual-check.mjs` | PASS, exit 0 | 12 страниц/ширин; 0 browser issues | `browser-issues.json`, PNG, `logs/visual-final.log` |
| Контроль импорта и cleanup | PASS, exit 0 | 1 SQL/filesystem snapshot | `logs/data-final.log`; 0 временных аккаунтов/сессий/uploads/files |
| `node scripts/lighthouse.mjs` (прямой native HTTP/1.1) | FAIL, exit 1 | 12 холодных замеров; LCP gate 2/4 | `lighthouse-http1/`, `logs/lighthouse-final.log` |
| Lighthouse через Caddy HTTPS/H2 (тот же mobile preset) | PASS, exit 0 | 12 холодных замеров; все 4 медианы <2,5 с | `lighthouse-caddy/`, `logs/lighthouse-caddy-final.log` |
| `npm run test:compose` | PASS, exit 0 | 41/41 integration, 30 routes, S3/persistence/DR | `logs/compose-runtime-final.log` |
| Локальный HTTPS production-flags drill | PASS, exit 0 | 8 групп: TLS/Origin/cookie/CSRF/upload/delete/logout | `logs/local-tls-final.log`; собственная CA, не public ACME |
| Docker runtime/client tools/static assets | PASS, exit 0 | PG17.11, parser resolutions, SHA-256 7 файлов | `logs/docker-runtime-versions.log`, `docker-postgres-version.log`, `docker-static-assets-final.log` |
| Настоящие VPS/DNS/S3 IAM/ACME | BLOCKED | — | Нет конфигурации и доступа владельца |
| GitHub hosted CI / provider API | BLOCKED / UNVERIFIED | — | Локальные эквиваленты проверены; live provider без ключа |
| `git diff --check` | PASS, exit 0 | после документации | `logs/diff-check-final.log` |
| Проверка передаваемых доказательств | PASS, exit 0 | 369 source SHA, ссылки, secret patterns, одинаковый preset H1/H2 | `handoff-validation.json`, `application-source.json` |
| Cleanup собственных тестовых ресурсов | PASS, exit 0 | 0 одноразовых containers/volumes; native test PG остановлен | `logs/test-resource-cleanup-final.log` |

Последний Docker smoke полностью завершился exit 0 после исправлений. Linux arm64 images: Node 24.22.1, PostgreSQL server/client 17.11. Установленные Multer 2.5.0/body-parser 2.4.0 проверены и по прямому API, и по вложенному Nest пути. Во время успешного runtime наблюдалось nonfatal предупреждение pg 8.23.1 о queued queries; текущие тесты проходят, совместимость с будущим pg 9 не заявляется. Проблема npm 11.6.2 `ls` описана ниже отдельно и не подменяется статусом audit.

### Сохранённые неуспешные результаты

- Первый native integration: 33/35 на временной БД с LC_CTYPE=C; причина — Unicode case-insensitive search. Повтор создан в другой UTF-8/Unicode БД, исходная БД не пересоздавалась.
- Новый regression login/deactivation до исправления: 201 вместо 401, API-only 18 passed/2 failed (с учётом родительского теста). Лог `session-race-before-fix.log`. После исправления полный integration 40/40 под DML-ролью; перед передачей повторяется общий прогон.
- Расширенный E2E: 47/48, tablet Archive нажимался до завершения reload; исправлены disabled-состояния и добавлено управляемое замедление GET для регрессии. Безопасные screenshot/error-context — `verification/2026-10-24/failures/admin-race/`.
- `npm audit` обнаружил high body-parser 2.3.0; адресно обновлён до 2.4.0. Старый audit сохранён, временные trace с вводом тестового пароля не выдаются как общие артефакты.
- Поздний audit обнаружил high Multer 2.4.0 и moderate fast-uri 3.1.8; прежние нулевые отчёты не заменяли актуальный audit. Прямое обновление Multer оставляло отдельную вложенную копию; полный lockfile исправлен targeted install, все parser resolutions проверяются отдельно. Лог `npm-audit-multer-before-fix.log`, последующие результаты — в B.
- Docker integration с тремя параллельными файлами: login 503 DATABASE_UNAVAILABLE, каскадные 401, на ограниченной Docker VM с чужими работающими проектами. Лог `compose-runtime-parallel-failed.log`; тестовые файлы теперь последовательны, production transaction timeout не увеличен. Чужие контейнеры не останавливались.
- Следующая Docker-установка зависимостей затянулась и была прервана SIGINT (130), а не засчитана как PASS. OpenSSL/CA перенесены до npm ci в обеих deps-стадиях; добавлен вывод версии OpenSSL/lifecycle scripts для диагностики. Сетевой probe движка 1.1 завершился timeout, 3.0 — HTTP 200; это объясняет необходимость корректного target detection, но не доказывает единственную причину всей задержки. Лог `compose-install-interrupted.log` сохранён.
- Повтор Docker завершился `rpc Unavailable/EOF`, затем исчез socket/процессы Docker Desktop. Лог `compose-daemon-eof.log`; это ошибка среды, не успешная проверка новой версии. Добавлен именованный BuildKit cache npm с sharing=locked: скачивания повторно используются, две установки не идут одновременно. Последний retry и его статус фиксируются в B/F.
- Совмещённый E2E на двух workers после последней правки галереи: один длинный CRUD упёрся в общий 60-секундный лимит, 11 passed, 2 interrupted, 37 не запускались. Остановлен для разбиения теста и последовательного повтора; это не успешный полный прогон. Лог `e2e-combined-timeout.log`, screenshot/error-context сохранены, trace с вводом временного пароля не копируется.
- Полный последовательный E2E после обновления зависимостей: 54/57, две проверки focus и мобильный конфликт. Обнаружен deferred autofocus, способный перехватить выбранное поле: первый PUT содержал Initial вместо Local. Контролируемая регрессия до правки также упала. Логи `e2e-focus-failed.log` / `focus-regression-before-fix.log`; исправлен autofocus guard, затем финальный полный прогон 57/57 прошёл.
- Дополнительная проверка дерева через npm 11.6.2 ls возвращает ELSPROBLEMS из-за metadata workspace override; npm 11.19.1 ls того же дерева возвращает 0. Чистый npm 11.6.2 ci, actual parser resolutions и audit проходят. Это диагностическая проблема CLI, не скрытый vulnerable runtime; оба лога сохранены.
- Серии Lighthouse до оптимизации, после AVIF и финальный direct HTTP/1.1 завершились exit 1 из-за LCP; JSON не удалены. Последний Caddy/H2 результат указан отдельно, транспорт не выдаётся за прежний HTTP/1.1.
- После удаления client Intl полная серия дала LCP 2,847 / 2,953 / 2,495 / 2,497 с: первые две страницы не прошли gate (`lighthouse-client/`). Первый уменьшенный шрифт с пересекающимися weight ranges привёл к загрузке ещё трёх старых файлов, ухудшению LCP и небольшому CLS; регрессия сохранена отдельно (`lighthouse-font-weight-regression/`). Исправлено разделением CSS family с сохранением тех же Noto outlines и старых light subsets; новый browser contract проверяет одну фактическую font-загрузку и использование primary на каждом языке/viewport. Финальная серия не подменяется этими промежуточными результатами.
- Первый расширенный visual script не дождался lazy images после быстрой прокрутки (80 ms на viewport). Отдельная диагностика подтвердила успешную загрузку всех реальных файлов при прокрутке к ним; проверка теперь адресно прокручивает к каждому видимому img и ждёт complete. Тайм-аут не увеличен, lazy loading приложения не выключен.

## C. Lighthouse, доступность и публичный дизайн

### Production ingress: Caddy, локальный HTTPS, HTTP/2

Тот же Lighthouse 13.5.0 / Chrome 156 / стандартный mobile simulated preset, CPU slowdown 4, новые Chrome profiles для каждого из 12 последовательных измерений. Использованы финальные production Docker images; 7 ключевых CSS/font/media файлов SHA-256 совпадают с native build. Приоритеты, throttling и важный контент не отключались. В fixture отключён только HTTP/3, чтобы Alt-Svc не указывал неправильный порт при host mapping; фактический Document protocol во всех 12 случаях — `h2`. Внешний публичный HTTPS/HTTP3 ещё не измерен.

Сертификат выпущен одноразовой локальной CA Caddy. Цепочка и hostname сначала проверены Node TLS с rejectUnauthorized=true; Chrome доверял только SPKI этого проверенного leaf через scoped flag. Системное хранилище доверия не менялось. Это лабораторный production-ingress drill, не публичный сертификат ACME. Условия: `lighthouse-caddy/tls-conditions.json`; JSON: `lighthouse-caddy/run-{1,2,3}/`; настоящий trace команды: `lighthouse-caddy/team-trace.json`.

| Страница | 3 холодных LCP, с | Медиана, с | Min–max, с | Performance median (range) | CLS max | Accessibility | SEO | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/kk` | 2,200 / 2,157 / 2,181 | 2,181 | 2,157–2,200 | 99 (99–99) | 0 | 100 | 100 | PASS |
| `/kk/team` | 1,888 / 1,915 / 1,980 | 1,915 | 1,888–1,980 | 100 (99–100) | 0 | 100 | 100 | PASS |
| `/kk/matches` | 2,029 / 1,953 / 2,013 | 2,013 | 1,953–2,029 | 99 (99–99) | 0 | 100 | 100 | PASS |
| `/kk/news` | 1,970 / 1,910 / 2,083 | 1,970 | 1,910–2,083 | 99 (99–100) | 0 | 100 | 100 | PASS |

В локально проверенной release-конфигурации медианы LCP <2,5 с, CLS <=0,1, Performance >=90 выполнены. Смена транспорта и среды существенно влияет на результат: эти числа нельзя приписать одной правке CSS или переносить на ещё не настроенный VPS. Измерение настоящего домена после развёртывания обязательно.

### Direct native preview: HTTP/1.1, сохранённый FAIL

Стандартный mobile preset Lighthouse 13.5.0, Chrome 156, simulated throttling без ослабления, production build, localhost HTTP. Каждый из 12 замеров использует новый Chrome profile; запуски последовательны и отдельно от build/E2E/Docker. На старте load average 5,47 / 5,69 / 10,92; чужие приложения не останавливались. Точные throttling/screen/benchmarkIndex сохранены в `performance-diagnostics.json`. Это лабораторный LCP, не полевая статистика или INP.

Предыдущая серия до изменений: медианы LCP `/` 2,993 с, `/team` 3,524 с, `/matches` 2,794 с, `/news` 2,852 с. После AVIF/compact logo: 2,884 / 3,061 / 2,585 / 2,659 с; CLS 0, Accessibility/SEO 100. Следующие промежуточные серии и неудачная font-weight регрессия сохранены отдельно; они не используются вместо финального результата.

Финальные direct HTTP JSON: `verification/2026-10-24/lighthouse-http1/run-{1,2,3}/`, `aggregate.json`. Время ниже — секунды, округление до 0,001; gate проверяется по исходным миллисекундам.

| Страница | 3 холодных LCP | Медиана | Min–max LCP | Performance median (range) | CLS max | Accessibility | SEO | LCP <2,5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/kk` | 2,597 / 2,538 / 2,557 | 2,557 | 2,538–2,597 | 97 (97–97) | 0 | 100 | 100 | FAIL |
| `/kk/team` | 2,874 / 2,883 / 2,754 | 2,874 | 2,754–2,883 | 95 (95–96) | 0 | 100 | 100 | FAIL |
| `/kk/matches` | 2,391 / 2,439 / 2,364 | 2,391 | 2,364–2,439 | 98 (98–98) | 0 | 100 | 100 | PASS |
| `/kk/news` | 2,302 / 2,301 / 2,315 | 2,302 | 2,301–2,315 | 98 (98–98) | 0 | 100 | 100 | PASS |

**В direct HTTP/1.1 preview gate не закрыт:** главная выше цели на 56,65 ms, команда — на 373,60 ms. Такой preview не эквивалентен production Caddy/H2 выше; его FAIL не скрыт и не объясняется отсутствием внешнего ключа. LCP element главной — hero description, остальных страниц — hero background section. Trace-based insights подтверждают корректное раннее обнаружение/high priority hero, один responsive размер и один primary font; повторная загрузка старых font subsets устранена. Начальная загрузка всё ещё содержит Next/React framework JS и фотографии, выбранные native lazy-loading вблизи viewport. `unused-javascript` оценивает часть framework кода как неиспользуемую; его savings — оценка модели, не обещание доступного ускорения. Точная доля JS/медиа в остаточном моделируемом LCP этим прогоном не отделена: дальнейшая оптимизация самого HTTP/1.1 preview остаётся возможной. У H2 trace сохранены navigation/LCP события и network insights (`lighthouse-caddy/diagnostics.json`). Высокий общий Performance score не заменяет LCP-критерий.

Публичный visual QA: 12 снимков home/about/team/matches, 390/768/1440 px; сравнение с `docs/baseline`. Проверяются изображения после lazy load, console/page errors, resource 4xx, horizontal overflow. Данные/архивные предупреждения закономерно отличаются от старого HTML; pixel identity не заявляется. Архивные `css/`, `js/`, `images/`, HTML и `apps/web/styles/legacy.css` не переписывались.

## D. Проверка админки

Автоматические сценарии сохраняют случайные тестовые аккаунты только на время прогона, затем очищают свои записи:

1. SUPER_ADMIN создаёт ADMIN/EDITOR через форму, EDITOR получает серверный 403, деактивация отзывает его сессию; API проверяет запрет эскалации/самоблокировки. Общего bootstrap-аккаунта не добавлено.
2. Игрок с `Ә Ғ Қ Ң Ө Ұ Ү Һ І`, фото, сезоном/командой/номером появляется после reload; уход закрывает только его период, возвращение создаёт новый номер и сохраняет историю.
3. Фиксированный текущий период и будущий план обрабатываются отдельно; пересечения отклоняет PostgreSQL exclusion constraint с btree_gist, не только UI.
4. Две вкладки дают 409, Cancel оставляет форму, Refresh version объединяет изменения, reload подтверждает итог.
5. Browser CRUD публикует локализованную статью с обложкой и безопасным plain text. Integration скрывает и восстанавливает её по тому же permalink.
6. JPEG/PNG/WebP перекодируются в WebP/AVIF/thumbnail, SVG отвергается, alt на трёх языках сохраняется, referenced variant нельзя удалить, unused variants удаляются.
7. Все видимые модули и формы проверяются при трёх ширинах, Save доступна через focus, overflow не допускается. Снимки admin desktop/tablet/mobile и roster сохраняются рядом с текущей приёмкой.
8. Native/Docker recovery проверяются отдельно от обычного reload; только Docker drill проверяет пересоздание DB/S3/API/web контейнеров без удаления данных между проверками.

Окончательные количества и результат браузерного прогона — в B. Снимки панели сделаны во время E2E и содержат временные fixtures; числа dashboard на них не являются текущим составом клуба. После cleanup импорт отдельно проверяется SQL. Фактическая приёмка владельцем дизайна/текстов/ролей своего персонала ещё требуется.

## E. Безопасность и данные

Одна существующая cookie/session авторизация: HttpOnly/SameSite Strict, Secure для HTTPS, hash токена/CSRF в БД, секреты не в localStorage. RBAC/Origin/If-Match/idempotency/audit выполняются сервером. Proxy headers доверяются только явно заданной сети, публичных портов Postgres/API в Compose нет. Ограниченная runtime-роль не владеет схемой и не может DDL; migration/restore используют отдельного владельца.

Новая индексная миграция additive; ранее подготовленные ограничения состава тоже проверяются свежими миграциями. Перед настоящей миграцией нужен backup и staging restore, на крупной БД CREATE INDEX требует окна обслуживания. Действующие dev/production данные не мигрировались этой проверкой.

Импорт остаётся честным: 20 LEGACY_UNVERIFIED игроков, 36 черновых матчей, 3 старые news drafts, 6 gallery; служебная опубликованная заметка не выдаётся за спортивную новость. Пропущенные голы/передачи не заполнены числами. После финальных 57 E2E cleanup в отдельной тестовой БД: 20 игроков, 20 периодов, 36 матчей, 4 статьи, 6 gallery, 0 временных users/sessions/uploads, 0 физических upload-файлов и 0 выдуманных статистических строк (`logs/data-final.log`). Неподтверждённые текущие факты не публиковались. Это проверка тестового импорта, не сверка настоящей базы владельца.

Backup содержит персональные данные/hash и требует шифрования/offsite хранения. Restore предназначен для другой пустой БД и другого каталога/bucket; восстановленные сессии отзываются, исходные не затрагиваются. После восстановления runtime grants нужно подготовить отдельно, поскольку dump не переносит ACL. Реальный offsite/DR у владельца не выполнен.

Исходные медиа не удалялись; безопасный план архивации — [ARCHIVE_STORAGE.md](ARCHIVE_STORAGE.md). Secret scan/npm audit/axe не заменяют независимый penetration test. Rate limiter пока процессный: несколько API replicas требуют общего хранилища лимитов.

## F. Развёртывание

Локально реально запускались native production API/web (отдельный PG15), затем финальные Linux arm64 production images с PostgreSQL 17.11/client tools 17.11 и Node 24.22.1. Последний `npm run test:compose` прошёл: migration → повторный seed → API readiness → 30 web routes → login, 41 integration tests, Unicode CRUD и S3 upload. DB/S3/API/web пересозданы без удаления volumes; исходная сессия, номер, профиль, новость и bytes фото сохранились. Snapshot восстановлен в другую DB и bucket с DML grants; отдельный восстановленный API реально проверен через login/logout/профиль/медиа, восстановленные сессии отозваны, исходная остаётся действительной. Не используется restore поверх живых данных.

Отдельный HTTPS drill с настоящими production-флагами COOKIE_SECURE=true / ALLOW_LOCAL_HTTP=false прошёл 8 групп проверок через Caddy и ограниченную DML-роль: проверенная локальная TLS chain/hostname, HSTS/CSP, Origin rejection, Secure/HttpOnly/Strict cookie, CSRF rejection, upload/read/delete через S3 fixture, logout/session revocation. Затем выполнены 12 Lighthouse H2 замеров (C). Это S3 protocol fixture и локальная CA, не доказательство реального IAM/публичного ACME. Первый TLS fixture с неверным mapped-port Origin получил ожидаемый 403; исправлен только QA override, production policy не ослаблялась (`local-tls-fixture-origin-failed.log`).

Все созданные одноразовые Docker-проекты/тома и временные приватные TLS файлы удалены после проверок; native тестовые API/web/PG остановлены. Docker Engine и чужие контейнеры/тома не останавливались и не очищались. Тестовая native БД сохранена отдельно от пользовательских данных; её итоговый состав записан в E.

Реальные ACME/DNS/VPS, remote registry, S3 IAM, firewall/monitoring, offsite backup/restore — **BLOCKED_BY_INFRASTRUCTURE**. GitHub hosted CI подготовлен, локальный чистый source export проверен, но hosted workflow не запускался. API-Football — **BLOCKED_BY_PROVIDER**, fallback без ключа проверен.

## G. Честная оценка готовности

- Локальный MVP и проверенный функциональный объём: **CODE_COMPLETE / LOCAL_VERIFIED**. Все применимые функциональные, security, migration/restore, native/Docker и HTTPS проверки финального кода прошли; публичный дизайн сравнен при 390/768/1440 px. Это не обещание отсутствия любых будущих ошибок.
- Локальная release-конфигурация Caddy HTTPS/H2: Lighthouse gate **PASS** по 12 холодным измерениям. Прямой HTTP/1.1 preview сохраняет LCP **FAIL** на главной и составе. Field Web Vitals, реальный домен и HTTP/3 не проверены.
- Публичный production: **NOT_RELEASED / PRODUCTION_DEPLOYED=false**. Полный Definition of Done остаётся открытым до инфраструктуры, hosted CI, редакционной и визуальной приёмки владельца и повторной проверки настоящего домена. Процент «100%» не присваивается.

## H. Что требуется от владельца

1. Подтвердить актуальный состав/сезоны/историю, спортивные источники и права на фото/видео; принять публичный дизайн и переводы на настоящих устройствах.
2. Настроить VPS, DOMAIN/DNS/ACME_EMAIL, HTTPS PUBLIC_ORIGIN/TRUSTED_ORIGINS, firewall, оплату хостинга. Секреты вводить на сервере/в secret manager, не в чат.
3. Подготовить PostgreSQL 17 с Unicode locale/btree_gist, отдельного migration owner и DML API_DATABASE_URL; длинные разные пароли; собственный SUPER_ADMIN через консоль.
4. Создать приватный S3 bucket/endpoint/region и least-privilege IAM GetObject/PutObject/DeleteObject, versioning, шифрованные offsite backups/retention; выполнить recovery drill в отдельные ресурсы.
5. При необходимости подключить легитимный API-Football тариф/ключ. Без него приложение остаётся с честным пустым состоянием таблицы.
6. Запустить подготовленный CI на чистом checkout и зафиксировать проверенный release tag/immutable images перед реальным выпуском.

## I. Точные команды запуска и отката

### Локальная разработка

Node 24; существующий `.env` не перезаписывать. DATABASE_URL должен указывать на выбранную development-базу, не production. Перед миграциями существующей БД сначала snapshot/просмотр SQL/staging drill.

```sh
[ -f .env ] || cp .env.example .env
# Заполните собственные DB/origins/storage параметры в защищённом .env.
npm ci
npm run typecheck
npm run db:migrate
npm run db:seed
npm run dev
```

### Native production preview

Для прямого local HTTP: в `.env` PUBLIC_ORIGIN/TRUSTED_ORIGINS=`http://localhost:3000`, COOKIE_SECURE=false, ALLOW_LOCAL_HTTP=true, MEDIA_STORAGE=local. API_DATABASE_URL для Compose здесь не используется; DATABASE_URL — URL нужной dev/staging БД. Не применяйте эти HTTP-флаги к публичному серверу.

```sh
npm run build
NODE_ENV=production API_HOST=127.0.0.1 ALLOW_LOCAL_HTTP=true npm run start -w apps/api
# В другом терминале:
ALLOW_LOCAL_HTTP=true npm run start -w apps/web
curl --fail http://localhost:4000/api/v1/ready
```

### Local Docker и изолированные проверки

```sh
[ -f .env ] || cp .env.example .env
# Установите собственный POSTGRES_PASSWORD и local origins.
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 migrate api web
# http://localhost:3000/kk
npm run test:compose
```

`test:compose` сам генерирует отдельное имя `ordabasy-test-*`, пароль и ресурсы, удаляет только свои тестовые volumes после проверки. Действующий проект/тома эта команда не использует. Native integration/E2E/restore/migrations требуют отдельного DATABASE_URL с маркером test/codex; E2E дополнительно требует работающие API/web этой же тестовой БД.

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run security:scan
npm audit --audit-level=low
npm run test:restore
npm run test:migrations
npm run test:e2e
VERIFICATION_DIR=docs/verification/my-release node scripts/visual-check.mjs
VERIFICATION_DIR=docs/verification/my-release node scripts/seo-check.mjs
# Измерять intended release ingress; задайте настоящий проверяемый HTTPS origin:
VERIFY_ORIGIN=https://your-owned-domain.example VERIFICATION_DIR=docs/verification/my-release node scripts/lighthouse.mjs
# Прямой HTTP preview измеряется отдельно; его LCP может не пройти gate.
git diff --check
```

### VPS: подготовка и immutable release

Сначала владелец заполняет production `.env` согласно [DEPLOYMENT.md](DEPLOYMENT.md), включая DOMAIN/DNS/ACME_EMAIL, S3, API_DATABASE_URL, COOKIE_SECURE=true, ALLOW_LOCAL_HTTP=false. На первой установке подготовьте runtime-роль до запуска API. Пример для внутреннего PostgreSQL Compose; пароль вводится интерактивно, не в аргументах/логе:

```sh
docker compose up -d db
docker compose exec db sh -c 'createuser -U "$POSTGRES_USER" --pwprompt ordabasy_app'
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v APP_ROLE=ordabasy_app' < infra/runtime-role.sql
# Введите URL ordabasy_app этой же БД в защищённый API_DATABASE_URL.
# Для локальной сборки API_IMAGE/WEB_IMAGE должны быть уникальными тегами.
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml build api migrate web
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml up --no-build -d
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml ps
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml logs --tail=100 migrate api web proxy
# Затем проверка HTTPS /api/v1/ready, /kk, login/logout/CSRF/upload в браузере.
```

Для уже опубликованных образов задайте проверенные registry digest и вместо `build` выполните `docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml pull api migrate web`, затем тот же `up --no-build -d`. Не используйте digest как тег результата локальной сборки. Доступ к registry и соответствие образов проверенному исходному release manifest подтверждает оператор.

Первый SUPER_ADMIN создаётся с собственным паролем по интерактивной инструкции README; bootstrap не заменяет существующий аккаунт. Перед обновлением существующего сервера создайте backup и скопируйте его offsite; пример внутри API:

```sh
docker compose -f compose.yaml -f compose.prod.yaml exec -T api node dist/backup.js create /tmp/release-backup
# Каталог должен быть новым; заберите весь каталог из контейнера и зашифруйте offsite.
```

Сохраните прежние API_IMAGE/WEB_IMAGE и защищённую конфигурацию. Откат приложения возможен только на проверенный совместимый image: он должен учитывать `cancelled` периода и `teamId` статистики из roster_integrity. API до этой логики может неверно показывать отменённые планы даже при совместимом SQL. Сам откат на VPS здесь не выполнялся. Для совместимого image:

```sh
# Верните предыдущие API_IMAGE/WEB_IMAGE из release manifest.
docker compose -f compose.yaml -f compose.prod.yaml -f compose.release.yaml up --no-build --no-deps -d api web
# Повторите readiness + browser smoke. Миграции и DB volumes не откатывайте удалением.
```

Checklist: backup/checksums/offsite → staging restore отдельными DB/bucket → review SQL → images/config → migrate exit 0 → /ready → HTTPS cookie/Origin/login → roster/news/media → мониторинг и возраст backup. Для несовместимой схемы нужен согласованный restore в другие ресурсы и переключение после проверки; не restore поверх live и не reset/down -v.

Диагностика: Prisma missing после npm ci → `npm run typecheck`; connection refused → `compose ps/logs`, правильный DATABASE_URL; кириллица не находится → SHOW lc_ctype/encoding, новая Unicode БД + drill; 403 write → точные Origin/CSRF/cookie; 409 → Refresh version; 503 media → S3 endpoint/IAM/bucket/ready, не удаление ссылок; TLS не выпускается → DNS/80/443/ACME_EMAIL. Подробности и ограничения — [SECURITY](SECURITY.md), [ADMIN_GUIDE](ADMIN_GUIDE.md).
