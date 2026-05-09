DO $$
BEGIN
  CREATE TYPE vaccine_site_category AS ENUM (
    'oral',
    'injection-thigh',
    'injection-arm',
    'intradermal',
    'intranasal',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vaccines
  ADD COLUMN IF NOT EXISTS site_category vaccine_site_category NOT NULL DEFAULT 'other';
