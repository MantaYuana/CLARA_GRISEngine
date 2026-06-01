# CLARA AI – Backend ⚖️🤖
**Contract & Legal AI Reasoning Assistant**

This repository contains the core backend services for **CLARA AI**, a multi-agent legal reasoning system designed to help MSMEs (UMKM) navigate legal documents, draft agreements, and perform compliance checks with high confidence and deterministic guardrails.

---

## 🚀 Core Features

- **Multi-Turn Document Drafter**: Agentic workflow for drafting MoU, LoI, and PKS with interactive clarification turns.
- **Hybrid Retrieval (RAG)**: Combines Vector (Dense), BM25 (Keyword), and Symbolic (Knowledge Graph) retrieval for high-accuracy legal context.
- **Contract Review Pipeline**: Segment-by-segment analysis of contracts with risk detection against Indonesian regulations.
- **Legal Q&A (Query)**: Conversational interface with citations and reasoning path visualization.
- **Async OCR Processing**: Scalable document analysis using Google Cloud Vision and Gemini-1.5-Flash.
- **Knowledge Graph Integration**: Powered by Neo4j to store legal cross-references and document relationships.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (TypeScript)
- **Framework**: Express.js
- **Database**: Neo4j (Graph Database + Vector Search)
- **AI Models**: Google Gemini (1.5-Flash, Pro, Embedding-001)
- **OCR**: Google Cloud Vision API
- **Task Queue**: BullMQ (Redis)
- **Auth**: Passport.js (Google OAuth 2.0) + JWT

---

## 📋 Prerequisites

- **Neo4j Desktop / Aura**: Ensure a Neo4j instance is running (Active Graph + Vector Index).
- **Redis**: Required for the async task queue.
- **Google Cloud Credentials**: API Key with Generative AI and Vision API enabled.
- **Docker** (Optional): For running dependency services.

---

## ⚙️ Installation & Setup

1. **Clone and Install**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the `backend` directory based on the following variables:
   ```env
   # Server
   PORT=3001
   JWT_SECRET=your_jwt_secret
   FRONTEND_URL=your_frontend_url

   # Neo4j
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your_password

   # AI / LLM
   GOOGLE_AI_API_KEY=your_google_api_key
   GEMINI_MODEL=gemini-1.5-flash
   EMBEDDING_MODEL=gemini-embedding-001

   # OAuth
   GOOGLE_CLIENT_ID=your_id
   GOOGLE_CLIENT_SECRET=your_secret

   # Infrastructure
   REDIS_URL=redis://localhost:6379
   ```

3. **Initialize Database Schema**
   ```bash
   npm run init-schema
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

---

## 📖 Main Scripts

- `npm run dev`: Starts the server with live reload.
- `npm run build`: Compiles TypeScript to JavaScript in `/dist`.
- `npm run start`: Runs the production build.
- `npm run init-schema`: Initializes Neo4j constraints and indices.
- `npm run seed:pdf`: Seeds the graph with foundational legal documents from `/base_knowledge`.

---

## 🔗 API Documentation

CLARA comes with built-in Swagger documentation. Once the server is running, visit:
`http://localhost:3001/api/docs`

Deployed

`https://claraai.my.id/api/docs/#/`

---

## 📁 Directory Structure

```text
src/
├── config/       # Environment, Neo4j, Passport, and Swagger setup
├── middleware/   # Authentication and global handlers
├── routes/       # Express endpoints (Query, Drafter, Document, etc.)
├── services/     # core business logic (Reasoning, Retrieval, OCR)
├── workers/      # BullMQ workers for background analysis
├── scripts/      # Database seeding and initialization
└── utils/        # Shared helper functions
```
