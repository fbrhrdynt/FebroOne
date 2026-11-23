ALTER TABLE debts ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS debts_owner_active_due ON debts(owner_id, archived_at, start);
