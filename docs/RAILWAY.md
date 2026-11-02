# FC Ordabasy: Railway

Это инструкция подготовки, а не подтверждение работающего deployment. На 25.10.2026 в аккаунте Railway отображался `Trial expired`. Оплата, новые облачные ресурсы, домены и production-переменные в ходе подготовки не создавались.

## 1. Доступ и стоимость

Владелец восстанавливает подписку в Dashboard → Settings → Plans. Hobby стоит $5/месяц с $5 включённого использования; нагрузка сверх включённого оплачивается отдельно. Это не оценка итогового счёта приложения. Перед созданием ресурсов согласуйте месячный бюджет и настройте Usage Limits. [Тарифы Railway](https://docs.railway.com/pricing/plans).

Создайте отдельный проект `FC Ordabasy`, environment `production`, либо явно выберите существующий. Найденный `strong-delight` нельзя считать проектом клуба без проверки его сервисов. Не импортируйте Compose целиком: он содержит локальную инфраструктуру и тестовые настройки.

## 2. База и Bucket

Добавьте `Postgres` с постоянным volume; проверьте фактическую major-версию 17 и поддержку расширений из `apps/api/prisma/migrations` (включая `btree_gist`). Существующему volume нельзя менять major-версию простым переключением image. До первого init задайте UTF-8 и Unicode locale; переменные init не меняют locale существующей БД. В SQL проверьте:

```sql
SELECT version();
SHOW server_encoding;
SELECT datcollate, datctype FROM pg_database WHERE datname = current_database();
SELECT lower('ОРДАБАСЫ'), lower('ҚАЗАҚСТАН');
```

Оставьте соединение приватным. Используйте `DATABASE_URL`, а не `DATABASE_PUBLIC_URL`. [PostgreSQL Railway](https://docs.railway.com/databases/postgresql).

Добавьте приватный Bucket `media` в выбранном регионе. API уже отдаёт изображения через `/uploads`; публичный Bucket не нужен. Для новых Buckets обычно `S3_FORCE_PATH_STYLE=false`; значение нужно проверить во вкладке Credentials конкретного Bucket. Старые Buckets могут требовать `true`. [Подключение и URL style](https://docs.railway.com/storage-buckets).

## 3. Две роли PostgreSQL

В приватной консоли БД создайте LOGIN `ordabasy_app` без SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS. Пароль вводится интерактивно через `\password ordabasy_app`; не помещайте его в SQL-файл, Git, командную строку или чат. Сохраните тот же URL-safe пароль как закрытую переменную `APP_DB_PASSWORD` сервиса Postgres, `APP_DB_USER=ordabasy_app`.

Выполните `infra/runtime-role.sql` от имени владельца схемы с `APP_ROLE=ordabasy_app`. Этот файл можно выполнить до первого migrate: ALTER DEFAULT PRIVILEGES даст DML на будущие таблицы. Migration role должна совпадать с владельцем этих default privileges. Pre-deploy runner после migrate оставляет runtime-роли только SELECT на `_prisma_migrations`: существующий backup может прочитать журнал, а API не может его изменить. Runtime API не должен иметь DDL-права или владеть таблицами.

URL миграций и runtime должны указывать на один hostname, порт, database и schema, но содержать разные роли. Новый pre-deploy runner проверяет это до выполнения миграций.

## 4. Источник и сборка

Создайте два сервиса из `sososu-iwia/prototype`, ветка `main`, root directory `/`. До первого deploy заполните переменные. Для каждого сервиса задайте его Dockerfile через `RAILWAY_DOCKERFILE_PATH`:

| Настройка | web | api |
| --- | --- | --- |
| Dockerfile | `Dockerfile.web` | `Dockerfile.api` |
| PORT | `3000` | `4000` |
| Start command | штатный CMD Dockerfile | штатный CMD Dockerfile |
| Healthcheck | `/api/v1/ready` | `/api/v1/ready` |
| Pre-deploy command | пусто | `node railway-predeploy.mjs` |
| Public domain | Generate Domain, target port 3000 | не создавать |
| Replicas для первого запуска | 1 | 1 |

У API выставьте `API_HOST=0.0.0.0`. Новые Railway environments имеют private IPv4/IPv6; для старого IPv6-only environment понадобится dual-stack `API_HOST=::` и проверка доступности из web.

`API_INTERNAL_URL` объявлен как Docker ARG в build stage web: Railway передаёт туда одноимённую service variable. Это исправляет адрес, сериализуемый Next.js в rewrites. При смене адреса API нужен **rebuild web**, простого restart недостаточно. Docker Compose сохраняет default `http://api:4000/api/v1`. [Docker build arguments Railway](https://docs.railway.com/builds/dockerfiles).

Новые `railway.json`/`railway.toml` не добавлены: текущая документация отмечает Config as Code как deprecated и недоступный для новых сервисов. Настройки выше задаются в Dashboard. IaC можно отдельно импортировать после выбора проекта и проверки плана: omission управляемого ресурса может означать его удаление. Не запускайте IaC apply, содержащий удаление БД/volume/Bucket. [Актуальный формат IaC](https://docs.railway.com/infrastructure-as-code).

## 5. Variables

Ниже reference expressions; они работают после создания ресурсов с указанными именами. Если имена другие, выберите реальные ссылки через Railway Variables. Не подставляйте вымышленные домены. `RAILWAY_PUBLIC_DOMAIN` должен появиться после Generate Domain у web.

### web

```dotenv
RAILWAY_DOCKERFILE_PATH=Dockerfile.web
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000/api/v1
PUBLIC_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
COOKIE_SECURE=true
NEXT_TELEMETRY_DISABLED=1
```

Адрес API несекретный, используется в build и runtime только сервером. Не добавляйте `NEXT_PUBLIC_API_INTERNAL_URL`, DATABASE_URL или S3 credentials в web.

### api

```dotenv
RAILWAY_DOCKERFILE_PATH=Dockerfile.api
NODE_ENV=production
PORT=4000
API_PORT=4000
API_HOST=0.0.0.0
DATABASE_URL=postgresql://${{Postgres.APP_DB_USER}}:${{Postgres.APP_DB_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.PGDATABASE}}?schema=public
MIGRATION_DATABASE_URL=${{Postgres.DATABASE_URL}}
RAILWAY_SEED_ON_DEPLOY=true
PUBLIC_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
TRUSTED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
COOKIE_SECURE=true
ALLOW_LOCAL_HTTP=false
DISPLAY_TIMEZONE=Asia/Almaty
MEDIA_STORAGE=s3
S3_BUCKET=${{media.BUCKET}}
S3_REGION=${{media.REGION}}
S3_ENDPOINT=${{media.ENDPOINT}}
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=${{media.ACCESS_KEY_ID}}
S3_SECRET_ACCESS_KEY=${{media.SECRET_ACCESS_KEY}}
TRUST_PROXY_CIDRS=
```

Проверьте, что Postgres.DATABASE_URL использует тот же private hostname, порт и schema. Пароль APP_DB_PASSWORD должен быть URL-safe; иначе его нужно percent-encode. Не меняйте уже созданный пароль одним редактированием Railway variable: это не меняет пароль роли в БД.

Pre-deploy применяет только `prisma migrate deploy`; seed запускается при `RAILWAY_SEED_ON_DEPLOY=true`, использует существующий idempotent seed и не перезаписывает редакторские изменения. Ошибка блокирует запуск новой версии. После первого успешного запуска можно выключить seed. [Railway pre-deploy](https://docs.railway.com/deployments/pre-deploy-command).

Ограничение pre-deploy: MIGRATION_DATABASE_URL доступен и runtime-контейнеру API как service variable, хотя приложение подключается только с DML-ролью через DATABASE_URL. Для строгой изоляции credentials используйте отдельный migration job и release pipeline, который ожидает его успешного завершения до deploy API; в таком режиме удалите migration secret из API. Сам по себе независимый autodeploy двух сервисов этой последовательности не обеспечивает.

`TRUST_PROXY_CIDRS` оставлен пустым намеренно: произвольный клиентский X-Forwarded-For не считается доверенным. За Next proxy это даёт общие rate limits на его IP. Для per-client limits нужен проверенный ingress, который **заменяет** forwarding headers, и конкретный allowlist private proxy peers. Не выставляйте `true`, `*`, `0.0.0.0/0` или все private networks без такой проверки. Origin/CSRF middleware и Secure/HttpOnly/SameSite cookies остаются включёнными.

## 6. Администратор и первый запуск

После успешного API pre-deploy и готовности обоих сервисов создайте первого администратора в приватной интерактивной shell API. Владелец сам вводит email и уникальный пароль 16+ символов, без записи в историю:

```bash
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (16+ chars): ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
node dist/bootstrap-admin.js
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Блок предназначен для bash внутри API shell. Не сохраняйте ADMIN_PASSWORD как постоянную Railway variable. Bootstrap не перезаписывает существующего пользователя. Панель доступна на **фактически выданном** домене по `/admin`, `/kk/admin`, `/ru/admin`, `/en/admin`.

## 7. CI и выпуск

Существующий workflow `Quality` запускается на push и PR. Для обоих сервисов включите **Wait for CI** и одну ветку `main`; разрешения Railway GitHub App на checks при необходимости подтверждает владелец. Не ограничивайте Watch Paths только apps/web или apps/api: общие package-lock, packages/content, tsconfig и scripts тоже влияют на сборку. Самый простой первый вариант — оставить Watch Paths без фильтра. [Autodeploy и Wait for CI](https://docs.railway.com/deployments/github-autodeploys).

После успешного CI API pre-deploy применит миграции до запуска API. Web healthcheck через `/api/v1/ready` проверяет доступ к API/БД вместо одного лишь HTML fallback. Изменения схемы делайте совместимыми со старой и новой версиями: два autodeploy не атомарны. Branch protection для main настраивает владелец после проверки доступности этой функции в его GitHub plan.

## 8. Production-приёмка

Сохраните реальную публичную HTTPS-ссылку только после статуса успешного deployment и HTTP-проверки. Проверьте `/api/v1/health`, `/api/v1/ready`, kk/ru/en, players, matches, news, gallery и admin. Через админку создайте тестовый материал, загрузите изображение, проверьте три варианта и защиту удаления используемого файла. Пересоздайте web/api и сравните ID, содержимое и hash файла; после проверки уберите только созданные проверочные данные.

Не запускайте integration/E2E destructive cleanup на production. Для браузерных тестов используйте отдельную test-БД. Реальный Lighthouse (цели Performance ≥90, LCP <2,5 s, CLS ≤0,1), cookies/CSRF и мобильные размеры проверяются на публичном домене после запуска, а не выводятся из старых отчётов.

Включите резервные копии volume БД и независимое копирование объектов Bucket с проверкой восстановления. Локальные команды backup/restore описаны в `docs/DEPLOYMENT.md`; не используйте эфемерную файловую систему API как постоянное место backups. Релиз кода не должен менять или удалять Postgres volume и Bucket.
