# URL Shortener

A full-stack URL shortener application built with React + Vite on the client and Express + MongoDB + Redis on the server.

## Project structure

- `client-app/` — React front-end application
- `server-app/` — Express back-end API service

## Features

- Shorten long URLs into compact links
- Redirect users from short link to original URL
- QR code generation for shorter links
- Click tracking in MongoDB
- Redis caching for faster lookups
- Rate limiting on shorten requests
- CORS configured for the client origin

## Prerequisites

- Node.js (recommend v18+)
- npm
- MongoDB database
- Redis server or Redis-compatible cache provider

## Setup

### 1. Install dependencies

From the project root:

```bash
cd client-app
npm install

cd ../server-app
npm install
```

### 2. Configure environment variables

#### `server-app/.env`

Copy `server-app/.env.example` to `server-app/.env` and update the values with your environment settings:

```env
MONGO_URI=<your MongoDB connection string>
PORT=5000
BASE_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
REDIS_URL=<your Redis connection string>
NODE_ENV=development
```

- `MONGO_URI`: MongoDB Atlas or local MongoDB URI
- `BASE_URL`: Backend base URL used for generating short links
- `CLIENT_URL`: Frontend origin allowed by CORS
- `REDIS_URL`: Redis connection string, e.g. `redis://127.0.0.1:6379`

#### `client-app/.env`

Create or update `client-app/.env` with:

```env
VITE_BACKEND_URL=http://localhost:5000
```

## Running the app

### Start the backend server

```bash
cd server-app
npm run dev
```

The backend should start on the port configured in `server-app/.env` (default `5000`).

### Start the frontend app

```bash
cd client-app
npm run dev
```

Visit the Vite dev server URL printed in the terminal (default `http://localhost:5173`).

## How it works

- Frontend sends `POST /shorten` to the server with `originalUrl`.
- Server generates a short ID, saves the mapping in MongoDB, and caches it in Redis.
- The server returns `shortUrl`, `shortId`, and a QR code.
- Visiting `GET /:shortId` on the server redirects to the original URL.

## Important notes

- Do not commit secrets or `.env` files to version control.
- The server currently uses an in-code Redis client configuration and should be updated to use `REDIS_URL` from environment variables.
- Input validation and error handling are minimal, so sanitize and validate URLs before production use.

