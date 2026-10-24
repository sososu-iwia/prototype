# FC Ordabasy

Актуальная приёмка от 24 октября 2026: [финальный отчёт](docs/RELEASE_FINALIZATION.md). Проверки предыдущего этапа не подтверждают внешний production deployment. Текущая ветка — `codex/production-hardening-20261024`; исходные незакоммиченные изменения сохранены.

Финальный локальный прогон: unit **14/14**, integration **41/41**, E2E **57/57**, audit **0 vulnerabilities**, Docker PG17/S3/persistence/restore **PASS**, HTTPS drill **8/8**. Через Caddy/H2 все четыре median LCP <2,5 с; direct HTTP/1.1 preview не проходит цель на двух страницах. Реального внешнего deployment нет; инфраструктура и редакционная приёмка перечислены в отчёте.

Миграция существующего сайта на Next.js App Router / React / TypeScript strict и NestJS / PostgreSQL / Prisma. Исходные HTML, CSS, JS и все 331 МБ медиа сохранены в корне как архив; Next.js публикует только `apps/web/public`. Navy/голубая палитра, hero, фотографии, классы карточек и порядок основных секций сохранены. Контраст текста и элементов управления исправлен для доступности.

## Быстрый запуск в Docker

Требуются Docker Engine с Compose v2, свободный порт 3000 и `.env`.

```sh
[ -f .env ] || cp .env.example .env
# Задайте POSTGRES_PASSWORD: длинная случайная строка из URL-safe символов.
docker compose up --build -d
docker compose logs -f migrate api web
```

Открыть <http://localhost:3000/kk>. БД и API не публикуют порты хоста. `migrate` применяет миграции и при первом запуске импортирует архив; повторный запуск сохраняет редакторские изменения. Внешний football API не требуется.

Создание первого администратора — отдельная команда. Пароль не задаётся в коде и не выводится в лог. Команда не перезаписывает существующий аккаунт.

```sh
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (16+ chars): ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
docker compose exec -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/bootstrap-admin.js
unset ADMIN_PASSWORD ADMIN_EMAIL
```

В macOS zsh используйте `read 'ADMIN_EMAIL?Admin email: '` и `read -s 'ADMIN_PASSWORD?Admin password: '` либо выполните блок в bash. Панель: `/admin`, перенаправляющий на выбранный язык. Публичной регистрации нет.

## Разработка без Docker

Node.js 24 LTS, npm 11, PostgreSQL 17 для production. Native-проверки выполняются на отдельном PostgreSQL 15; Docker-проверки — на PostgreSQL 17 с клиентскими инструментами 17. Результаты обоих запусков приведены в финальном отчёте. База должна иметь UTF-8 и Unicode `LC_CTYPE` (например `en_US.UTF-8`), иначе поиск кириллицы без учёта регистра не работает. FFmpeg нужен только для повторной обработки оригиналов.

```sh
[ -f .env ] || cp .env.example .env
# Укажите DATABASE_URL, например PostgreSQL отдельной development-базы.
npm ci
npx prisma generate --config apps/api/prisma.config.ts
npm run db:migrate
npm run db:seed
npm run admin:create
npm run dev
```

Для `admin:create` передайте `ADMIN_EMAIL` и `ADMIN_PASSWORD` через окружение, как в примере выше. В `.env.example` они пустые. API: <http://localhost:4000/api/v1/health>; Swagger в dev: <http://localhost:4000/api/docs>. Frontend: <http://localhost:3000>.

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
NODE_ENV=production API_HOST=127.0.0.1 ALLOW_LOCAL_HTTP=true npm run start -w apps/api
# В другом терминале; для локального HTTP production-preview: ALLOW_LOCAL_HTTP=true.
ALLOW_LOCAL_HTTP=true npm run start -w apps/web
```

Для production API нужен HTTPS; локальный preview разрешён только с `ALLOW_LOCAL_HTTP=true` и trusted origins строго на localhost/127.0.0.1. Cookie Secure отключается только для такого локального HTTP. VPS использует `compose.prod.yaml`, где исключение выключено.

Браузерные тесты используют **отдельную тестовую БД** с `test` или `codex` в имени; никогда не запускайте их на production. Перед E2E должны работать API и production frontend. Chrome необходим для проверки; в CI он устанавливается.

```sh
npm run test:e2e
npm run security:scan
npm audit
node scripts/visual-check.mjs
node scripts/lighthouse.mjs
```

`typecheck` сам генерирует Prisma Client после чистого `npm ci`. Интеграционные тесты собирают и проверяют compiled API. Для новых доказательств без перезаписи старых отчётов задайте `VERIFICATION_DIR=docs/verification/<release>`; Lighthouse выполняет три последовательных холодных mobile-прогона каждой из четырёх страниц и возвращает exit 1 при недостижении целевых метрик. E2E проверяет 390/768/1440 px. `npm run test:compose` требует работающий Docker daemon и создаёт только собственный изолированный Compose-проект.

Integration-наборы выполняются последовательно: параллельные Argon2/Prisma/Sharp проверки в ограниченной Docker VM воспроизвели тайм-ауты транзакций. Тайм-ауты приложения не увеличены. Для production дополнительно нужны отдельный `API_DATABASE_URL` с DML-ролью, приватный S3 и настройки домена/TLS; порядок подготовки и отката — в [DEPLOYMENT](docs/DEPLOYMENT.md). Для хранения тяжёлых оригиналов и отчётов без потери истории см. [ARCHIVE_STORAGE](docs/ARCHIVE_STORAGE.md).

`Lighthouse`-скрипт автоматически выбирает установленный Chrome через chrome-launcher; путь можно задать `CHROME_PATH`. Отчёты и фактические ограничения: [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Контент и медиа

20 игроков перенесены как **непроверенный архив**, а не подтверждённый актуальный состав. 36 матчей и 3 старые новостные заготовки — **черновики**, недоступные публичному API. Данные статистики не выдуманы: до ввода редактором отображается пустое состояние. Опубликована только служебная заметка об архиве; это не репортаж о событии клуба. История и достижения помечены как ожидающие проверки; спорные счётчики скрыты значением «—». Удалены фиктивные внешние ссылки.

```sh
npm run content:import
npm run media:build
node scripts/build-snapshot.mjs
```

Повторная обработка создаёт WebP/AVIF 320/640/960 и hero 1600 px, сжатое MP4 и poster. Оригиналы не изменяются. Обновлённые варианты с неизменным именем требуют сброса CDN-кеша при релизе; для редакторских upload используются новые UUID.

Основные материалы: [архитектура](docs/ARCHITECTURE.md), [миграция](docs/MIGRATION.md), [аудит](docs/BASELINE_AUDIT.md), [развёртывание и backup](docs/DEPLOYMENT.md), [безопасность](docs/SECURITY.md), [API](docs/API.md).

Для отдельного редактора используйте ту же консольную команду с `BOOTSTRAP_ROLE=EDITOR`; по умолчанию создаётся SUPER_ADMIN. SUPER_ADMIN также управляет пользователями через защищённый API панели.


Профессиональная панель: [руководство администратора](docs/ADMIN_GUIDE.md), [результаты внедрения](docs/ADMIN_IMPLEMENTATION.md). Новые команды: `npm run test:restore`, `npm run backup:create -- /absolute/new-backup-directory`, `npm run backup:restore -- /absolute/backup-directory`, `npm run media:migrate-storage`. Production требует отдельный S3 bucket; параметры находятся в `.env.example`.
