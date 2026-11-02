# FC Ordabasy на Render

Это конфигурация временного бесплатного демо. Успех выпуска подтверждается отдельно реальными HTTPS-проверками. Railway и существующие приложения Render не меняются.

## Архитектура и ограничения

Два Docker Web Service: `fc-ordabasy-web` (3000) и `fc-ordabasy-api` (4000), PostgreSQL 17 `fc-ordabasy-db`, один регион Frankfurt. Docker context — корень репозитория; rootDir не сужается до workspace. Caddy не нужен: TLS завершает Render.

Browser → web HTTPS → штатный Next.js rewrite → API HTTPS → приватное соединение PostgreSQL. API остаётся публичным, авторизация, RBAC, CSRF, проверка Origin, Secure cookies и rate limits обязательны.

Free сервисы засыпают; 750 instance-hours делятся между всеми работающими Free Web Services workspace. Free Postgres временная, истекает через 30 дней, без встроенных backups. Диски, Shell, one-off jobs и pre-deploy Free недоступны. Перед окончанием срока нужна отдельная выгрузка или согласованный платный вариант. [Ограничения Free](https://render.com/docs/free).

Тарифы и квоты проверяются в Dashboard перед созданием. В Blueprint везде явно `plan: free`; нельзя соглашаться на paid compute по умолчанию. Платные ресурсы требуют отдельного согласования владельцем.

## Исходник и Blueprint

`render.yaml` проходит официальную JSON Schema Render. В нём нет настоящих паролей, ключей или выдуманных доменов. Два сервиса используют одну Render-ветку с успешным CI; `autoDeployTrigger: checksPass`. После просмотра и обычного merge PR в main обновите `branch: main` у **обоих** сервисов в Blueprint и выполните sync. Не включайте build filters, исключающие package-lock/workspaces/общий контент.

Не применяйте Blueprint поверх неизвестных одноимённых ресурсов. Сначала проверьте список существующих services/databases и принадлежность проекту. В текущем сценарии для клуба создаются отдельные ресурсы; `flowers` и Railway сохраняются.

Render references `fromService.envVarKey: RENDER_EXTERNAL_URL` дают реальные URL обоим сервисам. `API_ORIGIN` — HTTPS origin API без `/api/v1`; общий resolver добавляет этот путь для build-time rewrites, SSR и admin session reads. Альтернатива для ручной настройки — полный `API_INTERNAL_URL=https://<реальный API>/api/v1` при пустом API_ORIGIN. API_ORIGIN имеет приоритет. Переменные Docker доступны как ARG; смена endpoint требует **rebuild web**. Адрес frontend в API endpoint запрещён, поэтому самопроксирования нет. [Docker env/ARG](https://render.com/docs/docker), [Blueprint references](https://render.com/docs/blueprint-spec).

Render SSR ждёт API до 70 секунд; Next proxy — до 90 секунд. Loading ограничен конкретными страницами и не подменяет HTTP 404 неизвестных маршрутов. При сбое показывается подписанный архив и кнопка повтора (`router.refresh`); результаты/таблицы не выдаются за актуальные. Периодических keep-alive запросов нет.

## PostgreSQL и безопасный отдельный release

API не получает owner URL. Его env содержит только APP_DB_USER/APP_DB_PASSWORD и DB_HOST/DB_PORT/DB_NAME из `fromDatabase`. `render-start.mjs` составляет runtime DATABASE_URL, проверяет ограниченные права роли и успешные checksums всех миграций из данного image. До выполнения недостающей миграции новый API **не стартует**. Startup не выполняет DDL или seed.

Для Free миграции выполняются локально до выпуска, через TLS `verify-full` и отдельный owner URL. В API container не сохраняется MIGRATION_DATABASE_URL. Для первого запуска нужны:

- свежая отдельная БД, PostgreSQL 17, UTF8/Unicode case folding, доступный `btree_gist`;
- временно разрешённый **только IP оператора /32** для внешнего соединения;
- owner URL из новой БД, APP_DB_USER=ordabasy_app и случайный пароль 32+ символа;
- собранный API (`npm ci`, `npm run build -w apps/api`).

Вводите URL и пароль интерактивно в локальном bash, без argv/history:

```bash
read -r -s -p 'Render external owner URL: ' MIGRATION_DATABASE_URL; printf '\n'
read -r -s -p 'Runtime role password, 32+ chars: ' APP_DB_PASSWORD; printf '\n'
export MIGRATION_DATABASE_URL APP_DB_PASSWORD
export APP_DB_USER=ordabasy_app RENDER_DATABASE_NAME=ordabasy_demo
export RENDER_SEED_ON_DEPLOY=true
node scripts/render-release.mjs --provision-runtime
unset MIGRATION_DATABASE_URL APP_DB_PASSWORD
```

`--provision-runtime` разрешён только при пустой public schema и отсутствии такой роли; скрипт не меняет существующий пароль. Повторный release выполняется без этого флага. Он проверяет явное имя целевой БД и Unicode, вызывает проверенный `prisma migrate deploy`, при необходимости идемпотентный seed и проверяет результат через DML-роль. Ошибка блокирует выпуск, URL и пароли не печатаются. `migrate reset`, db push, drop и миграции при image build не используются.

После миграций и bootstrap закройте внешний доступ БД (`ipAllowList: []` в Blueprint); API продолжает использовать private network. Для последующих ручных миграций владелец временно разрешает свой /32, затем снова закрывает. Не ослабляйте TLS ради соединения.

До изменения существующих данных сделайте проверенный независимый backup. Миграции должны быть совместимы со старым и новым API: два autodeploy не атомарны. Для paid Render доступен pre-deploy `node railway-predeploy.mjs`; он требует отдельного согласования тарифа и, при размещении owner secret в service env, не обеспечивает строгой изоляции credentials. Отдельная release-процедура сохраняет изоляцию. [Pre-deploy](https://render.com/docs/deploys#pre-deploy-command).

## Environment

| Сервис         | Переменные                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| web            | NODE_ENV=production, PORT=3000, HOSTNAME=0.0.0.0, COOKIE_SECURE=true, NEXT_TELEMETRY_DISABLED=1, API_FETCH_TIMEOUT_MS=70000                        |
| web references | PUBLIC_ORIGIN ← собственный RENDER_EXTERNAL_URL; API_ORIGIN ← API RENDER_EXTERNAL_URL                                                              |
| api            | NODE_ENV=production, PORT=4000, API_PORT=4000, API_HOST=0.0.0.0, COOKIE_SECURE=true, ALLOW_LOCAL_HTTP=false, DISPLAY_TIMEZONE=Asia/Almaty          |
| api database   | DB_HOST/DB_PORT/DB_NAME ← private Postgres references; APP_DB_USER=ordabasy_app; APP_DB_PASSWORD ← закрытое значение DML-роли                      |
| api origins    | PUBLIC_ORIGIN и TRUSTED_ORIGINS ← web RENDER_EXTERNAL_URL                                                                                          |
| api ingress    | TRUST_PROXY_CIDRS пусто, пока реальный ingress не проверен; поддельные forwarded headers не доверяются. Это даёт общие rate limits на адрес proxy. |
| api demo       | DEMO_MODE=true, MEDIA_STORAGE=disabled                                                                                                             |

Healthcheck обоих сервисов `/api/v1/ready`. API Docker Command `node render-start.mjs`; web — штатный CMD. `/health` — liveness, `/ready` проверяет соединение с БД; startup дополнительно гарантирует ожидаемые миграции и права роли.

## Медиа в демо и S3

Режим disabled согласован как временный. Новые upload/read/delete через media storage возвращают отказ 503, не создают ephemeral файлы и не меняют media records. Авторизация и CSRF проверяются до upload. Существующие bundled фотографии `/media` сохраняются в frontend image; `/uploads` не обещает работать без storage.

Чтобы включить полноценную загрузку, подключите приватный внешний S3-compatible bucket и задайте в API: MEDIA_STORAGE=s3, DEMO_MODE=false, S3_BUCKET, S3_REGION, S3_ENDPOINT (если нужен), S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE по документации провайдера. Ключи вводятся только в Render Environment. Не используйте локальный диск Free и не подставляйте фиктивные credentials. S3 failure никогда не переключает API на ephemeral storage. Проверьте JPEG/PNG/WebP, варианты webp/avif/thumb, `/uploads`, запрет удаления используемого файла и сохранность после redeploy.

## Первый администратор

Free не предоставляет Shell, поэтому используйте существующий bootstrap локально с **external URL той же DML-роли**, временным /32 и проверкой TLS. Email выбирает владелец; пароль уникальный, 16+ символов, не хранится в постоянном API env:

```bash
read -r -s -p 'Render external DML database URL: ' DATABASE_URL; printf '\n'
read -r -p 'Administrator email: ' ADMIN_EMAIL
read -r -s -p 'Administrator password, 16+ chars: ' ADMIN_PASSWORD; printf '\n'
export DATABASE_URL ADMIN_EMAIL ADMIN_PASSWORD
export BOOTSTRAP_ROLE=SUPER_ADMIN
node apps/api/dist/bootstrap-admin.js
unset DATABASE_URL ADMIN_EMAIL ADMIN_PASSWORD
```

У внешнего URL должно быть `sslmode=verify-full`. Bootstrap не перезаписывает существующего пользователя. Админка: фактический web URL + `/admin` (редирект на язык), `/kk/admin`, `/ru/admin`, `/en/admin`. Готовый аккаунт и пароль не закладываются в код.

## Проверка и обновления

До публикации: npm ci, Prisma generate, lint, typecheck, unit, integration, production build, security:scan и audit. E2E — только на отдельной test-БД. Quality дополнительно вызывает Render startup gate в production Docker image после настоящих миграций через DML-роль; проверяет S3, persistence, backup/restore.

После Live нужны настоящие HTTPS проверки kk/ru/en, team/matches/news/gallery/admin, `/api/v1/health`, `/api/v1/ready`, cookies/CSRF, казахских букв, клавиатуры и mobile. Проверочные записи имеют отдельный префикс; destructive E2E на demo/live DB не выполняются. Сохранность записей проверяется контролируемым redeploy и сравнением ID/значений. В режиме без S3 сохранность новых фотографий не заявляется.

Обычное обновление: создать отдельную ветку → commit → git push → PR → дождаться Quality → просмотреть SQL и backup → при новых миграциях выполнить отдельный release → обычный merge → Render auto-deploy после checks. Проверить Live и HTTPS. Не делать force push или автоматический откат БД удалением миграций.
