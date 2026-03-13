-- Switch from OpenAI text-embedding-3-small (1536 dims) to Voyage AI voyage-3-lite (512 dims)
-- Tables are empty (seed not yet run), safe to alter.

DROP INDEX IF EXISTS idx_projects_embedding;
DROP INDEX IF EXISTS idx_experience_embedding;

ALTER TABLE projects ALTER COLUMN embedding TYPE vector(512);
ALTER TABLE experience ALTER COLUMN embedding TYPE vector(512);

CREATE INDEX idx_projects_embedding
  ON projects USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 5);

CREATE INDEX idx_experience_embedding
  ON experience USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 5);
