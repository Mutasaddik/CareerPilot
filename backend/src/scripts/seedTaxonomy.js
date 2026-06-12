// ════════════════════════════════════════════════════════════════
// Seeds taxonomy tables from O*NET (US Dept of Labor, open data)
// Run: npm run seed:taxonomy
// Downloads ~15MB of text files, parses, inserts. Real data only.
// ════════════════════════════════════════════════════════════════
import 'dotenv/config';
import pool, { query } from '../models/db.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ONET_DIR  = path.join(__dirname, '../../data/onet');

const FILES = {
  techSkills:   path.join(ONET_DIR, 'Technology%20Skills.txt'),
  altTitles:    path.join(ONET_DIR, 'Alternate%20Titles.txt'),
  occupations:  path.join(ONET_DIR, 'Occupation%20Data.txt'),
  skills:       path.join(ONET_DIR, 'Skills.txt'),
  knowledge:    path.join(ONET_DIR, 'Knowledge.txt'),
};

// Curated soft skills (O*NET covers them abstractly; these are CV-real phrasings)
const SOFT_SKILLS = [
  'communication','leadership','teamwork','problem solving','time management',
  'adaptability','critical thinking','creativity','collaboration','negotiation',
  'presentation','public speaking','decision making','conflict resolution',
  'attention to detail','multitasking','customer service','mentoring','coaching',
  'stakeholder management','strategic planning','analytical thinking','empathy',
  'active listening','emotional intelligence','networking','self-motivation',
  'work ethic','organization','flexibility','interpersonal skills','sales strategy',
  'market analysis','buyer communication','vendor negotiation','order tracking',
  'production follow-up','sample coordination','supply chain coordination',
  'quality assurance','quality control','inventory management','merchandising',
  'report writing','documentation','cross-functional collaboration','team building',
];

// Curated certifications across industries (grows over time)
const CERTIFICATIONS = [
  ['AWS Certified Solutions Architect','cloud'],['AWS Certified Developer','cloud'],
  ['AWS Certified Cloud Practitioner','cloud'],['Microsoft Azure Fundamentals AZ-900','cloud'],
  ['Azure Administrator AZ-104','cloud'],['Google Cloud Professional Cloud Architect','cloud'],
  ['CompTIA A+','it'],['CompTIA Network+','it'],['CompTIA Security+','security'],
  ['CISSP','security'],['CEH','security'],['CISM','security'],['CISA','security'],
  ['OSCP','security'],['PMP','project management'],['PRINCE2','project management'],
  ['Certified ScrumMaster CSM','agile'],['PMI-ACP','agile'],['SAFe Agilist','agile'],
  ['ISTQB Foundation Level','qa'],['ISTQB Advanced Test Analyst','qa'],
  ['Selenium WebDriver Certification','qa'],['CCNA','networking'],['CCNP','networking'],
  ['Oracle Certified Professional Java','programming'],['Microsoft Certified: Power BI Data Analyst','data'],
  ['Google Data Analytics Certificate','data'],['Tableau Desktop Specialist','data'],
  ['TensorFlow Developer Certificate','ml'],['Databricks Certified Data Engineer','data'],
  ['Certified Kubernetes Administrator CKA','devops'],['Docker Certified Associate','devops'],
  ['HashiCorp Terraform Associate','devops'],['Red Hat RHCSA','devops'],
  ['ITIL Foundation','it service'],['Six Sigma Green Belt','operations'],
  ['Six Sigma Black Belt','operations'],['Lean Six Sigma','operations'],
  ['CFA Level I','finance'],['CFA Level II','finance'],['ACCA','accounting'],
  ['CPA','accounting'],['CMA','accounting'],['FRM','finance'],
  ['SHRM-CP','hr'],['PHR','hr'],['CIPD','hr'],
  ['Google Ads Certification','marketing'],['HubSpot Content Marketing','marketing'],
  ['Meta Blueprint Certification','marketing'],['Google Analytics Certification','marketing'],
  ['IELTS','language'],['TOEFL','language'],['HSK Level 1','language'],['HSK Level 2','language'],
  ['HSK Level 3','language'],['Microsoft 365 Certified Fundamentals','office'],
  ['Adobe Certified Professional Photoshop','design'],['Adobe Certified Professional Illustrator','design'],
  ['AutoCAD Certified User','engineering'],['SolidWorks CSWA','engineering'],
  ['NEBOSH IGC','safety'],['OSHA 30-Hour','safety'],['First Aid CPR AED','safety'],
  ['Registered Nurse RN','healthcare'],['BLS Certification','healthcare'],
  ['TEFL','education'],['Montessori Certification','education'],
  ['Certified Supply Chain Professional CSCP','supply chain'],['CPIM','supply chain'],
  ['Lead Auditor ISO 9001','quality'],['ISO 27001 Lead Implementer','quality'],
];

