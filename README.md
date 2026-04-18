# URL Shortener

A full-stack URL shortener built with React + Vite on the client and Express + MongoDB + Redis on the server.

## Project structure

```
url-shortner-new/
├── client-app/   — React front-end (Vite + Tailwind + DaisyUI)
└── server-app/   — Express REST API
```

## Features

- Shorten long URLs into compact links
- Custom alias support (3–30 chars: letters, numbers, `-` or `_`)
- Link expiry options (1d, 7d, 30d, 1y) with automatic TTL cleanup
- QR code generation for every short link
- Click tracking with last-click timestamp
- Redis caching for fast redirects
- SSRF protection (blocks private IPs, loopback, metadata endpoints)
- Rate limiting on all endpoints
- CORS whitelist-based

## Prerequisites

- Node.js v18+
- npm
- MongoDB (local or Atlas)
- Redis (local or managed, e.g. Upstash)

## Setup

### 1. Install dependencies

```bash
cd client-app && npm install
cd ../server-app && npm install
```

### 2. Configure environment variables

#### `server-app/.env`

Copy `.env.example` to `.env` and fill in your values:

```env
MONGO_URI=<your MongoDB connection string>
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000
REDIS_URL=redis://127.0.0.1:6379
SHORT_ID_LENGTH=7
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `BASE_URL` | No | `http://localhost:5000` | Used when building short link URLs |
| `REDIS_URL` | No | `redis://127.0.0.1:6379` | Redis connection string |
| `SHORT_ID_LENGTH` | No | `7` | Length of auto-generated short IDs |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:5174` | Comma-separated CORS whitelist |

#### `client-app/.env`

Copy `.env.example` to `.env`:

```env
VITE_BACKEND_URL=http://localhost:5000/api
```

## Running the app

### Backend

```bash
cd server-app
npm run dev     # development (nodemon)
npm start       # production
```

Server starts on `PORT` (default `5000`).

### Frontend

```bash
cd client-app
npm run dev     # development (Vite HMR)
npm run build   # production build → dist/
npm run preview # preview production build
```

Vite dev server runs at `http://localhost:5173`.

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/shorten` | Shorten a URL |
| `GET` | `/api/stats/:shortId` | Get click stats |
| `GET` | `/:shortId` | Redirect to original URL |
| `GET` | `/health` | Health check (Mongo + Redis status) |

### `POST /api/shorten`

```json
{
  "originalUrl": "https://example.com/very/long/path",
  "alias": "my-link",   // optional
  "expiry": "7d"        // optional: 1d | 7d | 30d | 1y
}
```

## How it works

1. Client sends `POST /api/shorten` with `originalUrl`.
2. Server validates URL (Joi + SSRF check), generates a short ID or uses the custom alias, and saves to MongoDB.
3. Redis caches the mapping for fast lookups (TTL matches link expiry).
4. Server returns `shortUrl`, `shortId`, QR code data URL, and `expiresAt`.
5. `GET /:shortId` checks Redis first, falls back to MongoDB, then 302-redirects.

## Notes

- Do not commit secrets or `.env` files to version control.
- The server currently uses an in-code Redis client configuration and should be updated to use `REDIS_URL` from environment variables.
- Input validation and error handling are minimal, so sanitize and validate URLs before production use.

## Recommended improvements

- Add input validation on the server for `originalUrl`.
- Use HTTPS in production for `BASE_URL` and `CLIENT_URL`.
- Move any secret values into secure environment configuration.
- Remove unused files and duplicate Redis utility code from `server-app/src/`.
