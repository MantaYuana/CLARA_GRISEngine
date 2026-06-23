# Running CLARA Locally (Demo Mode)

This guide gets CLARA running on your machine **without Google OAuth** and **without paid Google embedding APIs**, so you can demo the app offline-friendly. It assumes a clean checkout.

> **TL;DR**
> 1. `docker compose up -d neo4j redis`
> 2. Set demo flags in `backend/.env` and `frontend/.env` (already set in this repo — see below)
> 3. `cd backend && npm install && npm run init-schema && npm run seed:pdf && npm run dev`
> 4. `cd frontend && npm install && npm run dev`
> 5. Open http://localhost:5173 → you're auto–signed in as **Demo User**

---

## What "demo mode" changes

| Concern | Production | Demo mode |
| --- | --- | --- |
| Login | Google OAuth → JWT | **Bypassed.** One fixed "Demo User", no login click |
| PDF text extraction | Gemini multimodal API | **Local** `pdf-parse` (offline); Gemini only as fallback |
| Embeddings | Google `gemini-embedding-001` | **Local** Transformers.js (`Xenova/multilingual-e5-base`, runs offline) |
| Chat / reasoning (Q&A, drafter, contract review) | Gemini API | Still Gemini — **needs a working `GOOGLE_AI_API_KEY`** |

Everything is gated behind env flags and is fully reversible — set the flags to `false` (or remove them) to restore production behavior.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** (for Neo4j + Redis), or your own local Neo4j 5.x and Redis
- A **Google AI (Gemini) API key** with available quota — required for the chat/reasoning features (Q&A, drafter, contract review). Seeding and embeddings no longer need it.

---

## 1. Start infrastructure (Neo4j + Redis)

```bash
docker compose up -d neo4j redis
```

This launches:
- **Neo4j** on `bolt://localhost:7687` (browser UI at http://localhost:7474, user `neo4j` / pass `clara_password`)
- **Redis** on `localhost:6379`

> You can also run the full stack (`docker compose up -d`) to include the backend container, but for development the steps below run the backend directly with hot reload.

---

## 2. Configure environment

### `backend/.env`

```ini
PORT=3001
NODE_ENV=development

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=clara_password

# Gemini — still required for chat/reasoning
GOOGLE_AI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash

# Local embedding model (offline, no API)
EMBEDDING_MODEL=Xenova/multilingual-e5-base
EMBEDDING_DIMENSION=768

REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173

# ── Local demo bypass (set false / remove for production) ──
AUTH_BYPASS=true
DEMO_USER_ID=demo-user
DEMO_USER_EMAIL=demo@clara.local
DEMO_USER_NAME=Demo User
```

### `frontend/.env`

```ini
VITE_API_URL=http://localhost:3001/api/v1
VITE_AUTH_BYPASS=true
```

> ⚠️ **Vite reads `.env` only at startup.** If you change `VITE_*` values, restart `npm run dev`.

---

## 3. Initialize and seed the backend

```bash
cd backend
npm install
npm run init-schema     # creates Neo4j constraints + vector indexes
npm run seed:pdf        # parses PDFs in backend/base_knowledge/ and embeds them locally
npm run dev             # starts the API on http://localhost:3001 with hot reload
```

- `seed:pdf` reads every PDF in `backend/base_knowledge/` (Indonesian legal documents ship with the repo), extracts text with local `pdf-parse`, segments into clauses, embeds each clause with the local Transformers model, and writes them to Neo4j.
- The embedding model (~130 MB ONNX) downloads on first run and is cached afterward.

Useful seed flags:

```bash
npm run seed:pdf -- --dry-run    # preview clauses, no DB writes
npm run seed:pdf -- --force      # re-seed even if a Law node already exists
```

---

## 4. Start the frontend

```bash
cd frontend
npm install
npm run dev      # Vite dev server on http://localhost:5173
```

---

## 5. Use the app

Open **http://localhost:5173**. Because demo mode is on:

- You're automatically signed in as **Demo User** — no login screen, no Google.
- The `/auth` page (if reached) immediately redirects into the workspace.
- All data is owned by a single fixed user (`demo-user`), so everything you create is visible across the app.

Try: create a project ("Create New" / "Buat Proyek Baru"), upload a contract PDF in the **Sources** panel, then ask questions or run a contract review.

---

## Reverting to production behavior

1. In `backend/.env`: set `AUTH_BYPASS=false` (or remove it). Restore `EMBEDDING_MODEL=gemini-embedding-001` if you want Google embeddings. Set real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `JWT_SECRET` / `FRONTEND_URL`.
2. In `frontend/.env`: set `VITE_AUTH_BYPASS=false` (or remove it) and point `VITE_API_URL` at your deployed backend.
3. Restart both servers.

No application code needs to change — the demo behavior lives entirely behind these flags.

---

## Migrating after the retrieval upgrade

If you already had CLARA running locally and pull in the document-grounded retrieval changes, re-run the migration steps so existing data picks up the new schema, embeddings, and document segmentation:

```bash
cd backend
npm run init-schema      # adds/updates constraints + vector indexes for the new retrieval schema
npm run reembed          # re-embeds the knowledge base with E5 query/passage prefixes
npm run reprocess-docs   # re-segments stored documents into Pasal + ayat
```

- `init-schema` is idempotent — safe to re-run even if you've already initialized the database.
- `reembed` re-generates embeddings for existing knowledge base entries so they use the correct E5 query/passage prefixing expected by the new retriever.
- `reprocess-docs` re-segments previously ingested documents into structured Pasal/ayat units so the structural retriever can address them.

If you're running the backend via Docker, these steps run automatically as part of the container `CMD` on the next rebuild (`docker compose up -d --build backend`) — no manual steps needed.

---

## Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| Backend exits on startup with `missing required env var: GOOGLE_AI_API_KEY` | A Gemini key is mandatory even in demo mode (chat/reasoning use it). Add it to `backend/.env`. |
| Chat returns `429 Too Many Requests / prepayment credits depleted` | Your Gemini quota is exhausted. Seeding/embeddings are local and unaffected, but Q&A/drafter/contract review need Gemini quota. |
| `Create New` briefly opens the chat page then bounces back to `/workspace` | The demo auth wasn't picked up. Ensure `VITE_AUTH_BYPASS=true` and **restart** the Vite dev server. (Fixed in `useAuth` — it now resolves a synthetic demo user.) |
| `seed:pdf` finds no PDFs | Confirm files exist in `backend/base_knowledge/`. |
| Neo4j connection errors | Ensure `docker compose up -d neo4j` is running and `NEO4J_URI`/credentials match `docker-compose.yml`. |
| Vector search returns empty | Run `npm run init-schema` then `npm run seed:pdf` before querying. |