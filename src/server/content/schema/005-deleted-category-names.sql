-- Additive prerequisite: apply separately with the schema owner before API deployment.
BEGIN;
CREATE TABLE content.deleted_category_names (name text PRIMARY KEY);
GRANT SELECT, INSERT ON content.deleted_category_names TO historical_explorer_writer;
COMMIT;
