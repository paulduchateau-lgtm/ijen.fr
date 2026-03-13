# Ijen RAG API

Backend RAG (Retrieval Augmented Generation) pour [ijen.fr](https://ijen.fr).
Les visiteurs chattent avec le catalogue de réalisations de Paul Duchâteau via un LLM.

## Stack

- **Express.js** — API REST + SSE streaming
- **PostgreSQL + pgvector** — base vectorielle (embeddings 1536 dims)
- **OpenAI text-embedding-3-small** — génération d'embeddings
- **Anthropic Claude Haiku** — LLM conversationnel (streaming)
- **Vercel** — déploiement serverless
- **Twilio** — webhook WhatsApp (prêt, non actif)

## Structure

```
api/
├── index.js              # Express server
├── seed.js               # Peuplement DB + embeddings
├── vercel.json           # Config Vercel
├── package.json
├── .env.example
├── lib/
│   ├── db.js             # Pool PostgreSQL
│   └── prompt.js         # System prompt + context builders
├── routes/
│   ├── chat.js           # POST /api/chat (SSE streaming)
│   └── whatsapp.js       # POST /api/whatsapp (Twilio webhook)
├── services/
│   ├── embeddings.js     # OpenAI embeddings
│   ├── llm.js            # Anthropic Claude Haiku
│   └── vectordb.js       # pgvector queries
└── migrations/
    ├── 001_init.sql       # Schema + indexes
    └── run.js             # Migration runner
```

## Setup

### 1. PostgreSQL + pgvector

```bash
# Installer pgvector (Ubuntu/Debian)
sudo apt install postgresql-16-pgvector

# Ou via Docker
docker run -d --name ijen-db \
  -e POSTGRES_PASSWORD=motdepasse \
  -e POSTGRES_DB=ijen \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### 2. Configuration

```bash
cp .env.example .env
# Remplir DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY
```

### 3. Migration + Seed

```bash
npm install
npm run migrate    # Crée les tables
npm run seed       # Peuple les 19 réalisations + expérience (génère les embeddings)
```

### 4. Dev local

```bash
npm run dev        # http://localhost:3001
```

### 5. Déploiement Vercel

```bash
cd api
vercel --prod
```

Variables d'environnement à configurer dans le dashboard Vercel :
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CORS_ORIGIN` (ex: `https://ijen.fr`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | Chat SSE streaming |
| POST | `/api/whatsapp` | Webhook Twilio WhatsApp |

### POST /api/chat

```json
{
  "message": "Quelles sont tes compétences en RAG ?",
  "conversationId": "optionnel-uuid"
}
```

Réponse : flux SSE avec `data: {"text":"..."}` puis `data: {"done":true,"sources":[...],"conversationId":"..."}`.

## WhatsApp (Twilio sandbox)

1. Configurer un numéro Twilio sandbox
2. Pointer le webhook vers `https://api.ijen.fr/api/whatsapp`
3. Les variables `TWILIO_*` dans `.env` sont prêtes mais non utilisées côté serveur (Twilio envoie directement)
