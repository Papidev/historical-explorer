-- Additive prerequisite; apply separately with the schema owner before deploying the API.
-- No import, category recalculation or visitor publication.
BEGIN;
CREATE TABLE content.poi_type_acquisitions (
  poi_id uuid PRIMARY KEY REFERENCES content.pois(id),
  input_revision uuid NOT NULL,
  revision uuid NOT NULL,
  request_digest text NOT NULL,
  acquisition jsonb NOT NULL CHECK (jsonb_typeof(acquisition) = 'object')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON content.poi_type_acquisitions TO historical_explorer_writer;
COMMIT;
