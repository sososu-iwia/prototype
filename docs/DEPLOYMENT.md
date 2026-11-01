# VPS, домен и восстановление

Последняя проверка текущей ветки и ограничения production: [FINAL_VISUAL_QA.md](FINAL_VISUAL_QA.md). Числа следующего абзаца относятся к архивному этапу 24 октября.

Статус проверки 24 октября 2026: финальный native production запуск, чистый source export, Linux arm64 Docker build/PG17.11/S3/persistence/отдельный recovery API и local HTTPS production-flags drill прошли. Node Docker 24.22.1, native 24.11.1. Все 12 cold Lighthouse замеров через Caddy/H2 проходят локальный gate; direct HTTP/1.1 не проходит LCP на двух страницах. Ранее зафиксированные сбои daemon/build не удалены, но последний повтор — PASS. Полные команды, результаты и границы — [RELEASE_FINALIZATION.md](RELEASE_FINALIZATION.md). Реальные VPS/DNS/private S3 IAM/публичный ACME не предоставлены и не объявляются работающими. После проверки собственные одноразовые ресурсы удалены, пользовательские данные/контейнеры сохранены.

Для кириллического/казахского поиска нужны UTF-8 и Unicode `LC_CTYPE`, например `en_US.UTF-8`; locale `C` не выполняет такое сравнение без учёта регистра. Новый Compose volume инициализируется с `--encoding=UTF8 --locale=en_US.utf8`. Это не меняет locale существующей БД. Проверьте её перед релизом: `SHOW server_encoding; SHOW lc_ctype; SHOW lc_collate;`. Для смены locale нужна отдельная БД и проверенный dump/restore, без reset текущего volume.

После свежей установки `npm run typecheck` автоматически генерирует Prisma Client. До production-миграций создайте backup, просмотрите SQL и выполните миграции на восстановленной staging-копии. Новая `20261024000000_statistics_indexes` добавляет только два индекса; на большой базе обычный CREATE INDEX требует окна обслуживания. Предыдущий API совместим с этими индексами, удалять их при откате приложения не нужно.

В рабочем дереве также есть ранее подготовленная `20261019030000_roster_integrity`: добавляет `cancelled` периода и nullable `teamId` матчевой статистики, заполняет teamId только при однозначном составе, пересоздаёт exclusion constraint и добавляет NOT VALID check для новых записей. Старые аномалии не удаляются. План перед обновлением существующей БД: сохранить snapshot → восстановить в отдельные DB/bucket → просмотреть pending SQL/`prisma migrate status` → применить на staging → проверить неоднозначные teamId/историю состава и API → запланировать окно блокировок/индексов → повторить backup непосредственно перед release. На реальной базе этот план ещё не выполнялся.

Граница отката: предыдущий image должен понимать `cancelled`/`teamId` и быть проверен на новой схеме. Одной совместимости SQL недостаточно: API до roster_integrity может считать отменённый будущий период действующим. Откат на такой image не заявляется безопасным; нужен проверенный совместимый image либо отдельная согласованная процедура восстановления в новые ресурсы. Не удаляйте столбцы/миграции или рабочие volumes ради отката.

Production overlay задаёт `TRUST_PROXY_CIDRS=uniquelocal`: API доверяет приватной сети Compose, а Caddy заменяет присланные клиентом forwarding headers. Не публикуйте порт API и не подключайте недоверенные контейнеры в эту сеть. При другом proxy задайте только его фактические адреса/CIDR. Без настройки API игнорирует X-Forwarded-For. Для прямого локального preview можно задать `API_HOST=127.0.0.1`.

## Отдельная роль API в production

`compose.prod.yaml` требует `API_DATABASE_URL`: тот же экземпляр и база PostgreSQL, что у migration job, но отдельная LOGIN-роль API без SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS и без владения схемой. `POSTGRES_USER` остаётся владельцем миграций. URL и пароль владелец вводит через защищённую `.env`/secret manager, не через чат. Development Compose и одноразовые fixtures используют bootstrap-роль только в локальной изолированной среде.

