# REST API v1

База `/api/v1`. OpenAPI: `/openapi.json`, DTO: `/admin-schema`, dev Swagger: `/api/docs`. Точные DTO: `apps/api/src/domain.ts`. Все administrative endpoints проверяют серверную сессию; POST/PUT/DELETE требуют разрешённый Origin и `X-CSRF-Token`.

## Публичные чтения

- `GET /health`, `/ready` — процесс и доступность PostgreSQL.
- `GET /players?page=1&limit=24&position=forward&season=2026`. Только опубликованные профили. По умолчанию — неархивированные игроки с периодом в составе клуба, действующим сейчас. С `season` — период выбранного сезона. `archive=true` включает опубликованные исторические профили. `rosterNumber` берётся из соответствующего периода. `GET /players/:slug` сохраняется после ухода/архивации; включает историю, достижения и согласованную сезонную статистику.
- `GET /matches?season=2026&competition=league&status=FINISHED&venue=home` — опубликованные матчи. Статусы SCHEDULED/LIVE/FINISHED/POSTPONED/CANCELLED, время UTC.
- `GET /news?q=...`, `/news/:slug` — PUBLISHED с датой ≤ now; переводы, обложка и изображения. DRAFT/ARCHIVED приватны.
- `GET /gallery`, `/club`, `/seasons`, `/competitions`.
- `GET /statistics?season=2026&sort=goals|assists|appearances|efficiency` — подтверждённые итоги либо расчёт по матчам, никогда сумма обоих источников. Формула per-90 возвращается в `method`.
- `GET /standings` — `{rows,source,updatedAt,stale,reason}`; без ключа/снимка честное пустое состояние.

Пагинированные ответы `{items,total,page,limit}`. limit≤100 (users/media: 20). Отсутствующие публичные детали — 404. SSR использует `cache:no-store`.

## Сессия и роли

`POST /auth/login {email,password}` → HttpOnly SameSite=Strict cookie (Secure в production) + `{user,csrfToken}`. `GET /auth/me`, `/auth/csrf`, `POST /auth/logout`. CSRF стабилен в пределах сессии, поддерживает несколько вкладок. Cookie/token не помещаются в localStorage. Публичной регистрации нет.

SUPER_ADMIN — все полномочия. ADMIN — контент/футбол/настройки/аудит, управление только EDITOR. EDITOR — собственные новости, галерея, загрузка/описание медиа, чтение справочников. Backend проверяет роль и авторство; UI не является границей доступа.

## Редактирование

`GET/POST /admin/:entity`, `PUT/DELETE /admin/:entity/:id`. Ресурсы: players, teams, seasons, memberships, player-seasons, statistics, matches, match-events, match-statistics, news, gallery, club, staff, achievements, competitions, categories.

PUT принимает полный DTO. **PUT и DELETE требуют `If-Match: <version>`**; версия возвращается в списке/ответе сохранения. Отсутствие — 428 VERSION_REQUIRED, устаревшая версия — 409 EDIT_CONFLICT. Для POST рекомендуется `Idempotency-Key: <UUID>`: повтор того же запроса возвращает сохранённый результат, использование ключа с другим DTO — 409. Ключи хранятся в PostgreSQL. Сохранение, проверка связей, версии и аудит выполняются в одной транзакции под общей PostgreSQL advisory lock.

DELETE players завершает периоды и устанавливает archivedAt, сохраняя публикацию исторического профиля. DELETE matches/news/gallery/staff переводит в ARCHIVED. Физическое удаление исторических/справочных записей запрещено: HISTORY_PROTECTED. Восстановление — PUT актуального DTO с очищенным archivedAt/нужным статусом.

Membership: playerId/teamId/seasonId, number, startsAt, endsAt, departureReason, nextClub, datesVerified. Интервалы `[start,end)` не пересекаются для игрока+команды; защита есть и в БД (GiST exclusion). Старые logical IDs сохранены, новые автоматически генерируемые IDs — UUID. Статистика привязана к стабильному PlayerSeason. Событие: matchId/playerId/teamId/eventKey/minute/type/description/cancelled/source. Типы GOAL/ASSIST/YELLOW/RED; ключ уникален в матче. Персональная строка уникальна для matchId+playerId.

Отдельные ресурсы:

- `GET/PUT /admin/settings`; PUT также требует If-Match существующей записи.
- `GET /admin/audit?page=1&q=<actorId>&entity=players` → items с actor, changes, result, createdAt.
- `GET/POST /admin/users`, `PUT /admin/users/:id`. DTO email/role/active/password (пароль необязателен при редактировании). Запрещены повышение полномочий ADMIN, блокировка себя/последнего SUPER_ADMIN. Изменение роли/пароля или деактивация отзывает сессии.
- `GET /admin/media`, `PUT /admin/media/:id {alt:{kk,ru,en}}`, `DELETE /admin/media/:id` (неиспользуемые файлы, ADMIN+).
- `POST /admin/media/upload`: multipart file, JPEG/PNG/WebP ≤10 MiB; ответ MediaAsset с WebP url, variants.avif/thumbnail, storage, размерами, version. Выдача `/uploads/<UUID>` через API с immutable cache и закрытой CSP. Нет произвольных filesystem paths или доступа к приватным S3 credentials.

Ошибки `{error:{code,fields?}}`: 400 VALIDATION_ERROR (+пути полей), INVALID_UPLOAD, INVALID_RELATION, PLAYER_NOT_IN_ROSTER; 401 UNAUTHORIZED/INVALID_CREDENTIALS; 403 CSRF_REJECTED/ADMIN_REQUIRED/NOT_OWNER/ROLE_ESCALATION; 409 EDIT_CONFLICT/CONFLICT/MEMBERSHIP_OVERLAP/HISTORY_PROTECTED/MEDIA_IN_USE/EVENT_SCORE_CONFLICT/MATCH_HAS_HISTORY; 428 VERSION_REQUIRED; 503 DATABASE_UNAVAILABLE. Пароли, session hashes и вложенные произвольные Prisma mutations универсальный CRUD не принимает. Ответы не содержат stack trace/секретов.
