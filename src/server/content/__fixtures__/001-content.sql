CREATE SCHEMA content;
REVOKE ALL ON SCHEMA content FROM PUBLIC;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'historical_explorer_writer') THEN
    CREATE ROLE historical_explorer_writer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'historical_explorer_reader') THEN
    CREATE ROLE historical_explorer_reader NOLOGIN;
  END IF;
END $$;

CREATE TABLE content.city_catalogs (
  city text PRIMARY KEY CHECK (city ~ '^[a-z0-9][a-z0-9-]*$'),
  revision uuid,
  request_digest text
);

CREATE TABLE content.pois (
  id uuid PRIMARY KEY,
  city text NOT NULL REFERENCES content.city_catalogs(city),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  wikidata_id text CHECK (wikidata_id ~ '^Q[1-9][0-9]*$'),
  osm_ids text[] NOT NULL DEFAULT '{}',
  wikipedia_pages jsonb NOT NULL CHECK (jsonb_typeof(wikipedia_pages) = 'array'),
  input_revision uuid NOT NULL,
  input_digest text NOT NULL,
  removed_at timestamptz
);
CREATE INDEX pois_city_active ON content.pois(city) WHERE removed_at IS NULL;

CREATE TABLE content.published_stories (
  poi_id uuid PRIMARY KEY REFERENCES content.pois(id),
  publication_id uuid NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  input_revision uuid NOT NULL,
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object' AND NOT content ? 'relatedPeople'),
  sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) > 0),
  gallery jsonb NOT NULL CHECK (jsonb_typeof(gallery) = 'array'),
  main_image_id text,
  generation jsonb NOT NULL CHECK (jsonb_typeof(generation) = 'object'),
  published_at timestamptz NOT NULL DEFAULT now(),
  request_digest text NOT NULL,
  CHECK ((jsonb_array_length(gallery) = 0 AND main_image_id IS NULL) OR
    (main_image_id IS NOT NULL AND gallery @> jsonb_build_array(jsonb_build_object('id', main_image_id))))
);

CREATE TABLE content.people (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  wikidata_id text NOT NULL UNIQUE CHECK (wikidata_id ~ '^Q[1-9][0-9]*$'),
  profile_version uuid NOT NULL UNIQUE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  sources jsonb NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) > 0),
  generation jsonb NOT NULL CHECK (jsonb_typeof(generation) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  request_digest text NOT NULL
);

CREATE TABLE content.poi_people (
  poi_id uuid NOT NULL REFERENCES content.published_stories(poi_id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES content.people(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  position integer NOT NULL CHECK (position >= 0),
  source_ids text[] NOT NULL CHECK (cardinality(source_ids) > 0),
  PRIMARY KEY (poi_id, person_id),
  UNIQUE (poi_id, position)
);
CREATE INDEX poi_people_reverse ON content.poi_people(person_id, poi_id);

CREATE TABLE content.categories (
  id text PRIMARY KEY CHECK (length(trim(id)) > 0),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  label text,
  parent_id text REFERENCES content.categories(id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE TABLE content.poi_categories (
  poi_id uuid NOT NULL REFERENCES content.pois(id),
  category_id text NOT NULL REFERENCES content.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (poi_id, category_id)
);
CREATE INDEX poi_categories_reverse ON content.poi_categories(category_id, poi_id);

CREATE VIEW content.visitor_pois WITH (security_barrier = true) AS
SELECT p.id, p.city, jsonb_build_object(
  'id', p.id, 'city', p.city, 'name', s.name,
  'coordinates', jsonb_build_object('lat', p.latitude, 'lng', p.longitude),
  'categoryIds', COALESCE((SELECT jsonb_agg(c.category_id ORDER BY c.category_id)
    FROM content.poi_categories c WHERE c.poi_id = p.id), '[]'::jsonb)
) AS response
FROM content.pois p JOIN content.published_stories s ON s.poi_id = p.id
WHERE p.removed_at IS NULL;

CREATE VIEW content.visitor_stories WITH (security_barrier = true) AS
SELECT p.id, p.city, p.response || jsonb_build_object(
  'publicationId', s.publication_id,
  'publishedAt', to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'story', s.content || jsonb_build_object('relatedPeople', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('personId', r.person_id, 'name', r.name, 'sourceIds', r.source_ids)
      ORDER BY r.position) FROM content.poi_people r WHERE r.poi_id = p.id
  ), '[]'::jsonb)),
  'sources', s.sources, 'gallery', s.gallery, 'mainImageId', s.main_image_id
) AS response
FROM content.visitor_pois p JOIN content.published_stories s ON s.poi_id = p.id;

CREATE VIEW content.visitor_people WITH (security_barrier = true) AS
SELECT p.id, jsonb_build_object(
  'id', p.id, 'name', p.name, 'textFormat', 'markdown', 'content', p.content, 'sources', p.sources,
  'updatedAt', to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'linkedPois', (SELECT jsonb_agg(v.response ORDER BY v.city, v.id)
    FROM content.poi_people r JOIN content.visitor_pois v ON v.id = r.poi_id WHERE r.person_id = p.id)
) AS response
FROM content.people p WHERE EXISTS (
  SELECT FROM content.poi_people r JOIN content.visitor_pois v ON v.id = r.poi_id WHERE r.person_id = p.id
);

CREATE VIEW content.visitor_categories WITH (security_barrier = true) AS
SELECT id, jsonb_strip_nulls(jsonb_build_object(
  'id', id, 'name', name, 'label', label, 'parentId', parent_id
)) AS response FROM content.categories;

GRANT USAGE ON SCHEMA content TO historical_explorer_writer, historical_explorer_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON content.city_catalogs, content.pois,
  content.published_stories, content.people, content.poi_people, content.categories,
  content.poi_categories TO historical_explorer_writer;
GRANT SELECT ON content.visitor_pois, content.visitor_stories, content.visitor_people,
  content.visitor_categories TO historical_explorer_reader, historical_explorer_writer;

-- Neither role can log in. Deployment-specific login roles receive membership separately.
-- Keep this schema out of the Supabase Data API's exposed schemas.