Создайте роль интерактивной командой `createuser --pwprompt` через DBA; затем подключитесь **владельцем миграций** к нужной базе и выполните `psql <owner-connection> -v APP_ROLE=ordabasy_app -f infra/runtime-role.sql`. Скрипт не создаёт пароль, не удаляет данные; выдаёт DML и default grants для будущих таблиц этого владельца, отзывает CREATE в public у PUBLIC/приложения. Просмотрите его перед применением к существующей базе. Для первого запуска можно поднять только `db`, создать роль/default grants, затем запустить migration job и остальные сервисы. Если таблицы уже созданы, скрипт выдаёт права и на них.

Проверьте под runtime URL: `SELECT current_user,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user;` — все четыре флага должны быть false. API не должен выполнять миграции или создавать recovery-базы; restore использует отдельный заранее подготовленный owner URL. В текущей временной БД DML-only роль прошла 41 integration-тест, а CREATE TABLE был отклонён с 42501. Реальную production-роль ещё должен настроить и проверить оператор.

## Первый запуск

PostgreSQL должен поддерживать `btree_gist` (миграция создаёт расширение для запрета пересечений состава); на managed PostgreSQL заранее предоставьте это право или включите расширение через DBA.

Linux VPS с Docker Engine/Compose v2, DNS A/AAAA на VPS, открытые 80/443 (и SSH только оператору). Требуемая память зависит от сборки Next.js; разумно выделить не менее 2–4 GiB плюс swap. Docker build не должен получать `.env` или originals. Сохраняйте package-lock.json.

```sh
[ -f .env ] || cp .env.example .env
# POSTGRES_PASSWORD: случайный URL-safe пароль; DOMAIN, ACME_EMAIL — ваши.
# PUBLIC_ORIGIN=https://ваш-домен
# TRUSTED_ORIGINS=https://ваш-домен
# COOKIE_SECURE=true
# ALLOW_LOCAL_HTTP=false
# MEDIA_STORAGE=s3; S3_BUCKET, S3_REGION и при необходимости S3_ENDPOINT/credentials
# API_DATABASE_URL: DML-роль, подготовленная по предыдущему разделу в этой же БД
docker compose -f compose.yaml -f compose.prod.yaml config --quiet
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
docker compose logs migrate
docker compose ps
```

Compose пароль должен быть URL-safe (например hex), поскольку DATABASE_URL собирается из переменных. Для внешнего Postgres используйте полный URL с корректным URL-encoding и проверкой сертификата; не отключайте TLS verification. `DATABASE_URL` в корневом `.env` используется для локальной разработки, внутри основного Compose URL указывает на `db`.

Caddy получает Let's Encrypt сертификат после правильного DNS и доступности 80/443. Его `/data` и `/config` сохраняются. API и PostgreSQL не публикуются на host. Порт frontend привязан только к loopback для диагностики; публичный трафик идёт через Caddy. Миграции и первый seed завершаются до startup API. Дальнейший startup не перезаписывает редактуру.

Создайте администратора по команде README. Уберите переменные с bootstrap-паролем из shell после создания. В production Swagger UI выключен; OpenAPI JSON доступен без секретов.

## Медиа

Исходные оптимизированные медиа включены в image web. Development upload сохраняются в named volume `media_data`, отдельно от слоя контейнера. Production override принудительно включает `MEDIA_STORAGE=s3` и требует `S3_BUCKET`: отдельный приватный S3/S3-compatible bucket, не файловая система image. Настройте регион, optional endpoint/path-style, IAM workload role или backend-only credentials с минимальными GetObject/PutObject/DeleteObject. Bucket versioning и независимый offsite backup включаются у выбранного провайдера. Клиенты получают `/uploads/UUID` через API; CORS/public ACL bucket не нужны.

Существующие local uploads перенесите после backup: `MEDIA_STORAGE=s3 npm run media:migrate-storage` (либо `node dist/migrate-media.js` внутри API с S3 env). Команда загружает все варианты, транзакционно переключает metadata, сохраняет локальные копии для отката и пишет аудит. Новые upload генерируют WebP, AVIF и миниатюру. Нельзя удалять asset, на который ссылается любой материал, включая черновики/архив. На нескольких replicas S3 общий, PostgreSQL lock общий; процессный rate limiter необходимо заменить распределённым.

