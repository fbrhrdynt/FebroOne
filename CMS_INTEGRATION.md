# CMS integration

CMS owns request records, approval rules, SMTP delivery and expiration. One uses
signed server-to-server HTTP, never CMS database credentials. Configure
FEBRO_ONE_CMS_SECRET in both applications, CMS_INTERNAL_URL and explicit existing
CMS_ADMIN_USER_IDS in One. Browser reads and decisions require the existing
session; decisions require origin and CSRF validation. CMS checks a signed
millisecond timestamp, nonce, method, exact path/query/body, current request status
and stable decision UUID. Never retry an interrupted SMTP action with a new UUID
before inspecting its current state.

CMS transactionally queues new document/CV/contact events with SQLite triggers.
FEBRO_ONE_EVENTS_URL points to One /api/integrations/cms/events. Failed deliveries
retry with bounded backoff. Event and notification identifiers prevent duplicates.
Existing push subscriptions and VAPID keys are reused, with generic payloads and
private One detail-page destinations. Historical requests appear without alerts.

One Files uses a separate FEBRO_ONE_FILES_SERVICE_TOKEN and FEBRO_FILES_API_URL.
New uploads use private service:febro-one storage. Existing local attachments keep
original records and storage; the backend recorded on each file controls reads.
Outages fail closed. One checks record/file ownership before service requests.
The CMS Files identity remains separate. No storage tokens reach browsers.

After backups and successful npm test / npm run build, apply additive migration
004_cms.sql via npm run migrate. Restart only febro-one.service and PM2 febro /
febro-files individually. Preserve environment file permissions and existing
attachments. Operational report: /home/ubuntu/codex/febro-integration/REPORT.md.
