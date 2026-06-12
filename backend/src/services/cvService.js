import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../models/db.js';
import { analyzeCV } from './aiService.js';
import logger from './loggerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/cvs');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── Hash CV content ───────────────────────────────────────────────
export const hashCV = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// ── Check duplicate per user ──────────────────────────────────────
export const isDuplicateCV = async (userId, hash) => {
  const result = await query(
    `SELECT id FROM cvs WHERE user_id = $1 AND file_hash = $2`,
    [userId, hash]
  );
  return result.rows.length > 0;
};

// ── Save CV file locally (dev) or R2 (prod) ───────────────────────
export const saveCV = async (buffer, filename, userId) => {
  // In production use R2 — in dev save locally
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
    return await saveCVToR2(buffer, filename, userId);
  }
  return saveCVLocally(buffer, filename, userId);
};

const saveCVLocally = (buffer, filename, userId) => {
  const userDir = path.join(UPLOAD_DIR, userId);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const filePath = path.join(userDir, filename);
  fs.writeFileSync(filePath, buffer);
  return `/api/v1/cv/file/${userId}/${filename}`;
};

const saveCVToR2 = async (buffer, filename, userId) => {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const key = `cvs/${userId}/${filename}`;
  await client.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
};

// ── Extract text from PDF/DOCX ────────────────────────────────────
export const extractText = async (buffer, mimetype) => {
  try {
    if (mimetype === 'application/pdf') {
      return extractFromPDF(buffer);
    }
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return extractFromDOCX(buffer);
    }
    return '';
  } catch (err) {
    logger.error('Text extraction failed', { error: err.message });
    return '';
  }
};

const extractFromPDF = async (buffer) => {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = (pdfjsLib.default || pdfjsLib).getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1).then(p => p.getTextContent()).then(tc => tc.items.map(i => i.str).join(' '))));
    const data = { text: pages.join(' ') };
    return data.text || '';
  } catch (err) {
    logger.warn('PDF parse failed', { error: err.message });
    return '';
  }
};

const extractFromDOCX = async (buffer) => {
  try {
    const mammoth = await import('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (err) {
    logger.warn('DOCX parse failed', { error: err.message });
    return '';
  }
};

// ── Get next version number for user ─────────────────────────────
export const getNextVersionNumber = async (userId) => {
  const result = await query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 as next FROM cvs WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0].next;
};

// ── Save CV record to DB ──────────────────────────────────────────
export const createCVRecord = async ({
  userId, fileUrl, fileHash, extractedText,
  analysisJson, atsScore, versionNumber,
  templatePreference, usageScope, companyName, jobId, isPrimary,
  originalFilename,
}) => {
  // If setting as primary, unset previous primary
  if (isPrimary) {
    await query(
      `UPDATE cvs SET is_primary = FALSE WHERE user_id = $1`,
      [userId]
    );
  }

  const result = await query(
    `INSERT INTO cvs (
       user_id, file_url, file_hash, extracted_text, ats_score,
       analysis_json, version_number, template_preference,
       usage_scope, company_name, job_id, is_primary, original_filename
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      userId, fileUrl, fileHash, extractedText, atsScore,
      JSON.stringify(analysisJson), versionNumber,
      templatePreference || 'modern',
      usageScope || 'primary', companyName || null, jobId || null,
      isPrimary !== false,
      originalFilename || null,
    ]
  );
  return result.rows[0];
};

// ── Get all CVs for user ──────────────────────────────────────────
export const getUserCVs = async (userId) => {
  const result = await query(
    `SELECT id, file_url, file_hash, ats_score, version_number,
            template_preference, usage_scope, company_name, job_id,
            is_primary, uploaded_at, original_filename,
            analysis_json,
            analysis_json->>'grade' as grade,
            analysis_json->>'daily_tip' as daily_tip
     FROM cvs
     WHERE user_id = $1
     ORDER BY uploaded_at DESC`,
    [userId]
  );
  return result.rows;
};

// ── Get single CV ─────────────────────────────────────────────────
export const getCVById = async (cvId, userId) => {
  const result = await query(
    `SELECT * FROM cvs WHERE id = $1 AND user_id = $2`,
    [cvId, userId]
  );
  return result.rows[0] || null;
};

// ── Set CV as primary ─────────────────────────────────────────────
export const setCVAsPrimary = async (cvId, userId) => {
  await query(`UPDATE cvs SET is_primary = FALSE WHERE user_id = $1`, [userId]);
  await query(`UPDATE cvs SET is_primary = TRUE  WHERE id = $1 AND user_id = $2`, [cvId, userId]);
};

// ── Update CV usage scope ─────────────────────────────────────────
export const updateCVScope = async (cvId, userId, usageScope, companyName, jobId) => {
  await query(
    `UPDATE cvs SET usage_scope = $1, company_name = $2, job_id = $3 WHERE id = $4 AND user_id = $5`,
    [usageScope, companyName || null, jobId || null, cvId, userId]
  );
};

// ── Delete CV ─────────────────────────────────────────────────────
export const deleteCV = async (cvId, userId) => {
  const cv = await getCVById(cvId, userId);
  if (!cv) throw new Error('CV not found');

  // Delete file locally
  if (cv.file_url.startsWith('/api/v1/cv/file/')) {
    const filename = cv.file_url.split('/').pop();
    const filePath = path.join(UPLOAD_DIR, userId, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await query(`DELETE FROM cvs WHERE id = $1 AND user_id = $2`, [cvId, userId]);
};

// ── Get primary CV ────────────────────────────────────────────────
export const getPrimaryCV = async (userId) => {
  const result = await query(
    `SELECT * FROM cvs WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};