## Проверка

```sh
curl --fail https://ваш-домен/api/v1/health
curl --fail https://ваш-домен/api/v1/ready
curl --fail -I https://ваш-домен/kk
curl --fail -I https://ваш-домен/team.html
docker compose logs --tail=100 api web
```

Проверьте cookie Secure/HttpOnly/SameSite в браузере, login/logout, создание черновика и публикацию. Наличие 200 health не заменяет `/ready` (проверяет БД). Настройте мониторинг 5xx, backup, свободного места и возраста последнего standings snapshot. Внешний provider без ключа возвращает честное пустое состояние.

## Backup и restore

`apps/api/src/backup.ts` использует `pg_dump/pg_restore` версии 17 или совместимой с сервером. API image содержит PostgreSQL 17 tools; локально установите их в PATH. Snapshot PostgreSQL экспортируется под блокировкой content mutations, поэтому DB и ссылки на неизменяемые изображения согласованы. Backup содержит database.dump, media/ и SHA-256 manifest. Права каталога 700, файлов 600; он содержит password hashes и персональные данные, храните зашифрованно вне VPS.

Локальный checkout с действующим `.env`:

```sh
npm run backup:create -- /absolute/new-backup-directory
# RESTORE_DATABASE_URL: ДРУГАЯ заранее созданная пустая PostgreSQL-база.
# RESTORE_MEDIA_DIR: ДРУГОЙ пустой каталог (для local restore).
# Для S3 restore: MEDIA_STORAGE=s3 и отдельный RESTORE_S3_BUCKET, отличающийся от live S3_BUCKET.
npm run backup:restore -- /absolute/new-backup-directory
```

Restore проверяет checksums до изменений и отказывается писать в действующую/непустую БД, текущий media-dir или live bucket. Восстанавливает schema+data одной PostgreSQL-транзакцией, копирует медиа, переключает storage metadata и отзывает восстановленные сессии. Запустите **отдельный** API с восстановленной DATABASE_URL/MEDIA_DIR или S3_BUCKET=RESTORE_S3_BUCKET; проверьте `/ready`, профили, статьи и изображения. Переключение действующего трафика выполняйте только после проверки.

Dump намеренно не переносит ACL и владение исходного сервера. До restore подготовьте LOGIN-роль recovery API и выполните `infra/runtime-role.sql` в пустой целевой БД от имени владельца, который выполнит restore: default privileges дадут этой роли DML на восстановленные таблицы. Сам restore подключается owner URL, последующая проверка API — ограниченным runtime URL. Не выдавайте API CREATEDB ради восстановления.

В Docker создайте backup в `/tmp/<unique-directory>` через `docker compose -f compose.yaml -f compose.prod.yaml exec -T api node dist/backup.js create /tmp/<unique-directory>`, затем заберите весь каталог `docker cp` из API-контейнера, установите права 600 и перенесите offsite. Для restore передайте `RESTORE_DATABASE_URL`/`RESTORE_S3_BUCKET` через окружение в отдельную recovery-среду, скопируйте каталог внутрь и выполните `node dist/backup.js restore /tmp/<backup-directory>`. Не запускайте restore поверх live volumes и не используйте `down -v`.

Автоматизируйте создание backup системным таймером/cron с секретами из защищённого env и уведомлением об ошибках. Пример для отдельного backup-хоста с настроенными `.env` и инструментами: `0 2 * * * cd /srv/ordabasy && /usr/bin/npm run backup:create -- /srv/backups/ordabasy-$(date +\%Y\%m\%d-\%H\%M)`. Политику хранения/шифрования и вынос offsite настройте у выбранного хостинга; очистку live data этим заданием не выполняйте.

`npm run test:restore` — выполненный локальный drill: создаёт временную отдельную БД, восстанавливает backup, сравнивает записи, казахский текст и байты настоящего изображения, удаляет только свои тестовые ресурсы. Production DR в реальном S3/на VPS требует отдельного прогона с реальными учётными данными.

