# Digital Projects & Comms Hub

A small, traditional full stack web app for tracking digital projects and planning communications (website, social, email, newsletter, events).

| Layer | Tech | Where |
|---|---|---|
| Markup | semantic HTML5, labelled forms, skip link, ARIA live regions | `public/index.html` |
| Styling | plain CSS: custom properties, grid/flexbox, responsive, dark mode, focus styles, reduced motion | `public/css/styles.css` |
| Frontend logic | vanilla JavaScript (ES modules), `fetch`, safe DOM building | `public/js/` |
| API | REST/JSON on Express: validation, filtering, search, proper status codes | `src/app.js`, `src/validate.js` |
| Data | JSON file store behind a small class (swap for SQLite/Postgres later) | `src/store.js`, `data/` |
| Tests | Node's built-in test runner, no extra libraries | `test/` |

## Run it

Needs Node 18+ (https://nodejs.org).

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # auto-restart on changes
npm test
```

On first start the app copies `data/seed.json` to `data/db.json` (git-ignored). Delete `db.json` to reset the demo data.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness check |
| GET | `/api/meta` | allowed channels and statuses (the UI builds its dropdowns from this) |
| GET | `/api/stats` | counts by status, overdue projects |
| GET | `/api/projects` | filters: `?status=`, `?channel=`, `?q=` (searches title, owner, notes) |
| POST | `/api/projects` | `201` with the new record, `400` with `details` on bad input |
| GET / PUT / DELETE | `/api/projects/:id` | PUT merges fields then re-validates; DELETE returns `204` |
| GET, POST | `/api/posts` | announcements: title, body, channel, status, publishDate |
| GET / PUT / DELETE | `/api/posts/:id` | same behaviour as projects |

Example:

```bash
curl -X POST localhost:3000/api/projects -H "Content-Type: application/json" \
  -d '{"title":"Alumni email series","owner":"Dana","channel":"email","dueDate":"2026-12-10"}'
```

## Things worth pointing out in an interview

* The frontend builds DOM with `textContent`, never `innerHTML`, so user text can't inject markup.
* Validation lives in one module and the server never trusts the client; unknown fields are dropped.
* Keyboard and screen reader basics: labels on every control, skip link, `aria-live` lists, visible focus.
* Writes go to a temp file then rename, so a crash can't leave a half-written database.

## Ideas to extend it

User login, drag-and-drop status board, calendar view of publish dates, SQLite instead of JSON, CSV export of the content calendar.
