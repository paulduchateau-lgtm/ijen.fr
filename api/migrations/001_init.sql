-- ═══════════════════════════════════════════════════════
-- IJEN RAG — pgvector schema
-- Run: psql $DATABASE_URL -f migrations/001_init.sql
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Catalogue de réalisations (base vectorielle) ──
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  category    TEXT,
  problem     TEXT NOT NULL,
  solution    TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  sector_refs TEXT,
  proto_price TEXT,
  prod_price  TEXT,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index IVFFlat pour la recherche vectorielle
-- (lists=5 adapté à <100 entrées; augmenter si le corpus grandit)
CREATE INDEX IF NOT EXISTS idx_projects_embedding
  ON projects USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 5);

-- ── Parcours / compétences (pour enrichir le contexte RAG) ──
CREATE TABLE IF NOT EXISTS experience (
  id          SERIAL PRIMARY KEY,
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  period      TEXT,
  description TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experience_embedding
  ON experience USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 5);

-- ── Conversations (historique des échanges chat + WhatsApp) ──
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel     VARCHAR(20) NOT NULL DEFAULT 'web',   -- 'web' | 'whatsapp'
  user_id     TEXT,                                   -- phone for WA, session for web
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL,               -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  sources         JSONB DEFAULT '[]',                  -- [{project_id, score}]
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