## Релизы и откат

Для фиксированных тегов/дигестов добавлен optional `compose.release.yaml`: `API_IMAGE` используется API и migration job, `WEB_IMAGE` — frontend. Сначала соберите/загрузите эти образы, затем запускайте `up --no-build`; при откате берите сохранённые предыдущие значения. Пошаговые команды находятся в разделе I [RELEASE_FINALIZATION.md](RELEASE_FINALIZATION.md). Конфигурация overlay проверяется отдельно от runtime основных образов; remote registry и реальный rollback на VPS ещё не проверены.

Перед обновлением сделайте backup БД/медиа, сохраните предыдущие images/tags и `.env` вне git. Разворачивайте immutable release tag, просматривайте SQL migration. Обычные schema changes должны быть обратносовместимыми (expand/contract), чтобы предыдущий API мог работать после отката web/API. После `up --build -d` проверьте migrate exit=0, `/ready` и основные браузерные сценарии. Не откатывайте БД простым удалением миграций: для несовместимого изменения требуется новый исправляющий SQL либо восстановление проверенного backup с согласованной версией приложения.

## Netlify

Исходный Netlify URL — только визуальный референс. Один static deploy не поднимает NestJS/PostgreSQL/volumes. Вариант разделённого размещения: Next.js с поддерживаемым Netlify adapter, отдельный HTTPS API+DB на VPS и persistent media; build-time `API_INTERNAL_URL` должен указывать на этот API для rewrites, runtime — тот же адрес для SSR. Браузерные API-запросы остаются same-origin через proxy, включая Set-Cookie/CSRF; не переносите токены в localStorage. Этот вариант документирован, **не развёрнут и не проверен**. Основной сценарий — VPS Compose.


## Проверка HTTPS и диагностика

Production overlay вычисляет точный PUBLIC_ORIGIN/TRUSTED_ORIGINS как `https://${DOMAIN}`. При иной схеме ingress проверьте фактический Origin целиком, включая нестандартный порт. Локальный QA mapped-port override относится только к тестовой fixture; runtime Origin/CSRF проверки не отключайте. Для настоящего публичного сертификата DNS и ACME должны действительно работать; локальный CA drill их не заменяет.

После выкладки: `VERIFY_ORIGIN=https://ваш-домен VERIFICATION_DIR=docs/verification/your-release node scripts/lighthouse.mjs` (3 холодных замера каждой из четырёх страниц, стандартный mobile preset). Используйте настоящий HTTPS origin intended ingress, сохраняйте JSON и сравнивайте условия/протокол. Локальные числа нельзя гарантировать для неизвестного VPS.

| Симптом | Проверка и действие |
| --- | --- |
| Docker socket/EOF | Проверить Engine/Compose и свободную память; не удалять volumes и не останавливать чужие проекты. Повторить изолированный smoke после восстановления среды. |
| API not ready | `compose ps`, `logs migrate api db`; проверить migrate exit 0, URL той же БД, DML grants/default privileges. |
| Prisma Client отсутствует | `npm run typecheck` генерирует client; убедиться в Node24 и npm ci из lockfile. |
| Казахское имя не находится | `SHOW server_encoding; SHOW lc_ctype;` — нужна Unicode locale. Смена locale через отдельную БД и восстановление, без reset. |
| 403 write/login | Проверить точные Origin/порт, Secure-cookie и CSRF; не ослаблять server guard. |
| 409 update | В админке Refresh version/сравнение формы; старую версию не перезаписывать молча. |
| 503 media | Проверить endpoint/bucket/IAM, API readiness/логи; не удалять ссылки на существующие файлы. |
| pg_dump version mismatch | Использовать клиент PostgreSQL17 из API image для PG17; проверить server/client версии до backup. |
| ACME/TLS error | Проверить DNS A/AAAA, 80/443, DOMAIN/ACME_EMAIL и логи proxy; внешняя TLS-проверка обязательна. |