const fetchText = async (filePath) => {
  console.log(`  ↓ Reading ${path.basename(filePath).replace(/%20/g, ' ')}…`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}. Run the curl downloads first.`);
  return fs.readFileSync(filePath, 'utf-8');
};

const parseTSV = (text) => {
  const lines = text.split('\n').filter(Boolean);
  const headers = lines[0].split('\t').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
};

const batchInsert = async (table, column, values, extra = {}) => {
  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < values.length; i += BATCH) {
    const chunk = values.slice(i, i + BATCH);
    const params = [];
    const placeholders = chunk.map((v, j) => {
      if (table === 'taxonomy_skills') {
        params.push(v.name, v.category, v.source);
        return `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`;
      }
      if (table === 'taxonomy_job_titles') {
        params.push(v.title, v.onet_code);
        return `($${j * 2 + 1}, $${j * 2 + 2})`;
      }
      params.push(v.name, v.field);
      return `($${j * 2 + 1}, $${j * 2 + 2})`;
    }).join(',');

    const colDef = table === 'taxonomy_skills' ? '(name, category, source)'
                 : table === 'taxonomy_job_titles' ? '(title, onet_code)'
                 : '(name, field)';
    const conflictCol = table === 'taxonomy_job_titles' ? 'title' : 'name';

    const result = await query(
      `INSERT INTO ${table} ${colDef} VALUES ${placeholders}
       ON CONFLICT (${conflictCol}) DO NOTHING`,
      params
    );
    inserted += result.rowCount;
  }
  return inserted;
};

const clean = (s) => s.replace(/\s+/g, ' ').trim();

const run = async () => {
  console.log('🌍 Seeding global taxonomy from O*NET (US Dept of Labor open data)…\n');

  // 1. Technology skills (~30k rows → unique tools)
  const techRaw = parseTSV(await fetchText(FILES.techSkills));
  const tools = [...new Set(techRaw.map((r) => clean(r['Example'] || '')).filter((t) => t.length > 1 && t.length < 200))]
    .map((name) => ({ name, category: 'technology', source: 'onet' }));
  console.log(`  → ${tools.length} unique technologies/tools`);



  // 2. Skills + Knowledge names (occupation-rated competencies)
  const skillsRawAll    = parseTSV(await fetchText(FILES.skills));
  const knowledgeRawAll = parseTSV(await fetchText(FILES.knowledge));
  const competencies = [...new Set([
    ...skillsRawAll.map((r) => clean(r['Element Name'] || '')),
    ...knowledgeRawAll.map((r) => clean(r['Element Name'] || '')),
  ].filter((s) => s.length > 1))].map((name) => ({ name, category: 'competency', source: 'onet' }));

  // Role → skills pairs, quality-filtered:
  //  A) competencies from Skills/Knowledge with importance (IM) >= 3.0 — sorted by importance
  //  B) tools from Technology Skills ONLY if Hot Technology or In Demand = Y
  const compPairs = [...skillsRawAll, ...knowledgeRawAll]
    .filter((r) => r['Scale ID'] === 'IM' && parseFloat(r['Data Value']) >= 3.0
                && r['O*NET-SOC Code'] && r['Element Name'])
    .map((r) => ({ code: r['O*NET-SOC Code'], skill: clean(r['Element Name']),
                   weight: parseFloat(r['Data Value']) }));
  compPairs.sort((a, b) => b.weight - a.weight);

  const toolPairs = techRaw
    .filter((r) => r['O*NET-SOC Code'] && r['Example']
                && ((r['Hot Technology'] || '').trim().toUpperCase() === 'Y'
                 || (r['In Demand'] || '').trim().toUpperCase() === 'Y'))
    .map((r) => ({ code: r['O*NET-SOC Code'], skill: clean(r['Example']), weight: 1 }));

  const roleSkillPairs = [...new Map([...compPairs, ...toolPairs]
    .map((p) => [`${p.code}|${p.skill.toLowerCase()}`, p])).values()];
  console.log(`  → ${roleSkillPairs.length} role-skill mappings (competencies + hot tools)`);
  console.log(`  → ${competencies.length} competencies/knowledge areas`);

  // 3. Soft skills (curated)
  const soft = SOFT_SKILLS.map((name) => ({ name, category: 'soft', source: 'curated' }));

  // 4. Job titles: occupations + alternate titles (~57k)
  const occRaw    = parseTSV(await fetchText(FILES.occupations));
  const altRaw    = parseTSV(await fetchText(FILES.altTitles));
  const titles = [...new Map([
    ...occRaw.map((r) => [clean(r['Title'] || '').toLowerCase(), { title: clean(r['Title']), onet_code: r['O*NET-SOC Code'] }]),
    ...altRaw.map((r) => [clean(r['Alternate Title'] || '').toLowerCase(), { title: clean(r['Alternate Title']), onet_code: r['O*NET-SOC Code'] }]),
  ].filter(([k]) => k.length > 2 && k.length < 250)).values()];
  console.log(`  → ${titles.length} unique job titles`);

  // 5. Certifications (curated)
  const certs = CERTIFICATIONS.map(([name, field]) => ({ name, field }));

  console.log('\n💾 Inserting into PostgreSQL…');
  const c1 = await batchInsert('taxonomy_skills', 'name', [...tools, ...competencies, ...soft]);
  console.log(`  ✓ taxonomy_skills: ${c1} new rows`);
  const c2 = await batchInsert('taxonomy_job_titles', 'title', titles);
  console.log(`  ✓ taxonomy_job_titles: ${c2} new rows`);
  const c3 = await batchInsert('taxonomy_certifications', 'name', certs);
  console.log(`  ✓ taxonomy_certifications: ${c3} new rows`);

  // Insert role-skill pairs
  let c4 = 0;
  const RS_BATCH = 500;
  for (let i = 0; i < roleSkillPairs.length; i += RS_BATCH) {
    const chunk = roleSkillPairs.slice(i, i + RS_BATCH);
    const params = [];
    const ph = chunk.map((p, j) => { params.push(p.code, p.skill); return `($${j*2+1}, $${j*2+2})`; }).join(',');
    const r = await query(
      `INSERT INTO taxonomy_role_skills (onet_code, skill) VALUES ${ph} ON CONFLICT DO NOTHING`, params);
    c4 += r.rowCount;
  }
  console.log(`  ✓ taxonomy_role_skills: ${c4} new rows`);

  const totals = await query(`
    SELECT
      (SELECT COUNT(*) FROM taxonomy_skills)         AS skills,
      (SELECT COUNT(*) FROM taxonomy_job_titles)     AS titles,
      (SELECT COUNT(*) FROM taxonomy_certifications) AS certs
  `);
  console.log('\n📊 Taxonomy totals:', totals.rows[0]);
  console.log('✅ Done. Restart backend to load taxonomy into memory.');
  await pool.end();
};

run().catch((err) => { console.error('❌ Seed failed:', err.message); process.exit(1); });
