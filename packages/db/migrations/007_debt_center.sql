ALTER TABLE debts ALTER COLUMN name SET DEFAULT 'Utang tanpa nama';
ALTER TABLE debts ALTER COLUMN principal SET DEFAULT 0;
ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_principal_check;
ALTER TABLE debts ADD CONSTRAINT debts_principal_nonnegative CHECK(principal >= 0);
ALTER TABLE debts ALTER COLUMN apr SET DEFAULT 0;
ALTER TABLE debts ALTER COLUMN months SET DEFAULT 1;
ALTER TABLE debts ALTER COLUMN start DROP NOT NULL;
ALTER TABLE debts ALTER COLUMN direction SET DEFAULT 'borrowed';
ALTER TABLE debts ALTER COLUMN model SET DEFAULT 'reducing';
CREATE TABLE IF NOT EXISTS debt_installments (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  debt_id uuid NOT NULL,
  period date NOT NULL,
  due_date date,
  amount bigint,
  status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','paid','skipped')),
  paid_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(debt_id,period),
  FOREIGN KEY(owner_id,debt_id) REFERENCES debts(owner_id,id) ON DELETE CASCADE,
  CHECK(amount IS NULL OR amount >= 0),
  CHECK((status='paid' AND paid_at IS NOT NULL) OR status<>'paid')
);
CREATE INDEX IF NOT EXISTS debt_installments_owner_period ON debt_installments(owner_id,period,status);
