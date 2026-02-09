# NexusNote

<div align="center">

**AI-Native Knowledge Management System with Real-time Collaboration**

*Build your second brain with cutting-edge AI technology*

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![AI SDK](https://img.shields.io/badge/AI_SDK-6.0-000000?logo=vercel)](https://sdk.vercel.ai/)

[Documentation](./docs) · [Deployment Guide](./DEPLOYMENT.md) · [Report Bug](https://github.com/yourusername/nexusnote/issues)

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

### Modern Fullstack Design (2026)

NexusNote now uses a **single Next.js fullstack application** deployed in a Docker container:

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js Standalone Server                            │   │
│  │  ├── Next.js API Gateway (port 3000)                │   │
│  │  ├── Hocuspocus WebSocket Server (port 1234)        │   │
│  │  └── BullMQ RAG Indexing Worker                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Shared Resources                                    │   │
│  │  ├── PostgreSQL 16 + pgvector                       │   │
│  │  └── Redis 7 (BullMQ queue + distributed locks)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 | Unified fullstack framework |
| **Editor** | TiptapV3, Yjs | Rich text editing, CRDT sync |
| **Realtime** | Hocuspocus | WebSocket collaboration server |
| **Database** | PostgreSQL 16, pgvector | Relational data, vector search |
| **Queue** | BullMQ, Redis | Async job processing, locks |
| **AI** | Vercel AI SDK 6.x | Unified AI interface |
| **ORM** | Drizzle | Type-safe SQL queries |
| **Monorepo** | Turborepo, pnpm | Build orchestration |
| **Deployment** | Docker, Kubernetes | Container orchestration |

### Why This Architecture?

✅ **Simplified Deployment** - Single container instead of multiple services
✅ **Better Performance** - No inter-service network latency
✅ **Cost Efficient** - Lower cloud infrastructure costs
✅ **Easier Maintenance** - Centralized logging, monitoring
✅ **Self-Hosted Ready** - Perfect for VPS/self-managed servers

### AI Model Strategy

```typescript
// Chat & Reasoning (2026 Options)
Gemini 3 Flash/Pro → Google AI Studio (free tier)
DeepSeek V3 → $1/M tokens (best value)

// Embedding (4000D vectors)
Qwen3-Embedding-8B → 302.ai or SiliconFlow

// Reranking (optional)
Qwen3-Reranker-8B → Two-stage retrieval
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker (for database services)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/yourusername/nexusnote.git
cd nexusnote

# 2. Install dependencies
pnpm install

# 3. Start database services
docker compose up -d postgres redis

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local and add your API keys:
# - AI_302_API_KEY (or OPENAI_API_KEY, DEEPSEEK_API_KEY, etc.)
# - DATABASE_URL (if not using docker)
# - REDIS_URL (if not using docker)

# 5. Run database migrations
cd apps/web
pnpm exec drizzle-kit push

# 6. Start all services (separate terminals)

# Terminal 1 - Next.js:
pnpm dev

# Terminal 2 - RAG Worker:
npm run queue:worker

# Terminal 3 - Hocuspocus WebSocket:
npm run hocuspocus
```

### Access Services

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| 🌐 Web App | http://localhost:3000 | 3000 | Next.js frontend + API |
| 🔄 Collaboration | ws://localhost:1234 | 1234 | Hocuspocus WebSocket |
| 🗄️ PostgreSQL | localhost:5433 | 5433 | Database |
| 📮 Redis | localhost:6380 | 6380 | Queue & cache |

---

## 🌍 Production Deployment

### Docker Deployment (Recommended)

NexusNote is designed for **self-hosted Docker deployment**:

```bash
# 1. Clone and configure
git clone <repo>
cd nexusnote
cp .env.example .env

# 2. Edit .env with your API keys and domain

# 3. Build Docker image
docker build -f apps/web/Dockerfile -t nexusnote:latest .

# 4. Deploy with docker-compose
docker-compose up -d

# 5. Access your app
# - Web: http://your-domain:3000
# - Collaboration WS: ws://your-domain:1234
```

### Deployment Checklist

- [ ] Set strong `AUTH_SECRET` and `JWT_SECRET` (use `openssl rand -base64 32`)
- [ ] Configure AI provider API keys (302.ai, OpenAI, DeepSeek, etc.)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_COLLAB_URL` to your domain
- [ ] Enable HTTPS with reverse proxy (nginx/Caddy)
- [ ] Set up regular PostgreSQL backups
- [ ] Configure monitoring and logging
- [ ] Set up SSL certificates (Let's Encrypt)

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📁 Project Structure

```
nexusnote/
├── apps/
│   └── web/                          # Next.js Fullstack App
│       ├── app/
│       │   ├── api/
│       │   │   ├── ai/               # Unified AI Gateway
│       │   │   ├── auth/             # Authentication
│       │   │   └── ...
│       │   ├── editor/[id]/          # Document editor
│       │   └── learn/                # Learning module
│       ├── src/
│       │   ├── server/
│       │   │   ├── hocuspocus.ts     # WebSocket collaboration
│       │   │   └── ...
│       │   ├── queue/
│       │   │   ├── worker.ts         # BullMQ RAG worker
│       │   │   └── utils/
│       │   ├── lib/
│       │   │   ├── ai/               # AI utilities (types only)
│       │   │   ├── storage/          # IndexedDB stores
│       │   │   └── ...
│       │       └── components/
│       ├── Dockerfile                # Multi-stage Docker build
│       └── next.config.js            # Next.js configuration
│
├── packages/
│   ├── db/                           # Database Layer
│   │   ├── src/schema.ts             # Drizzle schema
│   │   └── drizzle/                  # SQL migrations
│   ├── config/                       # Shared Configuration
│   ├── types/                        # Shared TypeScript Types
│   └── ui/                           # Shared UI Components
│
├── docs/
│   ├── PRD.md                        # Product requirements
│   ├── TRD.md                        # Technical requirements
│   └── AI.md                         # AI system details
│
├── DEPLOYMENT.md                     # Complete deployment guide
├── docker-compose.yml                # Docker Compose config
├── .env.example                      # Environment template
└── turbo.json                        # Turborepo configuration
```

---

## 🔧 Configuration

See [.env.example](./.env.example) for complete configuration options.

### Essential Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nexusnote

# Redis
REDIS_URL=redis://localhost:6379

# AI Provider (choose one or more)
AI_302_API_KEY=sk-xxx              # Recommended
OPENAI_API_KEY=sk-xxx              # Alternative
DEEPSEEK_API_KEY=sk-xxx            # Alternative

# Authentication
AUTH_SECRET=<random-32-chars>       # openssl rand -base64 32
JWT_SECRET=<random-32-chars>

# Public URLs
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
```

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
