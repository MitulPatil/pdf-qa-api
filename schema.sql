CREATE EXTENSION IF NOT EXISTS vector;

-- schema.sql
-- Run once: psql -U postgres -d semantic_search_db -f schema.sql
-- Updated from Week 7 to add start_page and end_page for citations

DROP TABLE IF EXISTS chunks;
DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
  id          SERIAL PRIMARY KEY,
  filename    TEXT        NOT NULL,
  num_pages   INTEGER,
  word_count  INTEGER,
  chunk_count INTEGER,
  created_at  TIMESTAMP   DEFAULT NOW()
);

CREATE TABLE chunks (
  id          SERIAL       PRIMARY KEY,
  document_id INTEGER      NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT         NOT NULL,
  chunk_index INTEGER      NOT NULL,
  word_count  INTEGER,
  start_word  INTEGER,
  end_word    INTEGER,
  start_page  INTEGER      NOT NULL,  -- page where this chunk begins
  end_page    INTEGER      NOT NULL,  -- page where this chunk ends
  embedding   vector(3072) NOT NULL
);