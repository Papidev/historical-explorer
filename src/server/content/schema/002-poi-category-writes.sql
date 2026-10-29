-- Additive schema prerequisite. Apply separately with the schema owner before server deployment.
-- No backfill: existing POIs have an implicit null category revision.
BEGIN;
CREATE TABLE content.poi_category_writes (
  poi_id uuid PRIMARY KEY REFERENCES content.pois(id),
  revision uuid NOT NULL,
  request_digest text NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON content.poi_category_writes TO historical_explorer_writer;
COMMIT;
