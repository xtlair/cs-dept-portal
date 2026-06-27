// server/auth-utils.js
// Small helper for hashing & verifying passwords using Node's built-in crypto.
// Avoids needing an external bcrypt package - keeps install simple.

const crypto = require('crypto');

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(plainPassword, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  // timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
