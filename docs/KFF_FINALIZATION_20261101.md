# FC Ordabasy — CI и подготовка сверки KFF

Дата: 1 ноября 2026. Ветка: `codex/kff-coaches-finalization-20261101`. Архив теперь получен, распакован, все четыре файла прочитаны. Этот документ сохраняет историю исправления исходного CI и backup. Актуальные данные KFF, тренеры и последующая приёмка описаны в [RELEASE_QA_20261101.md](RELEASE_QA_20261101.md), [KFF_ROSTER_IMPORT_2026.md](KFF_ROSTER_IMPORT_2026.md) и [COACHING_STAFF_2026.md](COACHING_STAFF_2026.md).

## Исправления CI

Исходный [Quality run 41294656867](https://github.com/sososu-iwia/prototype/actions/runs/41294656867), коммит `adae46e`, завершился на `npm audit --audit-level=low`. До этого прошли lint, TypeScript, unit, integration, backup/restore и миграции. Build/E2E/Docker были пропущены.

Причина — [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) в minimatch <11.0.1. Аудит обозначал 11 moderate зависимостей, связанных с этим advisory. Коммит `3d55a55` обновляет ESLint до 10.14.0 и typescript-eslint до 8.72.1 и фиксирует minimatch 11.0.1 через overrides. ESLint 10 нужен для совместимого API minimatch; [руководство миграции](https://eslint.org/docs/latest/use/migrate-to-10.0.0) проверено. `npm audit fix --force`, снижение порога аудита и отключение проверок не использовались.

Локально после обновления: npm audit 0 vulnerabilities при пороге low; lint/typecheck PASS; unit 20/20; `npm ci --ignore-scripts --dry-run` PASS. В установленном дереве minimatch только версии 11.0.1. Манифесты и lockfile согласованы.

Промежуточный [run 41297091098](https://github.com/sososu-iwia/prototype/actions/runs/41297091098) прошёл аудит и production build, затем дал **108 PASS / 3 FAIL E2E**. Во всех трёх размерах отсутствовала форма заявки в академию: в CI не был задан `INQUIRY_RATE_SECRET`, и backend правильно скрывал форму, несмотря на включение редакторского флага в тесте. Этот прогон не считается успешным.

Коммит `5522224` добавляет генерацию случайного 32-byte signing key для одного workflow. Ключ маскируется через GitHub Actions и передаётся через `GITHUB_ENV`. Он не хранится в Git и не меняет production-конфигурацию. Приложение продолжает требовать публикацию страницы, privacy notice, редакторский флаг, CSRF и rate limiting.

**Итоговый [run 41297872576](https://github.com/sososu-iwia/prototype/actions/runs/41297872576) — SUCCESS**, точный SHA `552222429884b65d5d71ffb5f24daf586e38827f`, 10:31:38–10:42:42 UTC. Все шаги прошли: unit **20/20**, integration **50/50**, свежие миграции и repeat seed, backup/restore, source scan, npm audit **0**, production build API/Next.js, Chrome E2E **111/111 за 4.5 min**, Compose config и production/release overlay.

Реальный Linux Docker smoke также PASS: production images, PostgreSQL 17, **50/50 контейнерных integration**, **30 публичных маршрутов** KZ/RU/EN, admin CRUD, S3 upload, пересоздание контейнеров с сохранением данных/сессии, backup и изолированный restore. Восстановление дополнительно проверено через фактический API с DML-role: readiness, Unicode профиль, новости, login/logout, отзыв восстановленных сессий и точные S3 bytes. Наличие socket на локальном Mac этим не утверждается.

В CI остались нефатальные annotations: actions/checkout, setup-node и upload-artifact версии v4 декларируют Node 20, но runner принудительно использует Node 24; `ubuntu-latest` имеет объявленную миграцию образа. Это предупреждения, не падения и не скрытые пропуски проверок. Компактные подтверждения: `verification/kff-20261101/{ci-before,ci-intermediate,ci-final,checks}.json`.

## Запрет публичного deployment

В репозитории обнаружены автоматические Vercel deployments предыдущей ветки. Согласно [официальной конфигурации Vercel](https://vercel.com/docs/project-configuration/git-configuration), для новой рабочей ветки `git.deploymentEnabled` установлен в `false` в `vercel.json`, `apps/api/vercel.json` и `apps/web/vercel.json`. Это покрывает корневые директории monorepo-проектов и не меняет другие ветки. После первого push статусы Vercel для нового SHA отсутствовали. Force push, merge в main и публичный deployment не выполнялись.

## Состояние базы до импорта

Read-only запросы к базе из существующего `.env` обнаружили **20 игроков, 20 RosterMembership и 0 StaffMember**. Управляемая команда — `ordabasy`. Применены четыре миграции от 19 октября; `20261024000000_statistics_indexes` и `20261030000000_premium_club` в этой базе ещё не применены. Поля `Team.category` нет. Первая попытка чтения современного поля завершилась ошибкой внутри read-only транзакции; никаких записей не менялось.

До будущих миграций подготовлен закрытый backup: `/private/tmp/ordabasy-kff-backup-HsyVUM/`. Он содержит custom pg_dump исходного PostgreSQL 14 и копию media directory. Размер dump — 65778 bytes; SHA-256 `a042b80768d9bad62488c3d0208ca398a4a5b754f61a57e13fa19d56f7e14752`. Archive TOC успешно прочитан совместимым pg_restore. Затем **этот snapshot реально восстановлен** в уникальную временную БД: совпали количества строк всех **25 таблиц**, а также полные строки **20 игроков и 20 периодов состава**. После проверки удалена только созданная тестовая копия. Исходная БД не менялась. Закрытый read-only снимок строк хранится отдельно вне Git; подтверждение — `verification/kff-20261101/backup-restore.json`.

## Продолжение после получения архива

В отдельную QA-базу PostgreSQL 17 добавлены **10 игроков, 3 подтверждённых тренера и 3 черновика сотрудников**. Существующая пользовательская база PostgreSQL 14 не менялась. Утверждены 12 сезонных записей KFF, 18 оставлены редактору; новых контрактных периодов — 0. История и прежние поля сохранены. Свежие полные проверки и фактический последний CI относятся к последующим коммитам и приведены в RELEASE_QA_20261101.md; предварительный green run выше не выдаётся за финальный KFF CI.
