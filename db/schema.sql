-- Somente estrutura: nenhum histórico ou rascunho é importado.
CREATE TABLE IF NOT EXISTS study_sessions (
 id text PRIMARY KEY, user_id text NOT NULL, state text NOT NULL,
 cursor integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active',
 created_at double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON study_sessions(user_id,created_at);
CREATE TABLE IF NOT EXISTS study_attempts (
 id text PRIMARY KEY, user_id text NOT NULL, session_id text NOT NULL,
 question_id text NOT NULL, matter text NOT NULL, chosen integer NOT NULL,
 correct integer NOT NULL, created_at double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON study_attempts(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON study_attempts(session_id);
CREATE TABLE IF NOT EXISTS study_essays (
 user_id text NOT NULL, prompt_id text NOT NULL, text text NOT NULL,
 checks text NOT NULL, updated_at double precision NOT NULL,
 PRIMARY KEY(user_id,prompt_id)
);
CREATE TABLE IF NOT EXISTS login_limits (
 key text PRIMARY KEY, attempts integer NOT NULL, reset_at double precision NOT NULL
);
