# FC Ordabasy — Vercel (два обычных проекта)

Эта конфигурация сохраняет Next.js, NestJS, PostgreSQL/Prisma, S3, CMS и kk/ru/en. Публичные компоненты, CSS, шрифты и встроенные изображения не меняются. Services beta не используется. Существующие Render/Railway ресурсы и их данные остаются отдельно.

## Статус и порядок запуска

Наличие проектов в Dashboard само по себе не означает успешный deployment. Пока не подключены база и приватное хранилище, API намеренно не запускается, а web без явного API_ORIGIN не собирается. Сначала API Preview с отдельной тестовой базой и bucket → затем web Preview → проверки → согласованное с владельцем слияние → Production. Не нажимайте Deploy для старого main до этого.

Владелец подтвердил личное некоммерческое демо на Hobby и выбрал самостоятельное принятие условий Neon. Платные планы, Pro trial и дополнительные платные ресурсы не активируются. Отдельное согласие владельца требуется перед расходами. Вход CLI необязателен; настройки ниже доступны через Dashboard.

## Проекты

В аккаунте sososu-iwia's projects (Hobby) созданы fc-ordabasy-web и fc-ordabasy-api и связаны с sososu-iwia/prototype. Для обоих добавлен GitHub Deployment Check verify, обязательный перед Production promotion. Секреты/база/S3 пока не подключены; факт успешного deployment этим не подтверждается.

| Настройка | fc-ordabasy-web | fc-ordabasy-api |
| --- | --- | --- |
| Framework | Next.js | NestJS |
| Root Directory | apps/web | apps/api |
| Include source files outside Root Directory | включено | включено |
| Node.js | 24.x | 24.x |
| Install Command | cd ../.. && npm ci | cd ../.. && npm ci |
| Build Command | cd ../.. && npm run build -w apps/web | cd ../.. && npm run build -w apps/api |
| Output Directory | стандартный .next | dist |
| Region | fra1 | fra1 |
| Production branch после слияния | main | main |

Файлы apps/web/vercel.json и apps/api/vercel.json содержат команды сборки. В API явно задан dist: официальный NestJS-сборщик выбирает dist/main.js, сохраняя TypeScript decorator metadata. При старте createApp проверяет роль, маркер окружения и SHA-256 каждой миграции. Он не выполняет DDL, migrate или seed. Vercel управляет обработкой HTTP и жизненным циклом Function; собственного постоянного сервера/диска не требуется.

Для API задайте в Functions максимальное время 300 секунд (Hobby Fluid). Конфигурация functions для dist/main.js также сохранена в vercel.json; фактическое значение нужно проверить в облачном deployment. Не полагайтесь на 5 GB Large Functions beta: целевой обычный лимит пакета 250 MB.

## Environment Variables

Значения ниже задаются отдельно для Production и Preview. Не копируйте Production secrets в Preview. Не добавляйте секреты в NEXT_PUBLIC_*, GitHub, отчёт или браузерный код.

Web, build и runtime:

- API_ORIGIN — фактический HTTPS origin соответствующего Vercel API deployment, без /api/v1. Для Preview — только Preview API.
- PUBLIC_ORIGIN — фактический HTTPS origin данного web окружения.
- DISPLAY_TIMEZONE=Asia/Almaty
- API_FETCH_TIMEOUT_MS=15000 (при необходимости измеренного увеличения, допустимо до 90000).

API, runtime:

- NODE_ENV=production, COOKIE_SECURE=true
- PUBLIC_ORIGIN — HTTPS origin web этого окружения.
- TRUSTED_ORIGINS — точные разрешённые HTTPS origins web, через запятую; без wildcard.
- DATABASE_URL — Neon pooled endpoint (-pooler.), роль ordabasy_production либо ordabasy_preview, schema=public, sslmode=verify-full.
- MEDIA_STORAGE=s3
- S3_BUCKET=fc-ordabasy-production либо fc-ordabasy-preview
- S3_ENDPOINT — HTTPS branch endpoint хранилища; S3_REGION — выданный провайдером регион.
- S3_FORCE_PATH_STYLE=true для Neon.
- S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY — отдельные credentials соответствующего изолированного окружения.
- CRON_SECRET — случайный секрет минимум 32 символа для ежедневной очистки staging.
- DISPLAY_TIMEZONE=Asia/Almaty

