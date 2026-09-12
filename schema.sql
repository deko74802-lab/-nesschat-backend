-- Расширение для быстрого поиска по подстроке (username ILIKE '%...%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);

CREATE TABLE IF NOT EXISTS chats (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(20) DEFAULT 'direct', -- 'direct' | 'group'
  title      VARCHAR(64),                  -- используется для групповых чатов
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  chat_id    INT REFERENCES chats(id) ON DELETE CASCADE,
  sender_id  INT REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
  ON messages (chat_id, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
