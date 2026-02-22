# NexusNote

<div align="center">

**AI-Native Knowledge Management System with Real-time Collaboration**

*Build your second brain with cutting-edge AI technology*

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI_SDK-6.0-000000?logo=vercel)](https://sdk.vercel.ai/)

[Documentation](./docs) · [Deployment Guide](./DEPLOYMENT.md)

</div>

---

## What Makes NexusNote Special?

NexusNote isn't just another note-taking app. It's a **knowledge management system** that combines:

- **Multi-Model AI Architecture**: DeepSeek for reasoning, Qwen3 for embeddings, intelligent model orchestration
- **Advanced RAG System**: Vector search with pgvector, semantic chunking, and reranking
- **Real-time Collaboration**: Notion-like editing experience with Yjs + Hocuspocus
- **Scientific Learning**: FSRS-5 spaced repetition algorithm, AI-generated flashcards
- **Offline-First**: IndexedDB sync, works without internet
- **Cost-Effective**: $1/million tokens with DeepSeek (100x cheaper than GPT-4)

---

## Key Features

### Rich Text Editor
- **Collaborative Editing**: Real-time cursor presence and awareness
- **Markdown Support**: Write naturally with keyboard shortcuts
- **Custom Extensions**: Callouts, collapsible sections, tables
- **Slash Commands**: Quick access to AI features with `/`

### AI Assistant
- **Contextual Chat**: Understands your entire knowledge base
- **RAG-Powered Search**: Semantic search across all documents
- **Inline Actions**: Improve, translate, summarize, expand text
- **Tool Calling**: Create flashcards, search notes, generate learning plans

### Vector Search (RAG)
```
Your Document → Smart Chunking → Qwen3 Embedding (4000D) → pgvector
                                                                ↓
User Query → Embedding → Cosine Similarity → Reranker → Top Results
                                                                ↓
                                        DeepSeek Chat ← Context + Query
```

### Learning System
- **FSRS-5 Algorithm**: More accurate than Anki's SM-2
- **AI Flashcard Generation**: Automatically extract Q&A pairs
- **Progress Tracking**: Mastery level, review stats, time spent

### Timeline & Versioning
- **Auto Snapshots**: Every 5 minutes during editing
- **Diff Visualization**: See what changed between versions
- **One-Click Restore**: Revert to any previous state

---

## Architecture

### Modern Fullstack Design

NexusNote uses a **single Next.js fullstack application** deployed as three Kubernetes workloads from one Docker image:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        K3s Cluster                                       │
│                                                                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐         │
│  │  nexusnote-web │  │ nexusnote-collab│  │ nexusnote-worker │         │
│  │  Next.js API   │  │ Hocuspocus WS   │  │ BullMQ RAG       │         │
│  │  port 3000     │  │ port 1234       │  │ indexing          │         │
│  └────────────────┘  └─────────────────┘  └──────────────────┘         │
│           │                    │                    │                    │
│  ┌────────┴────────────────────┴────────────────────┘                   │
│  │                                                                      │
│  ├── PostgreSQL 16 + pgvector 0.8.0  (10Gi)                           │
│  └── Redis 7 + password auth          (1Gi)                            │
│                                                                          │
│  Cilium Gateway API ── https://juanie.art (Let's Encrypt TLS)          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 | Unified fullstack framework |
| **Editor** | Tiptap v3, Yjs | Rich text editing, CRDT sync |
| **Realtime** | Hocuspocus | WebSocket collaboration server |
| **Database** | PostgreSQL 16, pgvector | Relational data, vector search |
| **Queue** | BullMQ, Redis 7 | Async job processing |
| **AI** | Vercel AI SDK 6.x | Unified AI interface |
| **ORM** | Drizzle | Type-safe SQL queries |
| **CI/CD** | GitHub Actions, ArgoCD | Build + GitOps deployment |
| **Secrets** | Infisical Cloud | Centralized secret management |
| **TLS** | Cert-Manager, Let's Encrypt | Automatic certificate management |

### AI Model Strategy

```
Chat & Reasoning:
  Primary:  Gemini 3 Flash/Pro → Google AI Studio (free tier)
  Fallback: DeepSeek V3        → $1/M tokens (best value)

Embedding (4000D vectors):
  Qwen3-Embedding-8B → 302.ai or SiliconFlow

Reranking (optional):
  Qwen3-Reranker-8B → Two-stage retrieval
```

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker (for database services)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/997899594/nexusnote.git
cd nexusnote

# 2. Install dependencies
pnpm install

# 3. Start database services
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API keys

# 5. Run database migrations
pnpm db:push

# 6. Start all services
pnpm dev
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:3000 | Next.js frontend + API |
| Collaboration | ws://localhost:1234 | Hocuspocus WebSocket |
| PostgreSQL | localhost:5433 | Database |
| Redis | localhost:6380 | Queue & cache |

---

## Production Deployment

NexusNote uses **GitOps** for production deployment:

```
git push → GitHub Actions (lint + build) → GHCR → ArgoCD Image Updater → K3s
```

### One-Click Setup (first time only)

```bash
cd deploy
cp deploy.env.example deploy.env
vim deploy.env    # Fill in server IP, tokens, credentials
./init.sh --config deploy.env
```

### Day-to-Day

| Action | How |
|--------|-----|
| Deploy code | `git push` (auto) |
| Update config | Edit `values-prod.yaml` + `git push` |
| Update secrets | Infisical Dashboard (auto-sync) |
| View ArgoCD | `kubectl port-forward svc/argocd-server -n argocd 8080:443` |

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Project Structure

```
nexusnote/
├── app/                              # Next.js App Router
├── components/                       # UI Components
│   ├── ui/                           # Base UI Components
│   ├── editor/                       # Editor Components
│   ├── chat/                         # Chat Components
│   ├── auth/                         # Auth Components
│   └── shared/                       # Shared Components
├── lib/                              # Utilities & Services
│   ├── db.ts                         # Database Client
│   ├── ai.ts                         # AI Tools
│   ├── algorithm.ts                  # FSRS Algorithm
│   ├── queue.ts                      # BullMQ Queue
│   ├── rag/                          # RAG Services
│   └── utils.ts                      # Helper Functions
├── config/                           # Environment Config
├── types/                            # TypeScript Types
├── db/                               # Database Schema (Drizzle)
├── party/                            # PartyKit Collaboration Server
├── deploy/                           # K8s Deployment
├── docs/                             # Documentation
└── README.md
```

---

## Configuration

See [.env.example](./.env.example) for all options.

### Essential Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nexusnote

# Redis
REDIS_URL=redis://localhost:6379

# AI Provider (choose one or more)
AI_302_API_KEY=sk-xxx              # Recommended
DEEPSEEK_API_KEY=sk-xxx            # Alternative

# Authentication
AUTH_SECRET=<random-32-chars>       # openssl rand -base64 32
JWT_SECRET=<random-32-chars>
```

---

## Development

```bash
pnpm dev           # Start dev server
pnpm build         # Production build
pnpm lint          # Run linter
pnpm typecheck     # Type check

# Database
pnpm db:push       # Run migrations
pnpm db:studio     # Open Drizzle Studio
pnpm db:generate   # Generate migration files
```

---

## Documentation

- [Product Requirements](./docs/PRD.md) - Features and roadmap
- [AI System](./docs/AI.md) - Multi-model architecture, RAG, Interview FSM
- [Architecture Standards](./docs/ARCHITECTURE_2026.md) - Core design decisions
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment

---

## Roadmap

### Completed
- [x] Rich text editor with collaboration
- [x] AI chat with RAG
- [x] Vector search with pgvector
- [x] FSRS-5 spaced repetition
- [x] Timeline & version control
- [x] Agent system with tool calling
- [x] GitOps production deployment

### Planned
- [ ] Knowledge graph visualization
- [ ] Multi-modal support (images, PDFs)
- [ ] Mobile responsive design
- [ ] Plugin system

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Tiptap](https://tiptap.dev/) - Headless editor framework
- [Yjs](https://yjs.dev/) - CRDT for real-time collaboration
- [Vercel AI SDK](https://sdk.vercel.ai/) - Unified AI interface
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe SQL
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [FSRS](https://github.com/open-spaced-repetition/fsrs-rs) - Spaced repetition algorithm
