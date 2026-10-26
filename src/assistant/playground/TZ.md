# Notes API (Node.js)

REST API для заметок на Node.js 20 + Express 4 + better-sqlite3.

## Модель Note
- id: string UUID v4 (генерируется crypto.randomUUID())
- title: string 1–200, обязательное
- body: string до 10000, может быть пустым
- tags: array<string> до 10, каждый 1–30 символов
- created_at, updated_at: ISO 8601 UTC (new Date().toISOString())

## Эндпоинты

- POST /notes
  body: {title, body?, tags?}
  → 201 {id, title, body, tags, created_at, updated_at}
  → 422 {detail} если title пустой или > 200

- GET /notes
  query: limit (1–100, default 20), offset (≥0, default 0), tag (optional)
  → 200 {items: [...], total: number}
  Сортировка created_at DESC. Фильтр по tag — если передан.

- GET /notes/:id
  → 200 Note | 404 {detail: "not found"}

- PATCH /notes/:id
  body: любое подмножество {title?, body?, tags?}
  → 200 Note | 404 | 422 (те же правила, что в POST)
  updated_at обновляется автоматически.

- DELETE /notes/:id
  → 204 | 404

- GET /notes/search?q=...
  Поиск по title и body, case-insensitive, substring.
  → 200 {items, total}
  Пустой q → 422.

## Требования
- Express, `createApp()` экспортируется из `src/app.js` — для supertest
- `src/server.js` импортирует createApp() и слушает порт из env
- better-sqlite3, файл БД из env DB_PATH, схема создаётся при старте (CREATE TABLE IF NOT EXISTS)
- zod для валидации body/query
- Ошибки — res.status(code).json({detail: "..."})
- ES modules (import/export), package.json уже с "type": "module"

## Тесты
- node --test, supertest(app)
- In-memory SQLite (better-sqlite3(":memory:") для каждого теста)
- Покрыть: создание, валидацию title (пустой, > 200), пагинацию, фильтр по tag, поиск, 404 на GET/PATCH/DELETE

## Что НЕ надо
- TypeScript, tsconfig, eslint, prettier
- Dockerfile, CI, README
- Аутентификация
- Миграции (CREATE TABLE IF NOT EXISTS достаточно)