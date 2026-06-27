// server/db.js
// Sets up the SQLite database and creates tables if they don't exist yet.
// Using better-sqlite3 because it's simple, fast, and needs no separate DB server.

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'portal.db');

// Make sure the data folder exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ---------- TABLES ----------

// Admins (CS dept staff who manage events / view registrations)
db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Students (the people who register for events)
db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  roll_number TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Events (created/managed by admins)
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT,
  event_time TEXT,
  venue TEXT,
  max_team_size INTEGER DEFAULT 1,
  min_team_size INTEGER DEFAULT 1,
  registration_deadline TEXT,
  is_published INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES admins(id)
)`);

// Registrations (one row = one team/individual registering for one event)
db.exec(`
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  team_name TEXT,
  registered_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (registered_by) REFERENCES students(id)
)`);

// Team members for a registration. The student who registers is automatically
// added as a member too, so this table holds EVERYONE on the team (including leader).
db.exec(`
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL,
  student_id INTEGER,
  name TEXT NOT NULL,
  department TEXT,
  year TEXT,
  email TEXT,
  is_leader INTEGER DEFAULT 0,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id)
)`);

module.exports = db;
