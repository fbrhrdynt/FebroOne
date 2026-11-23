CREATE TABLE IF NOT EXISTS passkey_credentials (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  name text NOT NULL DEFAULT 'Passkey',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS passkey_credentials_owner ON passkey_credentials(owner_id);
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id text PRIMARY KEY,
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('registration','authentication')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry ON webauthn_challenges(expires_at);
