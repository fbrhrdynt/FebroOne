ALTER TABLE debts ADD COLUMN IF NOT EXISTS settled_at timestamptz;
CREATE INDEX IF NOT EXISTS debts_owner_settled ON debts(owner_id,settled_at);
