# NexusNote

<div align="center">

**AI-Native Learning and Knowledge Workspace**

*Turn a learning goal into a course, notes, and ongoing progress.*

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI_SDK-6.0-000000?logo=vercel)](https://sdk.vercel.ai/)

[Documentation](./docs) · [Deployment Guide](./DEPLOYMENT.md)

</div>

---

## What Makes NexusNote Special?

NexusNote is a **learning-first knowledge system** that combines:

- **Structured AI course creation**: turn a goal into an outline, then into a course
- **Context-aware chat and notes**: AI works across learning content and personal notes
- **Advanced RAG**: pgvector search, semantic chunking, and reranking
- **Realtime editing foundation**: collaborative editing built on Yjs + PartyKit
- **Scientific learning support**: FSRS-5 scheduling, progress tracking, and review workflows

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
Your Content → Smart Chunking → Embedding (4000D) → pgvector
                                                                ↓
User Query → Embedding → Cosine Similarity → Reranker → Top Results
                                                                ↓
                                        AI Response ← Context + Query
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

NexusNote uses a **single Next.js fullstack application** with specialized runtimes around it:

```
┌───────────────────────────────────────────────────────────────┐
│                      NexusNote Runtime                        │
│                                                               │
│  ┌─────────────────────┐   ┌───────────────────────────────┐  │
│  │ Next.js 16 App      │   │ Background / async workers    │  │
│  │ pages + APIs + RSC  │   │ indexing, generation, sync    │  │
│  └─────────────────────┘   └───────────────────────────────┘  │
│              │                           │                    │
│  ┌───────────┴───────────────────────────┴─────────────────┐  │
│  │ PostgreSQL 16 + pgvector     Redis 7                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Optional realtime editing runtime: PartyKit + Yjs           │
└───────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 + React 19 | Unified fullstack framework |
| **Editor** | Tiptap v3, Yjs | Rich text editing, CRDT sync |
| **Realtime** | PartyKit | Realtime collaboration runtime |
| **Database** | PostgreSQL 16, pgvector | Relational data, vector search |
| **Queue** | BullMQ, Redis 7 | Async job processing |
| **AI** | Vercel AI SDK 6.x | Unified AI interface |
| **Markdown** | Streamdown | Streaming markdown renderer |
| **Animation** | Framer Motion 12 | Smooth animations |
| **Styles** | Tailwind CSS 4 | Utility-first CSS |
| **ORM** | Drizzle | Type-safe SQL queries |
| **CI/CD** | GitHub Actions + image deploy | Build and publish images |
| **Secrets** | Platform environment variables | Runtime configuration |

### AI Model Strategy

```
Chat & Generation:
  Primary:  302.ai-backed models
  Fallback: OpenAI / DeepSeek

Embedding (4000D vectors):
  BAAI/bge-base-zh-v1.5

Runtime patterns:
  ToolLoopAgent for open-ended chat
  Structured streaming for interview
  Workflows for course creation and generation
```

---

## Quick Start

### Prerequisites

- Bun
- Node.js >= 20
- Docker (for local database services)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/997899594/nexusnote.git
cd nexusnote

# 2. Install dependencies
bun install

# 3. Start database services
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API keys

# 5. Run database migrations
bun run db:migrate

# 6. Start all services
bun dev
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:3000 | Next.js frontend + API |
| PostgreSQL | localhost:5433 | Database |
| Redis | localhost:6380 | Queue & cache |

---

## Production Deployment

NexusNote deploys as a container image.

```text
git push -> CI build -> image registry -> deployment platform rollout -> database migration
```

The repository no longer maintains Helm, ArgoCD, or cluster manifests.

For deployment variables and rollout notes, see [deploy/README.md](./deploy/README.md) and
[DEPLOYMENT.md](./DEPLOYMENT.md).

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
├── deploy/                           # Image deployment notes
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

# AI Provider
AI_302_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx              # Optional fallback
DEEPSEEK_API_KEY=sk-xxx            # Optional fallback

# Authentication
AUTH_SECRET=<random-32-chars>       # openssl rand -base64 32
JWT_SECRET=<random-32-chars>
```

---

## Development

```bash
bun dev           # Start dev server
bun run build     # Production build
bun run lint      # Run linter
bun run typecheck # Type check

# Database
bun run db:migrate    # Apply versioned migrations
bun run db:push       # Push schema directly (local dev only)
bun run db:studio     # Open Drizzle Studio
bun run db:generate   # Generate migration files
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
- [x] Container image deployment pipeline

### Planned
- [ ] Knowledge graph visualization
- [ ] Multi-modal support (images, PDFs)
- [ ] Mobile responsive design
- [ ] Plugin system

---

## 开发指南

### RSC 架构

本项目采用 Server Components + Client Components 分层架构：

- **Server Components**: 数据获取、初始渲染
- **Client Components**: 交互、动画、状态管理

### 添加新页面

1. 创建 `app/your-page/page.tsx` (Server Component)
2. 创建 `app/your-page/your-page-client.tsx` (Client Component)
3. Server 获取数据，传递给 Client

### 流式 Markdown

使用 `StreamdownMessage` 组件渲染 AI 响应：

```tsx
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";

<StreamdownMessage content={aiResponse} isStreaming={true} />
```

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
