# NexusNote

AI-Powered Local-First Knowledge Base

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start database services
docker compose up -d

# 3. Copy environment file
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env
# Edit files and add your OPENAI_API_KEY

# 4. Initialize database
docker exec -i nexusnote-db psql -U postgres -d nexusnote < packages/db/migrations/001_init.sql

# 5. Start development servers
pnpm dev
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Web | http://localhost:3000 | Next.js frontend |
| API | http://localhost:3001 | NestJS backend |
| Collab | ws://localhost:1234 | Hocuspocus WebSocket |
| RAG API | http://localhost:3001/rag | RAG search endpoint |

## Project Structure

```
nexusnote/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   │   ├── api/chat/       # AI chat API (with RAG)
│   │   │   ├── api/completion/ # AI completion API
│   │   │   └── editor/[id]/    # Editor page
│   │   ├── components/
│   │   │   ├── editor/         # Tiptap editor + toolbar
│   │   │   └── ai/             # Chat sidebar
│   │   └── hooks/              # useInlineAI
│   └── server/                 # NestJS backend
│       └── src/
│           ├── collaboration/  # Hocuspocus server
│           ├── rag/            # RAG service + worker
│           └── queue/          # BullMQ queue
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   └── ui/                     # Shared components
└── docs/
    ├── PRD.md
    └── TRD.md
```

## Development Phases

- [x] **Phase 1**: Offline Editor (Tiptap + IndexedDB)
- [x] **Phase 2**: Real-time Collaboration (Hocuspocus + Awareness)
- [x] **Phase 3**: AI Chat Sidebar (useChat + streaming)
- [x] **Phase 4**: Inline AI Assistant (BubbleMenu + SlashCommand)
- [x] **Phase 5**: RAG Knowledge Retrieval (BullMQ + pgvector)
- [ ] **Phase 6**: Production Deployment

## Features

### Editor
- Rich text editing with Tiptap
- Real-time collaboration with cursor presence
- Offline support via IndexedDB
- Slash command menu (`/`)

### AI Assistant
- Streaming chat sidebar
- RAG-powered knowledge search
- Inline AI actions (improve, translate, summarize...)
- Context-aware responses

### RAG Pipeline
```
Document Edit → Debounce 10s → BullMQ Queue → Embedding → pgvector
     ↓
User Query → Embedding → Cosine Similarity → Top-K → LLM with Context
```

## Tech Stack

- **Frontend**: Next.js 14, Tiptap, Yjs, Tailwind CSS, Jotai
- **Backend**: NestJS, Hocuspocus, BullMQ
- **Database**: PostgreSQL, pgvector, Drizzle ORM
- **AI**: Vercel AI SDK, OpenAI (GPT-4o-mini, text-embedding-3-small)
- **Infra**: Turborepo, Docker, Redis

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | AI chat (supports RAG) |
| `/api/completion` | POST | Text completion |
| `/rag/search?q=xxx` | GET | RAG similarity search |
| `/documents` | GET/POST | Document CRUD |

## Documentation

- [PRD](./docs/PRD.md) - Product Requirements
- [TRD](./docs/TRD.md) - Technical Requirements

## License

MIT
