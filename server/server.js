// server/server.js
// Main server for the CS Department Portal.
// Plain Express + SQLite + sessions. No build step, no frontend framework -
// keeps things simple to run and easy to modify.

const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db');
const { hashPassword, verifyPassword } = require('./auth-utils');
const autoSeedAdmin = require('./autoSeedAdmin');

const app = express();
const PORT = process.env.PORT || 3000;

// If SEED_ADMIN_* environment variables are set, create that admin account
// now. Safe to leave this running - it skips silently if the admin already exists.
autoSeedAdmin();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-please',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// Serve static frontend files (html/css/js)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// AUTH MIDDLEWARE
// ---------------------------------------------------------------------------

function requireStudent(req, res, next) {
  if (req.session && req.session.studentId) return next();
  return res.status(401).json({ error: 'Please log in as a student first.' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Please log in as an admin first.' });
}

// ---------------------------------------------------------------------------
// STUDENT AUTH ROUTES
// ---------------------------------------------------------------------------

app.post('/api/student/signup', (req, res) => {
  try {
    const { name, email, password, department, year, roll_number, phone } = req.body;

    if (!name || !email || !password || !department || !year) {
      return res.status(400).json({ error: 'Name, email, password, department and year are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM students WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }

    const { hash, salt } = hashPassword(password);
    const info = db.prepare(`
      INSERT INTO students (name, email, password_hash, password_salt, department, year, roll_number, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), cleanEmail, hash, salt, department.trim(), year.trim(), (roll_number || '').trim(), (phone || '').trim());

    req.session.studentId = info.lastInsertRowid;
    req.session.studentName = name.trim();

    res.json({ success: true, message: 'Account created successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while creating the account.' });
  }
});

app.post('/api/student/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const cleanEmail = email.trim().toLowerCase();
    const student = db.prepare('SELECT * FROM students WHERE email = ?').get(cleanEmail);
    if (!student) return res.status(400).json({ error: 'No account found with that email.' });

    const ok = verifyPassword(password, student.password_salt, student.password_hash);
    if (!ok) return res.status(400).json({ error: 'Incorrect password.' });

    req.session.studentId = student.id;
    req.session.studentName = student.name;
    res.json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while logging in.' });
  }
});

app.post('/api/student/logout', (req, res) => {
  req.session.studentId = null;
  req.session.studentName = null;
  res.json({ success: true });
});

app.get('/api/student/me', requireStudent, (req, res) => {
  const student = db.prepare('SELECT id, name, email, department, year, roll_number, phone FROM students WHERE id = ?').get(req.session.studentId);
  res.json({ student });
});

// ---------------------------------------------------------------------------
// ADMIN AUTH ROUTES
// ---------------------------------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const cleanEmail = email.trim().toLowerCase();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(cleanEmail);
    if (!admin) return res.status(400).json({ error: 'No admin account found with that email.' });

    const ok = verifyPassword(password, admin.password_salt, admin.password_hash);
    if (!ok) return res.status(400).json({ error: 'Incorrect password.' });

    req.session.adminId = admin.id;
    req.session.adminName = admin.name;
    res.json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while logging in.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.adminId = null;
  req.session.adminName = null;
  res.json({ success: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  const admin = db.prepare('SELECT id, name, email FROM admins WHERE id = ?').get(req.session.adminId);
  res.json({ admin });
});

// Admin can add another admin (so the dept can have more than one staff account)
app.post('/api/admin/add-admin', requireAdmin, (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(cleanEmail);
    if (existing) return res.status(400).json({ error: 'An admin with this email already exists.' });

    const { hash, salt } = hashPassword(password);
    db.prepare('INSERT INTO admins (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)')
      .run(name.trim(), cleanEmail, hash, salt);

    res.json({ success: true, message: 'New admin added.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC EVENT ROUTES (anyone can view published events, even logged out)
// ---------------------------------------------------------------------------

app.get('/api/events', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, 
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as registration_count
    FROM events e
    WHERE e.is_published = 1
    ORDER BY e.event_date ASC, e.id DESC
  `).all();
  res.json({ events });
});

app.get('/api/events/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND is_published = 1').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event });
});

// ---------------------------------------------------------------------------
// STUDENT REGISTRATION ROUTES
// ---------------------------------------------------------------------------

// Register self + optional teammates for an event
app.post('/api/events/:id/register', requireStudent, (req, res) => {
  const eventId = req.params.id;
  const { team_name, teammates } = req.body; // teammates = array of {name, department, year, email}

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  // Check deadline
  if (event.registration_deadline) {
    const deadline = new Date(event.registration_deadline);
    if (!isNaN(deadline.getTime()) && new Date() > deadline) {
      return res.status(400).json({ error: 'Registration deadline for this event has passed.' });
    }
  }

  // Prevent double registration by the same student for the same event
  const already = db.prepare(`
    SELECT r.id FROM registrations r
    JOIN team_members tm ON tm.registration_id = r.id
    WHERE r.event_id = ? AND tm.student_id = ?
  `).get(eventId, req.session.studentId);
  if (already) {
    return res.status(400).json({ error: 'You are already registered for this event.' });
  }

  const teamList = Array.isArray(teammates) ? teammates.filter(t => t && t.name && t.name.trim()) : [];
  const totalMembers = 1 + teamList.length; // leader + teammates

  if (event.min_team_size && totalMembers < event.min_team_size) {
    return res.status(400).json({ error: `This event requires at least ${event.min_team_size} member(s) per team.` });
  }
  if (event.max_team_size && totalMembers > event.max_team_size) {
    return res.status(400).json({ error: `This event allows at most ${event.max_team_size} member(s) per team.` });
  }

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.session.studentId);

  const insertReg = db.prepare('INSERT INTO registrations (event_id, team_name, registered_by) VALUES (?, ?, ?)');
  const insertMember = db.prepare(`
    INSERT INTO team_members (registration_id, student_id, name, department, year, email, is_leader)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const runTransaction = db.transaction(() => {
    const regInfo = insertReg.run(eventId, (team_name || '').trim() || null, student.id);
    const regId = regInfo.lastInsertRowid;

    // Leader (the logged-in student) is always a member
    insertMember.run(regId, student.id, student.name, student.department, student.year, student.email, 1);

    // Teammates (manually entered details, no login needed for them)
    for (const mate of teamList) {
      insertMember.run(
        regId,
        null,
        mate.name.trim(),
        (mate.department || '').trim(),
        (mate.year || '').trim(),
        (mate.email || '').trim(),
        0
      );
    }
    return regId;
  });

  try {
    const regId = runTransaction();
    res.json({ success: true, message: 'Registered successfully!', registration_id: regId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while registering.' });
  }
});

// Student: view my own registrations
app.get('/api/student/my-registrations', requireStudent, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id as registration_id, r.team_name, r.created_at, e.id as event_id, e.title, e.event_date, e.venue
    FROM registrations r
    JOIN team_members tm ON tm.registration_id = r.id
    JOIN events e ON e.id = r.event_id
    WHERE tm.student_id = ?
    ORDER BY r.created_at DESC
  `).all(req.session.studentId);
  res.json({ registrations: rows });
});

// ---------------------------------------------------------------------------
// ADMIN: EVENT MANAGEMENT
// ---------------------------------------------------------------------------

app.get('/api/admin/events', requireAdmin, (req, res) => {
  const events = db.prepare(`
    SELECT e.*, 
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as registration_count,
      (SELECT COUNT(*) FROM team_members tm JOIN registrations r ON r.id = tm.registration_id WHERE r.event_id = e.id) as total_participants
    FROM events e
    ORDER BY e.id DESC
  `).all();
  res.json({ events });
});

app.post('/api/admin/events', requireAdmin, (req, res) => {
  try {
    const { title, description, event_date, event_time, venue, max_team_size, min_team_size, registration_deadline, is_published } = req.body;
    if (!title) return res.status(400).json({ error: 'Event title is required.' });

    const info = db.prepare(`
      INSERT INTO events (title, description, event_date, event_time, venue, max_team_size, min_team_size, registration_deadline, is_published, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      (description || '').trim(),
      event_date || null,
      event_time || null,
      (venue || '').trim(),
      parseInt(max_team_size) || 1,
      parseInt(min_team_size) || 1,
      registration_deadline || null,
      is_published === false || is_published === 'false' ? 0 : 1,
      req.session.adminId
    );

    res.json({ success: true, event_id: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while creating the event.' });
  }
});

app.put('/api/admin/events/:id', requireAdmin, (req, res) => {
  try {
    const { title, description, event_date, event_time, venue, max_team_size, min_team_size, registration_deadline, is_published } = req.body;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    db.prepare(`
      UPDATE events SET title = ?, description = ?, event_date = ?, event_time = ?, venue = ?,
        max_team_size = ?, min_team_size = ?, registration_deadline = ?, is_published = ?
      WHERE id = ?
    `).run(
      title || event.title,
      description !== undefined ? description : event.description,
      event_date !== undefined ? event_date : event.event_date,
      event_time !== undefined ? event_time : event.event_time,
      venue !== undefined ? venue : event.venue,
      max_team_size !== undefined ? parseInt(max_team_size) : event.max_team_size,
      min_team_size !== undefined ? parseInt(min_team_size) : event.min_team_size,
      registration_deadline !== undefined ? registration_deadline : event.registration_deadline,
      is_published !== undefined ? (is_published === false || is_published === 'false' ? 0 : 1) : event.is_published,
      req.params.id
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while updating the event.' });
  }
});

app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while deleting the event.' });
  }
});

// ---------------------------------------------------------------------------
// ADMIN: MONITORING / REGISTRATION DATA
// ---------------------------------------------------------------------------

// Overview stats for the dashboard home
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalEvents = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const totalRegistrations = db.prepare('SELECT COUNT(*) as c FROM registrations').get().c;
  const totalParticipants = db.prepare('SELECT COUNT(*) as c FROM team_members').get().c;
  const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get().c;

  const byDepartment = db.prepare(`
    SELECT department, COUNT(*) as count FROM team_members
    WHERE department IS NOT NULL AND department != ''
    GROUP BY department ORDER BY count DESC
  `).all();

  const byYear = db.prepare(`
    SELECT year, COUNT(*) as count FROM team_members
    WHERE year IS NOT NULL AND year != ''
    GROUP BY year ORDER BY year ASC
  `).all();

  res.json({ totalEvents, totalRegistrations, totalParticipants, totalStudents, byDepartment, byYear });
});

// Full registration list for one event, with team members, for admins to view/monitor
app.get('/api/admin/events/:id/registrations', requireAdmin, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const registrations = db.prepare(`
    SELECT r.id, r.team_name, r.created_at, s.name as leader_name, s.email as leader_email
    FROM registrations r
    JOIN students s ON s.id = r.registered_by
    WHERE r.event_id = ?
    ORDER BY r.created_at ASC
  `).all(req.params.id);

  const memberStmt = db.prepare('SELECT name, department, year, email, is_leader FROM team_members WHERE registration_id = ? ORDER BY is_leader DESC, id ASC');

  const fullData = registrations.map(reg => ({
    ...reg,
    team_size: memberStmt.all(reg.id).length,
    members: memberStmt.all(reg.id)
  }));

  res.json({ event, registrations: fullData });
});

// All registrations across all events in one flat list - handy for a single "monitor everything" view
app.get('/api/admin/all-registrations', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id as registration_id, r.team_name, r.created_at,
           e.id as event_id, e.title as event_title,
           s.name as leader_name, s.email as leader_email, s.department as leader_department, s.year as leader_year
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    JOIN students s ON s.id = r.registered_by
    ORDER BY r.created_at DESC
  `).all();

  const memberStmt = db.prepare('SELECT name, department, year, email, is_leader FROM team_members WHERE registration_id = ? ORDER BY is_leader DESC, id ASC');

  const fullData = rows.map(reg => ({
    ...reg,
    team_size: memberStmt.all(reg.registration_id).length,
    members: memberStmt.all(reg.registration_id)
  }));

  res.json({ registrations: fullData });
});

// Export all registrations for one event as CSV - makes it easy for admins to open in Excel
app.get('/api/admin/events/:id/export-csv', requireAdmin, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const registrations = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(req.params.id);
  const memberStmt = db.prepare('SELECT name, department, year, email, is_leader FROM team_members WHERE registration_id = ? ORDER BY is_leader DESC, id ASC');

  let csv = 'Team Name,Member Name,Department,Year,Email,Role\n';
  for (const reg of registrations) {
    const members = memberStmt.all(reg.id);
    for (const m of members) {
      const row = [
        reg.team_name || '(individual)',
        m.name,
        m.department || '',
        m.year || '',
        m.email || '',
        m.is_leader ? 'Team Leader' : 'Member'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      csv += row + '\n';
    }
  }

  const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_registrations.csv"`);
  res.send(csv);
});

// ---------------------------------------------------------------------------
// FALLBACK - send index.html for unknown non-api routes (simple multi-page app, so usually unnecessary,
// but kept as a safety net)
// ---------------------------------------------------------------------------

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'), (err) => {
    if (err) res.status(404).send('Page not found.');
  });
});

app.listen(PORT, () => {
  console.log(`CS Department Portal running at http://localhost:${PORT}`);
});
