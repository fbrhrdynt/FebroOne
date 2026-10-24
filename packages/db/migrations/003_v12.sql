ALTER TABLE records ADD COLUMN deleted_at timestamptz;
CREATE INDEX records_trash ON records(owner_id,kind,deleted_at) WHERE deleted_at IS NOT NULL;
