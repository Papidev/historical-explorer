-- Additive prerequisite. Apply separately with the schema owner before API deployment.
-- No seed import, backfill or publication.
BEGIN;
CREATE TABLE content.type_category_rules (
  type_id text PRIMARY KEY CHECK (type_id ~ '^Q[1-9][0-9]*$'),
  decision text NOT NULL CHECK (decision IN ('mapped', 'ignored', 'unmapped')),
  category_ids jsonb NOT NULL CHECK (jsonb_typeof(category_ids) = 'array'),
  origin text NOT NULL CHECK (origin IN ('manual', 'automatic', 'initial')),
  reason text,
  revision uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((decision = 'mapped') = (jsonb_array_length(category_ids) > 0))
);
CREATE TABLE content.poi_type_category_assignments (
  poi_id uuid NOT NULL REFERENCES content.pois(id),
  category_id text NOT NULL REFERENCES content.categories(id),
  PRIMARY KEY (poi_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON content.type_category_rules,
  content.poi_type_category_assignments TO historical_explorer_writer;
COMMIT;
