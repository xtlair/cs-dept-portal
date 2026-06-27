// server/seedAdmin.js
// Run this once with: npm run seed-admin
// It creates the very first admin account so someone can log in to /admin-login.html
// You can add more admins later from inside the Admin Dashboard itself.

const readline = require('readline');
const db = require('./db');
const { hashPassword } = require('./auth-utils');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('--- Create the first Admin account for the CS Dept Portal ---');
  const name = await ask('Admin name: ');
  const email = await ask('Admin email: ');
  const password = await ask('Admin password: ');

  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    console.log('An admin with that email already exists. No changes made.');
    rl.close();
    return;
  }

  const { hash, salt } = hashPassword(password);
  db.prepare(
    'INSERT INTO admins (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.trim().toLowerCase(), hash, salt);

  console.log(`Admin account created for ${email}. You can now log in at /admin-login.html`);
  rl.close();
}

main();
