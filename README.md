# CS Department Portal — Sankara College of Science and Commerce

A simple website for the CS Department to announce events and let students register
(solo or as a team), with an admin dashboard to monitor everything: how many teams
joined, team names, member names, departments, years, and team sizes.

Built deliberately simple: plain HTML/CSS/JS pages + one Node.js server + one SQLite
database file. No build tools, no frontend framework, nothing to compile.

## What it does

- **Public homepage** — anyone can see announced events without logging in.
- **Student signup/login** — students create an account with name, email, department, year.
- **Event registration** — a logged-in student registers for an event, optionally as a
  team (give a team name + add teammates' name/department/year/email). Respects
  min/max team size and registration deadlines set per event.
- **Student dashboard** — a student can see their own registrations.
- **Admin login** — separate login for department staff (admins), not mixed with student accounts.
- **Admin dashboard**:
  - Quick stats: total events, total teams registered, total participants, total student accounts.
  - Create / edit / delete / publish events (title, description, date, time, venue, team size limits, deadline).
  - See **every** registration across every event in one table: event, team name, team
    leader, team size, and every member's name/department/year.
  - Filter registrations by event.
  - Export any event's registrations as a CSV (opens in Excel/Google Sheets).
  - Breakdown of participants by department and by year.
  - Add more admin accounts (so more than one staff member can manage it).

## Requirements

- [Node.js](https://nodejs.org) version 18 or later installed on the machine that will run the site.

## Setup (first time only)

Open a terminal in this folder and run:

```bash
npm install
```

This downloads the few packages the site needs (Express, sessions, SQLite). It only
needs internet access for this one step — after that, the site runs fully offline/locally.

Then create the first admin account:

```bash
npm run seed-admin
```

It will ask for an admin name, email, and password in the terminal. This is how the
first department staff member gets into `/admin-login.html`. (More admins can be added
later from inside the dashboard itself, under the "Add Admin" tab.)

## Running the site

```bash
npm start
```

Then open **http://localhost:3000** in a browser. That's it — the whole site (student
pages + admin dashboard) is served from that one address.

To stop the server, press `Ctrl + C` in the terminal.

## Where everything lives

```
public/                  -> all the web pages students/admins see (HTML/CSS/JS)
  index.html              -> homepage / event listing
  student-signup.html      student-login.html      student-dashboard.html
  admin-login.html         admin-dashboard.html
  event.html               -> event details + registration form
server/
  server.js               -> the whole backend (routes for login, events, registration)
  db.js                    -> sets up the database tables automatically on first run
  auth-utils.js            -> password hashing
  seedAdmin.js             -> creates the first admin account (run once)
data/
  portal.db                -> the actual database file (created automatically). 
                               This is your data — back it up if you want to keep it safe.
```

## Putting it online (so students can reach it from outside your computer)

Right now `npm start` only serves the site on your own computer. To make it reachable
by students generally, you'd deploy it to a small hosting service that can run a
Node.js app (e.g. Render, Railway, or a college server if IT can run Node for you).
The code doesn't need to change — just `npm install` and `npm start` on that machine
too, and set the `PORT` environment variable if the host requires a specific one.

## A few notes

- Passwords are stored hashed (not in plain text), using Node's built-in security
  tools — no extra setup needed for that.
- Each browser stays logged in for 8 hours, then needs to log in again.
- If you want to change colors/wording, everything is in plain HTML/CSS in the
  `public/` folder — no compiling needed, just edit and refresh the page.
- If you ever want to wipe all data and start fresh, stop the server and delete the
  `data/portal.db` file (and the `-wal`/`-shm` files next to it, if present). It will
  be recreated empty the next time you run `npm start`. Remember to run
  `npm run seed-admin` again afterward.
