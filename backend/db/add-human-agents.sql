-- Migration: Add human_agents table
-- Run: node db/run-migration.js  (or paste into Supabase SQL editor)

CREATE TABLE IF NOT EXISTS human_agents (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  phone_number  TEXT        NOT NULL UNIQUE,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
