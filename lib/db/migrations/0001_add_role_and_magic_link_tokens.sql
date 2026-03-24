-- Migration: add role-based auth
-- Run once against your PostgreSQL database.

-- 1. Add role column to residents (default "resident" for all existing rows)
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'resident';

-- 2. Create magic_link_tokens table for email-based magic link auth
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          serial PRIMARY KEY,
  email       text NOT NULL,
  token       text NOT NULL UNIQUE,
  resident_id integer NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  expires_at  timestamp NOT NULL,
  used_at     timestamp,
  created_at  timestamp NOT NULL DEFAULT now()
);
