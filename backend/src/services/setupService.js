// ════════════════════════════════════════════════════════════════
// Startup setup — makes a fresh database ready without manual steps.
//   • creates the taxonomy tables if they don't exist
//   • seeds the large O*NET data (skills, titles, occupations) only when
//     the tables are empty — i.e. the first run on a new machine
//   • re-syncs the small curated role list every start, so edits to
//     seedRoleKeywords.js apply on the next restart
// ════════════════════════════════════════════════════════════════
import { query } from '../models/db.js';
import { seedTaxonomy } from '../scripts/seedTaxonomy.js';
import { seedRoleKeywords } from '../scripts/seedRoleKeywords.js';
import { seedOccupations } from '../scripts/seedOccupations.js';
import logger from './loggerService.js';

// Same definitions as the taxonomy section of scripts/init.sql
const TAXONOMY_TABLES = `
  CREATE TABLE IF NOT EXISTS taxonomy_skills (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL UNIQUE,
    category   VARCHAR(100),
    aliases    TEXT[] DEFAULT '{}',
    source     VARCHAR(50) DEFAULT 'onet',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_tax_skills_name ON taxonomy_skills (LOWER(name));

  CREATE TABLE IF NOT EXISTS taxonomy_job_titles (
    id         SERIAL PRIMARY KEY,
    title      VARCHAR(250) NOT NULL UNIQUE,
    onet_code  VARCHAR(20),
    source     VARCHAR(50) DEFAULT 'onet',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_tax_titles_title ON taxonomy_job_titles (LOWER(title));

  CREATE TABLE IF NOT EXISTS taxonomy_certifications (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(250) NOT NULL UNIQUE,
    field      VARCHAR(100),
    aliases    TEXT[] DEFAULT '{}',
    source     VARCHAR(50) DEFAULT 'curated',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS taxonomy_role_skills (
    id        SERIAL PRIMARY KEY,
    onet_code VARCHAR(20)  NOT NULL,
    skill     VARCHAR(200) NOT NULL,
    UNIQUE (onet_code, skill)
  );
  CREATE INDEX IF NOT EXISTS idx_role_skills_code ON taxonomy_role_skills (onet_code);

  CREATE TABLE IF NOT EXISTS taxonomy_role_keywords (
    id             SERIAL PRIMARY KEY,
    role_name      VARCHAR(100) NOT NULL UNIQUE,
    title_synonyms TEXT[] NOT NULL,
    keywords       TEXT[] NOT NULL,
    tools          TEXT[] NOT NULL,
    source         VARCHAR(50) DEFAULT 'curated',
    created_at     TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS taxonomy_occupations (
    onet_code   VARCHAR(10) PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT
  );
`;

const isEmpty = async (table) =>
  parseInt((await query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count) === 0;

export const ensureTaxonomy = async () => {
  await query(TAXONOMY_TABLES);

  if (await isEmpty('taxonomy_skills') || await isEmpty('taxonomy_job_titles')) {
    logger.info('Taxonomy empty — seeding O*NET skills and job titles (first run, takes a minute)…');
    await seedTaxonomy();
  }
  if (await isEmpty('taxonomy_occupations')) {
    logger.info('Occupations empty — seeding O*NET occupations…');
    await seedOccupations();
  }
  await seedRoleKeywords(); // small; always re-synced so code edits apply
  logger.info('Taxonomy ready');
};
