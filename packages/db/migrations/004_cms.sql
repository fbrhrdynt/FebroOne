-- Additive integration metadata; CMS remains the authority for requests and grants.
CREATE TABLE cms_event_nonces(nonce text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE notifications ADD COLUMN target_url text;
CREATE TABLE cms_events(id text PRIMARY KEY,kind text NOT NULL,request_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE files ADD COLUMN remote_file_id uuid;
