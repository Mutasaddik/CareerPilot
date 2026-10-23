// ════════════════════════════════════════════════════════════════
// Import salary benchmarks (e.g. Betonkemon) from a CSV or JSON file
//
//   npm run import:salaries -- path/to/file.csv [--source betonkemon] [--yearly]
//
// Columns (case-insensitive, extra columns ignored):
//   designation (required)        job title as listed by the source
//   salary | salary_min, salary_max   monthly BDT; "25000", "25k", "25,000-35,000"
//   experience | experience_level | experience_years   "2 years", "3-5", "Senior"…
//   company, url (optional)
//
// Each designation is checked first: it must map to one of CareerPilot's
// role families, otherwise the row is skipped and listed in the report.
// The import replaces all previous rows from the same source.
// ════════════════════════════════════════════════════════════════
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { withTransaction } from '../models/db.js';
import { deleteCachePattern } from '../models/redis.js';
import { loadRoleMappings, loadCuratedPacks, loadOccupations, classifyOccupation } from '../services/taxonomyService.js';

const MIN_MONTHLY = 5000;
const MAX_MONTHLY = 1500000;

// ── Args ──────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const source    = sourceIdx >= 0 && args[sourceIdx + 1] ? args[sourceIdx + 1] : 'betonkemon';
const file      = args.find((a, i) => !a.startsWith('--') && (sourceIdx < 0 || i !== sourceIdx + 1));
const yearly    = args.includes('--yearly');

if (!file || !fs.existsSync(file)) {
  console.error('Usage: npm run import:salaries -- path/to/file.csv [--source betonkemon] [--yearly]');
  process.exit(1);
}

// ── Parsing ───────────────────────────────────────────────────────
const parseCSV = (text) => {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const [header, ...data] = rows;
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
};

const readRows = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  if (path.extname(filePath).toLowerCase() === '.json') {
    const json = JSON.parse(text);
    const list = Array.isArray(json) ? json : json.data || json.rows || [];
    return list.map((o) => Object.fromEntries(
      Object.entries(o).map(([k, v]) => [k.trim().toLowerCase().replace(/[\s-]+/g, '_'), String(v ?? '').trim()])
    ));
  }
  return parseCSV(text);
};

const pick = (row, ...names) => names.map((n) => row[n]).find((v) => v !== undefined && v !== '');

// "25k" → 25000, "25,000" → 25000
const toNumber = (s) => {
  const m = String(s).toLowerCase().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1));
};

const parseSalary = (row) => {
  let min = toNumber(pick(row, 'salary_min', 'min_salary', 'minimum_salary') || '');
  let max = toNumber(pick(row, 'salary_max', 'max_salary', 'maximum_salary') || '');
  if (!min) {
    const single = pick(row, 'salary', 'salary_range', 'monthly_salary', 'avg_salary', 'average_salary');
    if (single) {
      const parts = String(single).split(/\s*(?:-|–|to)\s*/i).map(toNumber).filter(Boolean);
      [min, max] = [parts[0] || null, parts[1] || null];
    }
  }
  if (!min) return null;
  if (yearly) { min = Math.round(min / 12); max = max ? Math.round(max / 12) : null; }
  if (max && max < min) [min, max] = [max, min];
  return { min, max: max && max !== min ? max : null };
};

const parseLevel = (row) => {
  const raw = (pick(row, 'experience_level', 'level', 'experience', 'experience_years', 'years') || '').toLowerCase();
  if (!raw) return null;
  if (/intern|fresh|entry|junior|trainee/.test(raw)) return 'entry';
  if (/senior|lead|head|principal|manager/.test(raw)) return 'senior';
  if (/mid/.test(raw)) return 'mid';
  const years = parseFloat(raw.match(/\d+(\.\d+)?/)?.[0]);
  if (Number.isNaN(years)) return null;
  return years >= 6 ? 'senior' : years >= 3 ? 'mid' : 'entry';
};

// ── Run ───────────────────────────────────────────────────────────
const run = async () => {
  await loadRoleMappings();
  await loadCuratedPacks();
  await loadOccupations();
  const rows = readRows(file);
  const accepted = [];
  const skipped  = { unknownDesignation: [], noSalary: 0, outOfRange: 0, noDesignation: 0 };

  for (const row of rows) {
    const designation = pick(row, 'designation', 'job_title', 'title', 'position', 'role');
    if (!designation) { skipped.noDesignation++; continue; }

    // Designation first — only roles CareerPilot can place are useful
    const family = classifyOccupation(designation)?.key;
    if (!family) { skipped.unknownDesignation.push(designation); continue; }

    const salary = parseSalary(row);
    if (!salary) { skipped.noSalary++; continue; }
    if (salary.min < MIN_MONTHLY || (salary.max || salary.min) > MAX_MONTHLY) { skipped.outOfRange++; continue; }

    accepted.push({
      designation: designation.slice(0, 255),
      family,
      level:   parseLevel(row),
      company: (pick(row, 'company', 'company_name', 'organization') || '').slice(0, 255) || null,
      url:     pick(row, 'url', 'source_url', 'link') || null,
      ...salary,
    });
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM salary_benchmarks WHERE source = $1`, [source]);
    for (const r of accepted) {
      await client.query(
        `INSERT INTO salary_benchmarks
           (source, designation, role_family, experience_level, company, salary_min_bdt, salary_max_bdt, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [source, r.designation, r.family, r.level, r.company, r.min, r.max, r.url]
      );
    }
  });
  await deleteCachePattern('matches:*'); // job lists show salaries; refresh them

  const byFamily = accepted.reduce((acc, r) => ({ ...acc, [r.family]: (acc[r.family] || 0) + 1 }), {});
  console.log(`\nImported ${accepted.length} of ${rows.length} rows from ${path.basename(file)} as source "${source}".`);
  console.table(byFamily);
  const unknown = [...new Set(skipped.unknownDesignation)];
  console.log('Skipped:');
  console.log(`  designation not mapped to a role: ${skipped.unknownDesignation.length}` +
    (unknown.length ? `  e.g. ${unknown.slice(0, 10).join(' | ')}` : ''));
  console.log(`  no salary: ${skipped.noSalary}   out of range (monthly ৳${MIN_MONTHLY}–${MAX_MONTHLY}): ${skipped.outOfRange}   no designation: ${skipped.noDesignation}`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Import failed:', err.message); process.exit(1); });
