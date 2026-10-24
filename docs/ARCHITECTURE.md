# Архитектура

Обновление 24 октября 2026: сезонные матчевые показатели читаются одним batch-запросом на сезон с группировкой player+team; события соперника не учитываются в итогах клуба. В клиентский Squad передаются только данные карточек, полный профиль и история остаются в API/профиле. Новые AVIF-фоны и маленький логотип создаются `scripts/build-critical-media.mjs` из сохранённых оригиналов; WebP fallback, прежние URL и старые файлы сохранены. Типизированный `features/admin/drafts.ts` объединяет версии формы с подтверждением конфликтующих полей. Шапка только на admin-странице перестала быть фиксированной; публичный layout сохраняется.

Публичные Header/Gallery/Squad разделены на серверные оболочки и существующие client-компоненты: сервер передаёт типизированные готовые labels. Полный `next-intl` client provider нужен только панели. Для error boundary передаются две локализованные строки через небольшой React context; публичные словари/библиотека форматирования больше не нужны в начальной клиентской загрузке.

- `apps/web`: Next.js App Router, React, strict TypeScript. Server Components получают публичные DTO через внутренний URL API. HTML содержит индексируемые профили/статьи, canonical/hreflang/Open Graph. Каждый запрос имеет CSP nonce, поэтому страницы используют SSR. Клиентские компоненты ограничены меню, фильтром состава, галереей/видео и админскими формами. Lightbox загружается динамически.
- `apps/api`: NestJS 12, REST `/api/v1`, Zod DTO, PostgreSQL через Prisma 7 + pg adapter. Полная модель в `prisma/schema.prisma`; SQL-миграция хранится в репозитории. Cookie sessions и RBAC реализованы на сервере. Приватные формы не меняют файлы сайта.
- `packages/content`: воспроизводимый импорт исходников, manifest медиа, **публичный read-only snapshot для аварийного отображения**. Snapshot не содержит черновиков, пользователей или статистики-заглушки. Нормальный источник — БД; недоступность API отмечается баннером. При 404 detail-route не возвращает старый snapshot вместо снятой с публикации записи.
- `scripts`: импорт, медиа, snapshot/fonts, проверки, старт standalone. Источник `PreservedSections.tsx` сгенерирован из семантического HTML один раз и затем поддерживается как обычный TSX; runtime HTML injection отсутствует. Скрипт генерации — миграционная утилита, не обычный build step.
- `compose.yaml`: PostgreSQL → migrate/initial seed → NestJS → Next.js. `compose.prod.yaml` добавляет Caddy TLS и выключает локальное HTTP-исключение. API/DB доступны только в сети Compose. БД имеет durable volume, dev upload — отдельный volume, production upload — независимый S3 bucket.

## Данные

User/Role/Session/AuditLog; Team/Season/Player/PlayerSeason/PlayerStatistics; Competition/Match/MatchEvent; NewsPost/NewsTranslation/Category; MediaAsset/GalleryItem; ClubInfo/ClubAchievement/StaffMember; ClubSettings; LeagueStandingSnapshot.

Переводимый контент хранится как kk/ru/en JSON, статьи — как отдельные NewsTranslation с уникальным `(postId, locale)`. Kazakh обязателен, fallback на него явный. Имена/факты из старого сайта маркированы LEGACY_UNVERIFIED с источником и датой. Неизвестные показатели отсутствуют в БД, а не равны придуманному нулю.

Все timestamps хранятся как UTC; API принимает ISO-8601 с `Z`. Отображение публичных матчей и дат — настраиваемый `ClubSettings.timezone` (Asia/Almaty по умолчанию). Админское datetime-local явно использует Asia/Almaty (UTC+5), преобразуется в UTC при сохранении. Даты рождения отображаются без часового сдвига.

Статистика сортируется по goals/assists/appearances либо `(goals + assists) × 90 / minutes`; при 0 минут деление не выполняется. Рейтинг «лучший игрок» не назначается. Сезонная принадлежность и statistics редактируются независимо от персональной карточки.

## Обновление

Публичные чтения используют `no-store`: сохранённый CRUD виден при следующем открытии/обновлении страницы без скрытого revalidation token. Для большего трафика можно добавить tag-based cache с invalidation в API, после нагрузочного тестирования. Provider standings имеет собственный DB-cache/TTL, single-flight и circuit cooldown. Snapshot остаётся аварийным неизменяемым архивом и не выдаётся за актуальную копию БД.

## Сознательные ограничения

Один экземпляр API: in-memory rate limiter и provider single-flight. Для нескольких replicas потребуются общий rate-limit store/lock. Статьи используют простой безопасный текст с переносами, без произвольного HTML. Доступные upload — JPEG/PNG/WebP, которые декодируются и перекодируются; импортированное видео сохраняется, произвольные видео через upload не принимаются. Механизм password reset/email не добавлен: нет неподтверждённого SMTP и публичного self-signup. Новая регистрация/сброс должны отдельно проектироваться с одноразовыми токенами.

Для смены языка используются обычные hreflang-ссылки: новый документ обновляет `html lang`, серверные метаданные и локализованные labels. Prefetch и фоновые RSC-запросы не меняют language-cookie. Предзагрузка остальных навигационных ссылок отключена: первый экран не скачивает код будущих страниц. `scripts/build-fonts.mjs` создаёт из проверенного SHA-256 исходника Noto Sans 2.015 единый preload KK/RU/EN (25 892 bytes) с используемыми весами 400–900 и обычными shaping features. Обычные kerning/ligatures сохраняются; opt-in small caps/fractions/alternate digits в CSS не используются и не включены в primary. Генератор сравнивает контуры и positions контрольных строк со старым primary recipe при шести весах, а также покрытие алфавитов и метрики. Старые fonts.css/files сохранены, в том числе для других весов/символов. `docs/FONT_REPORT.json` относится к прежнему этапу, не к новому subset.


## Профессиональная CMS

RosterMembership хранит отдельные периоды игрок+команда+сезон, номер и уход; PlayerSeason остаётся стабильным ключом сезонных итогов. FK истории используют RESTRICT, интервалы защищены PostgreSQL GiST. Архивированный опубликованный профиль доступен в `/[locale]/players/[slug]`, старый `/team/[slug]` перенаправляется. Расчёт в `statistics.ts` выбирает CONFIRMED или MATCHES, фильтрует неподтверждённые/незавершённые матчи и отменённые события. Счёт и события валидируются транзакционно.

`cms.ts` — бизнес-правила, версии, блокировка и безопасный diff аудита; `management.ts` — отдельные защищённые пользователи/медиа; `storage.ts` — локальный dev volume и S3 production. WebP/AVIF/thumbnail неизменяемы по UUID. Backend обслуживает same-origin `/uploads`, поэтому bucket остаётся приватным. `backup.ts` экспортирует согласованный PostgreSQL snapshot и файлы под общей content lock, checksum manifest; restore допускается только в другую пустую БД. Новые bootstrap-аккаунты SUPER_ADMIN, без публичной регистрации.

S3 SDK использует официальные [PutObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/) и [GetObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/GetObjectCommand/). Транзакционные границы согласованы с [Prisma ORM 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).
