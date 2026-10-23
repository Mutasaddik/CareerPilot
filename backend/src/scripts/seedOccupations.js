// Loads O*NET occupation names (Occupation Data.txt) into taxonomy_occupations.
// Safe to re-run. Run after seed:taxonomy:  npm run seed:occupations
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../../data/onet/Occupation%20Data.txt');

const run = async () => {
  const [header, ...lines] = fs.readFileSync(FILE, 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = header.split('\t');
  const iCode = cols.indexOf('O*NET-SOC Code'), iTitle = cols.indexOf('Title'), iDesc = cols.indexOf('Description');
  let n = 0;
  for (const line of lines) {
    const c = line.split('\t');
    if (!c[iCode] || !c[iTitle]) continue;
    await query(
      `INSERT INTO taxonomy_occupations (onet_code, title, description) VALUES ($1, $2, $3)
       ON CONFLICT (onet_code) DO UPDATE SET title = $2, description = $3`,
      [c[iCode].trim(), c[iTitle].trim(), (c[iDesc] || '').trim()]
    );
    n++;
  }
  console.log(`✅ ${n} occupations seeded`);
  await pool.end();
};

run().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
