-- Let money flow be attached to the work and life records it belongs to
-- (a project, company, goal or trip). Deleting the record keeps the
-- transaction and only clears the link.
ALTER TABLE ledger_transactions ADD COLUMN record_id uuid;
ALTER TABLE ledger_transactions ADD CONSTRAINT ledger_transactions_record_fk
  FOREIGN KEY(owner_id,record_id) REFERENCES records(owner_id,id) ON DELETE SET NULL (record_id);
CREATE INDEX ledger_transactions_record ON ledger_transactions(owner_id,record_id) WHERE record_id IS NOT NULL;
-- Backlinks are read from both ends.
CREATE INDEX entity_links_target ON entity_links(owner_id,target_id);
CREATE INDEX entity_links_source ON entity_links(owner_id,source_id);
