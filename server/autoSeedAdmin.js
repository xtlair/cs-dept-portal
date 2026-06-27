// server/autoSeedAdmin.js
// Runs automatically every time the server starts. If env vars for an admin
// account are set AND no admin exists yet with that email, it creates one.
// This exists so admins can be created on free hosting plans that don't
// give you an interactive terminal (like Render's free tier).
//
// Set these as Environment Variables in your hosting dashboard:
//   SEED_ADMIN_NAME
//   SEED_ADMIN_EMAIL
//   SEED_ADMIN_PASSWORD
//
// After it successfully creates the admin once, you can delete those env
// vars (or leave them - it won't create duplicates, it just skips if the
// email already exists).

const db = require('./db');
const { hashPassword } = require('./auth-utils');

function autoSeedAdmin() {
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    return; // nothing to do, env vars not set
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(cleanEmail);
  if (existing) {
    console.log(`[autoSeedAdmin] Admin ${cleanEmail} already exists, skipping.`);
    return;
  }

  const { hash, salt } = hashPassword(password);
  db.prepare(
    'INSERT INTO admins (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), cleanEmail, hash, salt);

  console.log(`[autoSeedAdmin] Created admin account for ${cleanEmail}.`);
}

module.exports = autoSeedAdmin;
