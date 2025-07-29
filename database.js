// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database file
const db = new sqlite3.Database(path.join(__dirname, 'university.db'), (err) => {
  if (err) {
    console.error('Failed to connect to database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create applications table
db.run(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    surname TEXT NOT NULL,
    age INTEGER NOT NULL,
    dob TEXT NOT NULL,
    email TEXT NOT NULL,
    program TEXT NOT NULL,
    certificatePath TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    submittedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);



// Create admins table
db.run(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    course TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT NOT NULL,
    firstName TEXT NOT NULL,
    surname TEXT NOT NULL,
    dob TEXT NOT NULL,
    phone TEXT NOT NULL,
    course TEXT NOT NULL,
    enrolled TEXT NOT NULL,
    email TEXT NOT NULL,
    semester TEXT NOT NULL,
    result TEXT
  )
`);

// Create semesters table
db.run(`
  CREATE TABLE IF NOT EXISTS semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    semester TEXT NOT NULL,
    duration TEXT NOT NULL,
    endDate TEXT NOT NULL,
    UNIQUE(semester, duration)
  )
`);


// Create semester_results table
db.run(`
  CREATE TABLE IF NOT EXISTS semester_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT NOT NULL,
    semester TEXT NOT NULL,
    duration TEXT NOT NULL,
    subject TEXT NOT NULL,
    marks INTEGER NOT NULL,
    remarks TEXT,
    grade TEXT,
    dateAdded TEXT NOT NULL,
    UNIQUE(studentId, semester, subject)
  )
`);

// Create staff table
db.run(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    fullName TEXT NOT NULL,
    department TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS approved_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    surname TEXT NOT NULL,
    age INTEGER NOT NULL,
    dob TEXT NOT NULL,
    email TEXT NOT NULL,
    program TEXT NOT NULL,
    certificatePath TEXT NOT NULL,
    approvedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin' or 'staff'
  userId INTEGER NOT NULL, -- ID from admins or staff table
  postedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  media TEXT

  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS alumni_stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    course TEXT NOT NULL,
    year TEXT NOT NULL,
    job TEXT NOT NULL,
    story TEXT NOT NULL,
    photo TEXT,
    status TEXT DEFAULT 'Pending',
    submittedAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`ALTER TABLE news ADD COLUMN media TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Failed to add media column to news table:', err.message);
  }
});

module.exports = db;


