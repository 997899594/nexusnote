# NexusNote

<div align="center">

**AI-Native Knowledge Management System with Real-time Collaboration**

*Build your second brain with cutting-edge AI technology*

[![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render)](https://render.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI_SDK-6.0-000000?logo=vercel)](https://sdk.vercel.ai/)

[Demo](https://nexusnote-web.onrender.com) · [Documentation](./docs) · [Report Bug](https://github.com/yourusername/nexusnote/issues)

</div>

---

## ✨ What Makes NexusNote Special?

NexusNote isn't just another note-taking app. It's a **knowledge management system** that combines:

- 🤖 **Multi-Model AI Architecture**: DeepSeek for reasoning, Qwen3 for embeddings, intelligent model orchestration
- 🔍 **Advanced RAG System**: Vector search with pgvector, semantic chunking, and reranking
- 👥 **Real-time Collaboration**: Notion-like editing experience with Yjs + Hocuspocus
- 🧠 **Scientific Learning**: FSRS-5 spaced repetition algorithm, AI-generated flashcards
- 📴 **Offline-First**: IndexedDB sync, works without internet
- 💰 **Cost-Effective**: $1/million tokens with DeepSeek (100x cheaper than GPT-4)

---

## 🎯 Key Features

### 📝 Rich Text Editor
- **Collaborative Editing**: Real-time cursor presence and awareness
- **Markdown Support**: Write naturally with keyboard shortcuts
- **Custom Extensions**: Callouts, collapsible sections, tables
- **Slash Commands**: Quick access to AI features with `/`

### 🤖 AI Assistant
- **Contextual Chat**: Understands your entire knowledge base
- **RAG-Powered Search**: Semantic search across all documents
- **Inline Actions**: Improve, translate, summarize, expand text
- **Tool Calling**: Create flashcards, search notes, generate learning plans

### 🔍 Vector Search (RAG)
```
Your Document → Smart Chunking → Qwen3 Embedding (4000D) → pgvector
                                                                ↓
User Query → Embedding → Cosine Similarity → Reranker → Top Results
                                                                ↓
                                        DeepSeek Chat ← Context + Query
```

**Features:**
- Semantic chunking with paragraph awareness
- Chunk overlap for context preservation
- Two-stage retrieval with reranking
- Async indexing with BullMQ queue

### 🎓 Learning System
- **FSRS-5 Algorithm**: More accurate than Anki's SM-2
- **AI Flashcard Generation**: Automatically extract Q&A pairs
- **Progress Tracking**: Mastery level, review stats, time spent
- **Structured Learning**: AI-generated chapter breakdowns

### 📊 Timeline & Versioning
- **Auto Snapshots**: Every 5 minutes during editing
- **Diff Visualization**: See what changed between versions
- **One-Click Restore**: Revert to any previous state
- **Trigger Tracking**: Manual, auto, AI edit, collaboration

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, React 18 | Server-side rendering, routing |
| **Editor** | TiptapV3, Yjs | Rich text editing, CRDT sync |
| **Backend** | NestJS, Hocuspocus | REST API, WebSocket server |
| **Database** | PostgreSQL 16, pgvector | Relational data, vector search |
| **Cache** | Redis, BullMQ | Queue management, async jobs |
| **AI** | Vercel AI SDK 6.x | Unified AI interface |
| **ORM** | Drizzle | Type-safe SQL queries |
| **Monorepo** | Turborepo, pnpm | Build orchestration, workspace |

### AI Model Strategy

```typescript
// Chat & Reasoning
DeepSeek-V3 → $1/M tokens, 128K context

// Embedding (4000D vectors)
Qwen3-Embedding-8B → 302.ai, MRL truncation

// Reranking (optional)
Qwen3-Reranker-8B → Two-stage retrieval
```

**Why this combo?**
- DeepSeek: Best price/performance for reasoning
- Qwen3: SOTA Chinese+English embeddings
- 302.ai: One API for multiple models

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker (for local development)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/yourusername/nexusnote.git
cd nexusnote

# 2. Install dependencies
pnpm install

# 3. Start database services
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API keys:
# - DEEPSEEK_API_KEY
# - AI_302_API_KEY

# 5. Run database migrations
pnpm --filter @nexusnote/db migrate

# 6. Start development servers
pnpm dev
```

### Access Services

| Service | URL | Description |
|---------|-----|-------------|
| 🌐 Web App | http://localhost:3000 | Next.js frontend |
| 🔌 API Server | http://localhost:3001 | NestJS backend |
| 🔄 Collaboration | ws://localhost:1234 | Hocuspocus WebSocket |
| 🗄️ PostgreSQL | localhost:5433 | Database |
| 📮 Redis | localhost:6380 | Queue & cache |

---

## 🌍 Production Deployment

### Deploy to Render (Free Tier)

1. **Fork this repository**

2. **Create Upstash Redis** (free)
   - Sign up at [upstash.com](https://upstash.com)
   - Create database, copy Redis URL

3. **Connect to Render**
   - Import repository
   - Render auto-detects `render.yaml`

4. **Configure Environment Variables**

   **nexusnote-server:**
   ```bash
   DEEPSEEK_API_KEY=sk-xxx
   AI_302_API_KEY=sk-xxx
   REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
   JWT_SECRET=your-secret-key
   ```

   **nexusnote-web:**
   ```bash
   DEEPSEEK_API_KEY=sk-xxx
   AI_302_API_KEY=sk-xxx
   NEXT_PUBLIC_COLLAB_URL=wss://nexusnote-server.onrender.com
   ```

5. **Deploy!** 🎉

See [DEPLOY.md](./deploy/DEPLOY.md) for detailed instructions.

---

## 📁 Project Structure

```
nexusnote/
├── apps/
│   ├── web/                          # Next.js Frontend
│   │   ├── app/
│   │   │   ├── api/chat/             # AI chat with RAG
│   │   │   ├── api/learn/            # Learning module APIs
│   │   │   ├── editor/[id]/          # Document editor
│   │   │   └── learn/[contentId]/    # Learning interface
│   │   ├── components/
│   │   │   ├── editor/               # Tiptap editor + extensions
│   │   │   ├── ai/                   # Chat sidebar, agent panel
│   │   │   ├── srs/                  # Flashcard review
│   │   │   └── timeline/             # Version history
│   │   └── lib/
│   │       ├── agents/               # Agent system
│   │       ├── storage/              # IndexedDB stores
│   │       └── ai.ts                 # AI SDK config
│   │
│   └── server/                       # NestJS Backend
│       └── src/
│           ├── auth/                 # JWT authentication
│           ├── document/             # Document CRUD
│           ├── rag/                  # RAG service + worker
│           ├── snapshot/             # Timeline snapshots
│           ├── collaboration/        # Hocuspocus server
│           └── queue/                # BullMQ configuration
│
├── packages/
│   ├── db/                           # Database Layer
│   │   ├── src/
│   │   │   ├── schema.ts             # Drizzle schema
│   │   │   └── fsrs.ts               # FSRS-5 algorithm
│   │   └── drizzle/                  # SQL migrations
│   │
│   ├── config/                       # Shared Configuration
│   │   └── src/index.ts              # Environment validation
│   │
│   ├── types/                        # Shared TypeScript Types
│   └── ui/                           # Shared UI Components
│
├── docs/
│   ├── PRD.md                        # Product requirements
│   ├── TRD.md                        # Technical requirements
│   └── AI_ARCHITECTURE.md            # AI system design
│
├── deploy/
│   ├── DEPLOY.md                     # Deployment guide
│   └── nginx.conf                    # Nginx configuration
│
├── .env.example                      # Environment template
├── docker-compose.yml                # Local development
├── render.yaml                       # Render deployment config
└── turbo.json                        # Turborepo configuration
```

---

## 🔧 Configuration

### Environment Variables

#### Required (Both Server & Web)
```bash
# AI Provider
AI_PROVIDER=deepseek                  # deepseek | 302ai | siliconflow
DEEPSEEK_API_KEY=sk-xxx               # DeepSeek API key
AI_302_API_KEY=sk-xxx                 # 302.ai API key (for embedding)

# Embedding
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-8B
EMBEDDING_DIMENSIONS=4000

# Reranker (optional)
RERANKER_ENABLED=true
RERANKER_MODEL=Qwen/Qwen3-Reranker-8B
```

#### Server Only
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nexusnote

# Redis
REDIS_URL=redis://localhost:6380

# Authentication
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=http://localhost:3000
```

#### Web Only
```bash
# API Endpoints
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
```

See [.env.example](./.env.example) for complete configuration.

---

## 📚 API Documentation

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/documents` | GET | List documents |
| `/documents/:id` | GET | Get document |
| `/documents` | POST | Create document |
| `/documents/:id` | PATCH | Update document |
| `/rag/search` | GET | Vector search |
| `/snapshots/:id` | GET | Get snapshots |
| `/snapshots/:id/restore` | POST | Restore version |

### AI Endpoints (Next.js API Routes)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | AI chat with RAG |
| `/api/completion` | POST | Text completion |
| `/api/flashcard/generate` | POST | Generate flashcards |
| `/api/learn/generate` | POST | Generate learning plan |

---

## 🧪 Development

### Run Tests
```bash
pnpm test
```

### Type Check
```bash
pnpm typecheck
```

### Lint
```bash
pnpm lint
```

### Build
```bash
pnpm build
```

### Database Migrations
```bash
# Generate migration
pnpm --filter @nexusnote/db generate

# Run migration
pnpm --filter @nexusnote/db migrate
```

---

## 🎓 Learning Resources

- [AI Architecture](./docs/AI_ARCHITECTURE.md) - How the AI system works
- [PRD](./docs/PRD.md) - Product requirements and roadmap
- [TRD](./docs/TRD.md) - Technical design decisions
- [Deployment Guide](./deploy/DEPLOY.md) - Production deployment

---

## 🗺️ Roadmap

### ✅ Completed
- [x] Rich text editor with collaboration
- [x] AI chat with RAG
- [x] Vector search with pgvector
- [x] FSRS-5 spaced repetition
- [x] Timeline & version control
- [x] Agent system with tool calling
- [x] Production deployment

### 🚧 In Progress
- [ ] Mobile responsive design
- [ ] Team collaboration features
- [ ] Advanced search filters

### 📋 Planned
- [ ] Knowledge graph visualization
- [ ] Multi-modal support (images, PDFs)
- [ ] Browser extension
- [ ] Mobile app (React Native)
- [ ] Self-hosted deployment guide
- [ ] Plugin system

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Tiptap](https://tiptap.dev/) - Headless editor framework
- [Yjs](https://yjs.dev/) - CRDT for real-time collaboration
- [Vercel AI SDK](https://sdk.vercel.ai/) - Unified AI interface
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe SQL
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [FSRS](https://github.com/open-spaced-repetition/fsrs-rs) - Spaced repetition algorithm

---

## 💬 Community

- [GitHub Discussions](https://github.com/yourusername/nexusnote/discussions)
- [Discord](https://discord.gg/nexusnote)
- [Twitter](https://twitter.com/nexusnote)

---

<div align="center">

**Built with ❤️ by developers, for developers**

[⭐ Star us on GitHub](https://github.com/yourusername/nexusnote)

</div>
