# UsTogether

A horizontal memory timeline for couples.

## Stack
- React + Vite
- Tailwind CSS
- Framer Motion
- Express.js
- PostgreSQL planned for the next iteration

## Deployment shape
- Frontend: static hosting such as GitHub Pages
- Backend: separate Express deployment such as Render, Railway, Fly.io, or a VPS
- Client env var: `VITE_API_BASE_URL`
- Server env vars: `PORT` and `CORS_ORIGIN`

## Current implementation
- Horizontal timeline with Polaroid-style cards
- Detail modal for a memory
- Basic create/delete API flow for memories
- Shared workspace scaffolding on the backend

## Run
1. Install dependencies in the root and both workspace packages.
2. Start the API and client with the root `dev` script.
3. Open the Vite app in the browser and use the memory composer.

## Environment
- `client/.env.local`: `VITE_API_BASE_URL=http://localhost:3001`
- `server/.env` or host env: `PORT=3001`, `CORS_ORIGIN=http://localhost:5173`
