# CLARA w/ GRISEngine

**C**ontract & **L**egal **A**I **R**easoning **A**ssistant **W**ith **Grounded Retrieval Information System Engine**— analyze Indonesian legal contracts with a hybrid retrieval + reasoning pipeline over a Neo4j knowledge graph.

The stack: a TypeScript/Express backend (Neo4j, Redis/BullMQ, Gemini, local Transformers.js embeddings) and a React + Vite frontend.

## Running locally

👉 **See [`docs/LOCAL_DEMO.md`](docs/LOCAL_DEMO.md)** for the full step-by-step guide to running CLARA on your machine in demo mode — no Google OAuth and no paid embedding API required.

Quick start:

```bash
docker compose up -d neo4j redis
cd backend  && npm install && npm run init-schema && npm run seed:pdf && npm run dev
cd frontend && npm install && npm run dev
# open http://localhost:5173 — auto–signed in as Demo User
```

> Demo mode bypasses login and uses local PDF parsing + embeddings. Chat/reasoning still requires a working `GOOGLE_AI_API_KEY`. See the demo guide for details and how to revert to production behavior.
