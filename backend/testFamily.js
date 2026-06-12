import 'dotenv/config';
import { loadTaxonomy, loadRoleMappings, loadCuratedPacks, detectRoleFromCV, getCuratedPack } from './src/services/taxonomyService.js';
import { query } from './src/models/db.js';

await loadTaxonomy(); await loadRoleMappings(); await loadCuratedPacks();

// 1. Candidate side
const cvs = await query(`SELECT user_id, LEFT(extracted_text,50) AS head, extracted_text FROM cvs WHERE is_primary = TRUE`);
for (const cv of cvs.rows) {
  const role = detectRoleFromCV(cv.extracted_text);
  const pack = role ? getCuratedPack(role.title) : null;
  console.log('USER CV:', cv.head.replace(/\s+/g,' '));
  console.log('  detected role:', role?.title || 'NULL', '| family:', pack?.role_name || 'NULL');
}

// 2. Job side — sample of real scraped titles
const jobs = await query(`SELECT title FROM jobs LIMIT 15`);
console.log('\nJOB CLASSIFICATION:');
for (const j of jobs.rows) {
  const pack = getCuratedPack(j.title.toLowerCase());
  console.log(` "${j.title.slice(0,50)}" → family:`, pack?.role_name || 'UNCLASSIFIED');
}
process.exit(0);
