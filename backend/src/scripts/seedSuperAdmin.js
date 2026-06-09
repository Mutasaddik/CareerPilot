import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { query } from '../models/db.js';
import logger from '../services/loggerService.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

const mask = (str) => '*'.repeat(str.length);

const run = async () => {
  console.log('\n🔐 CareerPilot — SuperAdmin Seed CLI');
  console.log('─────────────────────────────────────');
  console.log('This creates a SuperAdmin account securely.');
  console.log('This script must ONLY be run by authorized personnel.\n');

  try {
    // Check existing superadmin count
    const existing = await query(`SELECT COUNT(*) FROM admin_users WHERE role = 'superadmin'`);
    const count = parseInt(existing.rows[0].count);

    if (count >= 2) {
      console.log('❌ Maximum SuperAdmin accounts (2) already exist. Cannot create more.');
      process.exit(1);
    }

    const name     = (await ask('Full Name: ')).trim();
    const email    = (await ask('Email: ')).trim().toLowerCase();
    const password = (await ask('Password (min 12 chars): ')).trim();

    if (!name || !email || !password) {
      console.log('❌ All fields are required.');
      process.exit(1);
    }

    if (password.length < 12) {
      console.log('❌ Password must be at least 12 characters.');
      process.exit(1);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log('❌ Invalid email address.');
      process.exit(1);
    }

    const confirm = await ask(`\nCreate SuperAdmin "${name}" <${email}>? (yes/no): `);
    if (confirm.trim().toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log('ℹ️  User already exists — promoting to SuperAdmin.');
    } else {
      const passwordHash = await bcrypt.hash(password, 14);
      const result = await query(
        `INSERT INTO users (name, email, password_hash, is_verified) VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [name, email, passwordHash]
      );
      userId = result.rows[0].id;
    }

    // Check if already an admin
    const alreadyAdmin = await query('SELECT id FROM admin_users WHERE user_id = $1', [userId]);
    if (alreadyAdmin.rows.length > 0) {
      await query(`UPDATE admin_users SET role = 'superadmin', is_active = TRUE WHERE user_id = $1`, [userId]);
    } else {
      await query(
        `INSERT INTO admin_users (user_id, role, is_active) VALUES ($1, 'superadmin', TRUE)`,
        [userId]
      );
    }

    console.log('\n✅ SuperAdmin created successfully.');
    console.log(`   Name:  ${name}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role:  superadmin`);
    console.log('\nLogin at: /login → redirects to /superadmin/dashboard\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
};

run();
