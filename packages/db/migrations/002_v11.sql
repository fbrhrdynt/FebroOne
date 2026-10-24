ALTER TABLE records ADD COLUMN company_id uuid, ADD COLUMN category_id uuid, ADD COLUMN project_id uuid, ADD COLUMN reminder_at timestamptz, ADD COLUMN reminder_repeat text NOT NULL DEFAULT 'None';
ALTER TABLE records ADD FOREIGN KEY(owner_id,company_id) REFERENCES records(owner_id,id), ADD FOREIGN KEY(owner_id,category_id) REFERENCES records(owner_id,id), ADD FOREIGN KEY(owner_id,project_id) REFERENCES records(owner_id,id);
CREATE FUNCTION sync_record_relations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.company_id=NULLIF(NEW.data->>'companyId','')::uuid;
 NEW.category_id=NULLIF(NEW.data->>'categoryId','')::uuid;
 NEW.project_id=NULLIF(NEW.data->>'projectId','')::uuid;
 RETURN NEW;
END $$;
CREATE TRIGGER record_relations BEFORE INSERT OR UPDATE OF data ON records FOR EACH ROW EXECUTE FUNCTION sync_record_relations();
-- Keep original text for history; link existing labels to owner-specific master records.
DO $$
DECLARE rel record; row record; master uuid;
BEGIN
 FOR rel IN SELECT * FROM (VALUES ('company','companyId','companies'),('category','categoryId','categories'),('project','projectId','projects')) AS t(label,field,kind) LOOP
  FOR row IN SELECT id,owner_id,data->>rel.label AS name FROM records WHERE kind IN ('tasks','work','employments','trainings','certificates','projects','achievements','competencies','timesheets') AND length(trim(data->>rel.label))>0 LOOP
   SELECT id INTO master FROM records WHERE owner_id=row.owner_id AND kind=rel.kind AND title=row.name AND archived_at IS NULL ORDER BY created_at LIMIT 1;
   IF master IS NULL THEN master=gen_random_uuid(); INSERT INTO records(id,owner_id,kind,title) VALUES(master,row.owner_id,rel.kind,row.name); END IF;
   UPDATE records SET data=jsonb_set(data,ARRAY[rel.field],to_jsonb(master::text)) WHERE id=row.id;
  END LOOP;
 END LOOP;
END $$;
CREATE INDEX records_relations ON records(owner_id,company_id,category_id,project_id);
CREATE INDEX records_reminders ON records(reminder_at) WHERE archived_at IS NULL AND reminder_at IS NOT NULL;
CREATE TABLE push_config(id integer PRIMARY KEY CHECK(id=1),public_key text NOT NULL,private_key text NOT NULL);
CREATE TABLE push_subscriptions(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,endpoint text NOT NULL UNIQUE,subscription jsonb NOT NULL,label text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE push_deliveries(subscription_id uuid NOT NULL REFERENCES push_subscriptions ON DELETE CASCADE,notification_id text NOT NULL REFERENCES notifications ON DELETE CASCADE,claimed_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'claimed',PRIMARY KEY(subscription_id,notification_id));
