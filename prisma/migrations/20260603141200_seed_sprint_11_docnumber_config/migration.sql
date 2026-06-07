-- Seed DocNumberConfig rows for the new Sprint 11 doc types in every existing
-- organization. Idempotent: ON CONFLICT DO NOTHING means it skips orgs that
-- already have a configured template (e.g. tenants created after this point
-- via the register flow).

INSERT INTO "DocNumberConfig" ("id", "organizationId", "docType", "template", "resetPolicy", "currentCounter", "counterPeriod", "updatedAt")
SELECT
  'cfg_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
  o.id,
  'STOCK_TRANSFER',
  'TRF-{YYYY}{MM}-{SEQ:4}',
  'yearly',
  0,
  'all',
  NOW()
FROM "Organization" o
ON CONFLICT ("organizationId", "docType") DO NOTHING;

INSERT INTO "DocNumberConfig" ("id", "organizationId", "docType", "template", "resetPolicy", "currentCounter", "counterPeriod", "updatedAt")
SELECT
  'cfg_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
  o.id,
  'STOCK_OPNAME',
  'OPN-{YYYY}{MM}-{SEQ:4}',
  'yearly',
  0,
  'all',
  NOW()
FROM "Organization" o
ON CONFLICT ("organizationId", "docType") DO NOTHING;