VERCEL и VERCEL_ENV назначает платформа. Не подменяйте Preview на production. Не задавайте ALLOW_LOCAL_HTTP, DEMO_MODE, MIGRATION_DATABASE_URL, owner credentials, Render DB_HOST или API_FOOTBALL_KEY без отдельной необходимости. Внешний football API необязателен; архив клуба работает без него.

Next rewrites /api/v1/* и /uploads/* используют API_ORIGIN при build. Изменение API URL требует нового web build. Браузер обращается к своему origin; сессионная cookie остаётся HttpOnly, Secure, SameSite=Strict. CSRF, Origin и RBAC проверяет API. Не добавляйте Access-Control-Allow-Origin:*.

Preview deployment protection не следует отключать для всего аккаунта. Если защищённый API Preview недоступен прокси, настройте точечный поддерживаемый Vercel bypass между этими двумя проектами либо используйте согласованную политику Preview. Это требуется проверить на реальных deployment, а не считать работающим заранее.

## PostgreSQL и безопасный release

Рекомендуются две отдельные бесплатные Neon базы/проекта PostgreSQL 17 в Frankfurt: Production и Preview. Preview не должен быть клоном с рабочими аккаунтами/секретами. Создайте свежую Preview базу и импортируйте только встроенный архив. Не используйте старую Render базу для Vercel.

Проверьте реальный Free plan в окне провайдера до создания; не выбирайте платный. Нужны UTF8, корректный lower() для казахского/русского и btree_gist. Миграции включают ограничение пересекающихся периодов состава; существующая история сохраняется.

Локально в защищённой операторской сессии (значения не записывать в Git):

```sh
# До release: npm ci && npm run build -w apps/api
# Экспортировать через secret manager/закрытый env-файл:
# MIGRATION_DATABASE_URL: direct owner URL, НЕ -pooler.
# VERCEL_DATABASE_HOST: точный direct hostname из этого URL
# VERCEL_DATABASE_NAME: точное имя базы
# APP_DB_PASSWORD: новый случайный пароль роли runtime, минимум 32 символа
# VERCEL_RELEASE_ENV: preview или production
# VERCEL_RELEASE_SEED=true только для первичного импорта архива
node scripts/vercel-release.mjs --provision-runtime
```

Первичное создание роли разрешено только в пустой новой базе с отсутствующей runtime ролью. Скрипт не меняет пароли существующих ролей и не присваивает чужой базе новый маркер окружения. Пул использует только DML роль; она не владеет таблицами, не имеет CREATE/DDL, не меняет _prisma_migrations и DeploymentEnvironment. Маркер окружения устанавливается владельцем один раз и далее неизменяем для API. Пул из 3 соединений переиспользуется между вызовами и подключён к attachDatabasePool.

Для последующих изменений: Backup → проверка восстановления в отдельной базе → просмотр SQL/Prisma diff → migrate → проверка роли/Unicode/checksums → deploy. Создайте backup существующим npm run backup:create -- <private-dir> с PostgreSQL client 17+ и S3 credentials, проверьте восстановление отдельно. Перед новой миграцией существующей базы задайте VERCEL_BACKUP_FILE (custom-format database.dump) и VERCEL_BACKUP_SHA256. Скрипт проверяет формат и хеш; факт успешного восстановления подтверждается отдельным drill, не самим хешем. Затем запускайте release без --provision-runtime, с тем же паролем runtime. Owner URL остаётся только у оператора, вне API env.

Никаких prisma db push, migrate reset, drop, автоматических миграций при build/start/invocation. Откат кода использует предыдущий deployment; откат данных требует отдельного плана и подтверждения владельца. Миграция 202610250001 добавляет только три служебные таблицы.

## Приватное S3-хранилище и загрузки

Для каждого окружения создайте собственный private bucket с указанным именем и отдельными branch-scoped credentials. Не используйте Production credentials в Preview. В Neon доступ задаётся в Console/API, а не через S3 PutBucketPolicy. Оставьте bucket private. В CORS разрешите только фактические web origins этого окружения, метод PUT, заголовок Content-Type; Content-Length выставляет браузер. AWS SDK и SigV4 остаются основой интеграции.

Поток: аутентифицированный POST media/direct/presign с CSRF/Origin → одноразовый по смыслу UUID ticket, размер до 10 MiB и SHA-256 → подписанный PUT в staging/<UUID> на 5 минут → POST media/direct/complete → проверка владельца/срока/размера/Content-Type, ограниченное чтение и реальный SHA-256 → проверка сигнатуры файла и Sharp decode до 40 MP → WebP/AVIF/thumbnail → одна транзакция MediaAsset + AuditLog + receipt. Повтор complete возвращает тот же asset. Неподтверждённый объект нельзя связать с CMS. В API проходят только небольшие JSON-запросы, большие байты идут прямо в S3.

Оптимизированный вариант ограничен 4 MiB, чтобы /uploads/* укладывался в 4.5 MB лимит ответа Function. Изображения с необычно большим результатом требуют уменьшения исходного разрешения; они отклоняются до записи asset. Встроенные /media файлы обслуживает Next/CDN.

Neon lifecycle rules и versioning пока не обеспечивают удаление/версии. Поэтому ежедневный Hobby Cron GET /internal/media-cleanup в 03:00 UTC требует CRON_SECRET и удаляет максимум 100 просроченных staging receipts за запуск, с запасом времени для обработки. Он проверяет точный staging UUID, не трогает связанный MediaAsset и произвольные ключи bucket. При больших объёмах backlog нужно контролировать, не включая платный scheduler без согласия. Для важных фото нужны самостоятельные проверяемые backup; обещания неограниченного хранения нет.

Глобальные лимиты API/login/upload хранят атомарные окна в PostgreSQL, общие для Functions; при недоступности store они закрывают запрос. Это расходует запросы/CU базы и требует контроля квот. IP берётся только из заменяемого Vercel edge заголовка при VERCEL=1; поведение цепочки web→api нужно проверить в облаке.

## Проверки и администратор

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:direct-upload
npm run test:vercel-release
npm run test:restore
npm run test:migrations
npm run build
npm run security:scan
npm audit --audit-level=low
npm run test:e2e
```

Интеграционные/E2E тесты выполняются только на изолированной PostgreSQL test базе; direct-upload поднимает собственный disposable S3 fixture в Docker. verify-vercel-release требует отдельного локального тестового PostgreSQL сервера. Не запускайте эти команды на Production/рабочей Render базе. Тест S3 fixture проверяет приложение; он не заменяет проверку приватности, CORS, SigV4 и TLS у настоящего провайдера.

Владелец выбрал самостоятельное создание SUPER_ADMIN после запуска. Скрытый аккаунт/пароль не создаются. Используйте существующий npm run admin:create в защищённой операторской сессии, без пароля в аргументах команд и без owner URL в Vercel env. Адрес входа: <фактический-web-origin>/kk/admin, /ru/admin, /en/admin.

После облачного запуска обязательно проверить /kk,/ru,/en,team,matches,news,gallery,admin, /api/v1/health и ready, SSR, login/logout/cookies/CSRF/RBAC, загрузку/публикацию на Preview, мобильный вид, console, HTTPS/SEO/Lighthouse. Сохранить идентификаторы и хеши контента, сделать повторный deployment и сравнить. До этих проверок статус — подготовлено, а не успешно развёрнуто.

## GitHub и стоимость

Оба проекта связать с sososu-iwia/prototype. Проверяемая ветка — codex/vercel-deployment-20261025, PR в main. Main не менять без успешных Quality checks и согласия владельца. Для релиза базы требуется отдельный управляемый release, Git push его не запускает. Git autodeploy после согласованного merge должен собирать один SHA обоих проектов; сначала проверить API release/ready, затем web.

Hobby допускается здесь только для подтверждённого личного некоммерческого демо. Квоты не являются SLA: cold start/scale-to-zero и остановка при превышении лимитов возможны. Сверяйте текущие квоты в Dashboard: Vercel Functions payload 4.5 MB, обычный пакет 250 MB, Fluid Hobby максимум 300 секунд/2 GB; Neon Free на октябрь 2026 заявляет 1 GB Postgres, 100 CU-hours и 5 GB object storage на проект. Реальное предложение Marketplace может отличаться и должно быть подтверждено на экране перед созданием. Платные ресурсы не включать автоматически.

Первичные источники: [NestJS](https://vercel.com/docs/frameworks/backend/nestjs), [monorepos](https://vercel.com/docs/monorepos), [Functions limits](https://vercel.com/docs/functions/limitations), [Hobby](https://vercel.com/docs/plans/hobby), [pool lifecycle](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [Neon S3 compatibility](https://neon.com/docs/storage/s3-compatibility), [Neon credentials](https://neon.com/docs/storage/authentication), [Neon Free October update](https://neon.com/blog/neon-free-plan-1-gb-per-project).
