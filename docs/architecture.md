THRIVE - Architecture Overview

Monorepo layout

- frontend/  -> Next.js + TypeScript + Tailwind UI
- backend/   -> FastAPI + SQLAlchemy + Alembic
- worker/    -> Celery + OR-Tools solver + background tasks
- curriculum/-> canonical schema + seed data
- infra/     -> docker-compose, nginx proxy (optional)
- docs/      -> architecture and developer docs

Core components

1. Frontend (Next.js)
   - Pages: dashboard, curriculum, compiler, assistant, training, updates, community, profile
   - UI system: Tailwind, design tokens, i18n (Hindi primary + English fallback)
   - Auth: JWT via NextAuth or custom flow to FastAPI

2. Backend (FastAPI)
   - REST APIs for auth, curriculum CRUD, compiler trigger, assistant RAG endpoints, training courses, updates, community interactions
   - Database: PostgreSQL
   - Background tasks via Celery/RQ and Redis
   - Vector store: FAISS local for initial prototype

3. Worker
   - Deterministic Multi-Grade Compiler using OR-Tools CP-SAT
   - Curriculum ingestion tasks (PDF parsing, manual validation)
   - Assistant RAG indexing (embeddings) and maintenance

4. Data & storage
   - Postgres for structured data
   - S3-compatible for media and PDFs
   - Local FAISS index files in initial dev

5. AI and RAG
   - Embeddings via OpenAI or SentenceTransformers
   - LLM calls configurable (OpenAI, Anthropic, local model)
   - RAG pipeline with citation metadata

Security & privacy

- JWT authentication
- Minimal PII collection
- Role-based access control

Deployment

- Docker compose for dev
- Production: Docker + managed DB (Supabase / RDS) + hosted vector DB when required

Next steps

- Curriculum ingestion automation (NCERT + Bihar SCERT)
- Implement OR-Tools solver and UI integration
- Build RAG assistant pipeline and chat UI
- Implement Training & Community modules with persistence and moderation

