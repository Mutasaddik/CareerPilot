import { query } from '../models/db.js';
import logger from './loggerService.js';

export const getUserProfile = async (userId) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.current_title,
            u.experience_years, u.location, u.avatar_url,
            u.plan, u.theme_preference, u.timezone,
            u.is_verified, u.created_at,
            p.target_roles, p.target_locations, p.skills,
            p.job_type, p.salary_min_bdt, p.salary_max_bdt,
            p.remote_preference, p.cv_template_preference,
            p.onboarding_completed
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

export const updateUserProfile = async (userId, fields) => {
  const allowed = ['name', 'phone', 'current_title', 'experience_years', 'location', 'avatar_url', 'theme_preference', 'timezone'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
  }
  if (updates.length === 0) return;
  values.push(userId);
  await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
    values
  );
};

export const updateUserPreferences = async (userId, prefs) => {
  const {
    targetRoles, targetLocations, skills,
    jobType, salaryMinBdt, salaryMaxBdt,
    remotePreference, cvTemplatePreference,
  } = prefs;

  // PostgreSQL array columns need actual arrays, not JSON strings
  const rolesArr     = Array.isArray(targetRoles)     ? targetRoles     : [];
  const locationsArr = Array.isArray(targetLocations) ? targetLocations : [];
  const skillsArr    = Array.isArray(skills)          ? skills          : [];

  await query(
    `INSERT INTO user_profiles (user_id, target_roles, target_locations, skills,
       job_type, salary_min_bdt, salary_max_bdt, remote_preference, cv_template_preference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id) DO UPDATE SET
       target_roles           = CASE WHEN $2 = '{}' THEN user_profiles.target_roles ELSE $2 END,
       target_locations       = CASE WHEN $3 = '{}' THEN user_profiles.target_locations ELSE $3 END,
       skills                 = CASE WHEN $4 = '{}' THEN user_profiles.skills ELSE $4 END,
       job_type               = COALESCE($5, user_profiles.job_type),
       salary_min_bdt         = COALESCE($6, user_profiles.salary_min_bdt),
       salary_max_bdt         = COALESCE($7, user_profiles.salary_max_bdt),
       remote_preference      = COALESCE($8, user_profiles.remote_preference),
       cv_template_preference = COALESCE($9, user_profiles.cv_template_preference)`,
    [
      userId,
      rolesArr,
      locationsArr,
      skillsArr,
      jobType          || null,
      salaryMinBdt     || null,
      salaryMaxBdt     || null,
      remotePreference || null,
      cvTemplatePreference || null,
    ]
  );
};

export const completeOnboarding = async (userId) => {
  await query(
    `INSERT INTO user_profiles (user_id, onboarding_completed)
     VALUES ($1, TRUE)
     ON CONFLICT (user_id) DO UPDATE SET onboarding_completed = TRUE`,
    [userId]
  );
};

export const getOnboardingStatus = async (userId) => {
  const result = await query(
    `SELECT onboarding_completed FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.onboarding_completed || false;
};

export const deleteUserAccount = async (userId) => {
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
  logger.info('User account deleted', { userId });
};

export const exportUserData = async (userId) => {
  const [user, profile, applications, cvs, contacts] = await Promise.all([
    query(`SELECT id, name, email, phone, current_title, experience_years, location, plan, created_at FROM users WHERE id = $1`, [userId]),
    query(`SELECT * FROM user_profiles WHERE user_id = $1`, [userId]),
    query(`SELECT * FROM applications WHERE user_id = $1`, [userId]),
    query(`SELECT id, file_url, ats_score, version_number, is_primary, uploaded_at FROM cvs WHERE user_id = $1`, [userId]),
    query(`SELECT * FROM contacts WHERE user_id = $1`, [userId]),
  ]);
  return {
    exportedAt:   new Date().toISOString(),
    user:         user.rows[0],
    profile:      profile.rows[0],
    applications: applications.rows,
    cvs:          cvs.rows,
    contacts:     contacts.rows,
  };
};
