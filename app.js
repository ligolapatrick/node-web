const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database'); // SQLite setup
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const session = require('express-session');

app.use(session({
  secret: 'your-secret-key', // use a strong secret in production
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true if using HTTPS
}));http://localhost:3000/images/campus.jpg


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user) return res.status(401).send('Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send('Invalid credentials');

  req.session.userId = user.id;
  req.session.role = user.role; // e.g., 'staff', 'admin'
  res.redirect('/dashboard');
});

// POST: Create admin
app.post('/create-admin', (req, res) => {
  const { name, password, token, course } = req.body;

  if (token !== '4123') {
    return res.status(403).send('Invalid token');
  }

  db.get('SELECT * FROM admins WHERE name = ?', [name], (err, existingAdmin) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (existingAdmin) {
      return res.status(409).send('Admin name already exists');
    }

    db.run(
      'INSERT INTO admins (name, password, course) VALUES (?, ?, ?)',
      [name, password, course],
      function (err) {
        if (err) {
          console.error(err);
          res.status(500).send('Failed to create admin');
        } else {
          res.send(course); // Send course for dashboard filtering
        }
      }
    );
  });
});

// POST: Admin login
app.post('/admin-login', (req, res) => {
  const { name, password } = req.body;

  db.get(
    'SELECT * FROM admins WHERE name = ? AND password = ?',
    [name, password],
    (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).send('Login error');
      } else if (row) {
        req.session.userId = row.id;
        req.session.role = 'admin';
        req.session.username = row.name;
        res.send(row.course); // ✅ Send course as plain text
      } else {
        res.status(401).send('Invalid credentials');
      }
    }
  );
});


app.post('/create-staff', (req, res) => {
  const { username, password, fullName, department, pin } = req.body;

  // ✅ Server-side PIN check
  if (pin !== '41232025') {
    return res.status(403).send('Invalid PIN');
  }

  db.run(
    `INSERT INTO staff (username, password, fullName, department)
     VALUES (?, ?, ?, ?)`,
    [username, password, fullName, department],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to create staff account');
      } else {
        res.status(200).send('Staff account created');
      }
    }
  );
});

// 🔐 Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  next();
}

// 🔐 Middleware to check user role
function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

app.post('/staff-login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM staff WHERE username = ? AND password = ?',
    [username, password],
    (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).send('Login error');
      } else if (row) {
        req.session.userId = row.id;
        req.session.role = 'staff';
        res.redirect('/portal');
      } else {
        res.status(401).send('Invalid credentials');
      }
    }
  );
});



// Routes for static HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/admission', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admission.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});


// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/certificates');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

app.use('/uploads/certificates', express.static(path.join(__dirname, 'uploads/certificates')));


const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.pdf', '.png', '.mp4'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// POST: Submit application
app.post('/api/apply', upload.single('certificate'), (req, res) => {
  const { firstName, surname, age, dob, email, program } = req.body;
  const certificatePath = req.file ? req.file.path : null;

  if (!certificatePath) {
    return res.status(400).json({ error: 'Certificate upload failed' });
  }

  db.run(
    `INSERT INTO applications (firstName, surname, age, dob, email, program, certificatePath)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [firstName, surname, age, dob, email, program, certificatePath],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save application' });
      } else {
        res.status(200).json({ message: 'Application submitted successfully' });
      }
    }
  );
});

app.post('/submit-application', (req, res) => {
  const { name, email, phone, program } = req.body;
  db.run(
    'INSERT INTO applications (name, email, phone, program) VALUES (?, ?, ?, ?)',
    [name, email, phone, program],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to save application');
      } else {
        res.redirect('/apply');
      }
    }
  );
});


// POST: Add student
app.post('/add-student', (req, res) => {
  const {
    studentId,
    firstName,
    surname,
    dob,
    phone,
    course,
    enrolled,
    semester,
	email,
    result
  } = req.body;

db.run(
  `INSERT INTO students (
    studentId, firstName, surname, dob, phone, course, enrolled, semester, email, result
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // ✅ 10 placeholders
  [studentId, firstName, surname, dob, phone, course, enrolled, semester, email, result],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to add student');
      } else {
        res.status(200).send('Student added');
      }
    }
  );
});


// GET: Fetch students by course
app.get('/api/students', (req, res) => {
  const course = req.query.course;

  db.all('SELECT * FROM students WHERE course = ?', [course], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch students' });
    } else {
      res.json(rows);
    }
  });
});


// POST: Add or update result
app.post('/add-result', (req, res) => {
  const { studentId, semester, subject, marks, remarks, grade } = req.body;

  db.run(`
    INSERT INTO semester_results (studentId, semester, subject, marks, remarks, grade)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(studentId, semester, subject)
    DO UPDATE SET marks = excluded.marks, remarks = excluded.remarks, grade = excluded.grade
  `, [studentId, semester, subject, marks, remarks, grade], function (err) {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to save result');
    } else {
      res.status(200).send('Result saved');
    }
  });
});

// GET: Fetch semesters
app.get('/api/semesters', (req, res) => {
  db.all('SELECT semester, duration FROM semesters', [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch semesters' });
    } else {
      res.json(rows);
    }
  });
});

// GET: Fetch students by course
app.get('/api/students', (req, res) => {
  const course = req.query.course;
  db.all('SELECT * FROM students WHERE course = ?', [course], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch students' });
    } else {
      res.json(rows);
    }
  });
});

// POST: Add bulk results
app.post('/add-bulk-results', (req, res) => {
  const { studentId, course, semester, duration } = req.body;
  const entries = [];

  for (let i = 0; i < 15; i++) {
    const subject = req.body[`subject${i}`];
    const marks = req.body[`marks${i}`];
    const remarks = req.body[`remarks${i}`];
    const grade = req.body[`grade${i}`];

    if (subject && marks) {
      entries.push([studentId, course, semester, duration, subject, marks, remarks, grade]);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO semester_results (studentId, course, semester, duration, subject, marks, remarks, grade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(studentId, semester, subject)
    DO UPDATE SET marks = excluded.marks, remarks = excluded.remarks, grade = excluded.grade
  `);

  entries.forEach(entry => stmt.run(entry));
  stmt.finalize(err => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to save bulk results');
    } else {
      res.status(200).send('Bulk results saved');
    }
  });
});

// GET: Fetch results for a student
app.get('/api/results', (req, res) => {
  const studentId = req.query.studentId;
  db.all('SELECT * FROM semester_results WHERE studentId = ?', [studentId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch results' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/results-by-semester', (req, res) => {
  const { studentId, semester } = req.query;

  db.all(
    'SELECT subject, marks, grade, remarks FROM semester_results WHERE studentId = ? AND semester = ?',
    [studentId, semester],
    (err, rows) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch results' });
      } else {
        res.json(rows);
      }
    }
  );
});


// POST: Add semester
app.post('/api/add-semester', (req, res) => {
  const { semester, duration } = req.body;
  db.run(
    'INSERT OR IGNORE INTO semesters (semester, duration) VALUES (?, ?)',
    [semester, duration],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to add semester');
      } else {
        res.status(200).send('Semester added');
      }
    }
  );
});

// GET: Fetch semesters
app.get('/api/semesters', (req, res) => {
  db.all('SELECT semester, duration FROM semesters', [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch semesters' });
    } else {
      res.json(rows);
    }
  });
});

// GET: Fetch results by student and semester
app.get('/api/results-by-semester', (req, res) => {
  const { studentId, semester } = req.query;
  db.all(
    'SELECT subject, marks, grade, remarks, dateAdded FROM semester_results WHERE studentId = ? AND semester = ?',
    [studentId, semester],
    (err, rows) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch results' });
      } else {
        res.json(rows);
      }
    }
  );
});

// POST: Save semester and results
app.post('/api/save-semester-and-results', (req, res) => {
  const { studentId, semester, duration, results } = req.body;
  const dateAdded = new Date().toISOString();

  db.run(
    'INSERT OR IGNORE INTO semesters (semester, duration) VALUES (?, ?)',
    [semester, duration],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Failed to save semester');
      }

      const stmt = db.prepare(`
        INSERT INTO semester_results (studentId, semester, duration, subject, marks, remarks, grade, dateAdded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(studentId, semester, subject)
        DO UPDATE SET marks = excluded.marks, remarks = excluded.remarks, grade = excluded.grade, dateAdded = excluded.dateAdded
      `);

      results.forEach(r => {
        stmt.run([
          studentId,
          semester,
          duration,
          r.subject,
          r.marks,
          r.remarks,
          r.grade,
          dateAdded
        ]);
      });

      stmt.finalize(err => {
        if (err) {
          console.error(err);
          res.status(500).send('Failed to save results');
        } else {
          res.status(200).send('Semester and results saved');
        }
      });
    }
  );
});

app.post('/create-staff', (req, res) => {
  const { username, password, fullName, department, pin } = req.body;

  // ✅ Server-side PIN check
  if (pin !== '41232025') {
    return res.status(403).send('Invalid PIN');
  }

  db.run(
    `INSERT INTO staff (username, password, fullName, department)
     VALUES (?, ?, ?, ?)`,
    [username, password, fullName, department],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to create staff account');
      } else {
        res.status(200).send('Staff account created');
      }
    }
  );
});


app.post('/staff-login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM staff WHERE username = ? AND password = ?',
    [username, password],
    (err, row) => {
      if (err) {
        console.error(err);
        res.status(500).send('Login error');
      } else if (row) {
        res.status(200).send('Login successful');
      } else {
        res.status(401).send('Invalid credentials');
      }
    }
  );
});

app.get('/api/applications', (req, res) => {
  db.all('SELECT * FROM applications ORDER BY submittedAt DESC', [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch applications' });
    } else {
      res.json(rows);
    }
  });
});
app.get('/get-applications', (req, res) => {
  const { course, status } = req.query;
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];

  if (course) {
    query += ' AND course = ?';
    params.push(course);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send([]);
    } else {
      res.json(rows);
    }
  });
});


app.get('/get-applications', (req, res) => {
  const { program, date } = req.query;
  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];

  if (program) {
    query += ' AND program = ?';
    params.push(program);
  }

  if (date) {
    query += ' AND submittedAt >= ?';
    params.push(date);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).send([]);
    res.json(rows);
  });
});
app.get('/approved-count', (req, res) => {
  db.get('SELECT COUNT(*) AS count FROM approved_applications', [], (err, row) => {
    if (err) return res.status(500).json({ count: 0 });
    res.json({ count: row.count });
  });
});

app.get('/application/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM applications WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).send('Not found');
    res.json(row);
  });
});


app.post('/update-application-status', (req, res) => {
  const { id, status } = req.body;

  db.get(`SELECT * FROM applications WHERE id = ?`, [id], (err, app) => {
    if (err || !app) return res.status(404).send('Application not found');

    if (status === 'Approved') {
      db.run(
        `INSERT INTO approved_applications (firstName, surname, age, dob, email, program, certificatePath)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [app.firstName, app.surname, app.age, app.dob, app.email, app.program, app.certificatePath],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).send('Failed to approve');
          }

          db.run(`DELETE FROM applications WHERE id = ?`, [id], function (err) {
            if (err) {
              console.error(err);
              return res.status(500).send('Failed to remove original');
            }

            res.status(200).send('Application approved and moved');
          });
        }
      );
    } else if (status === 'Rejected') {
      db.run(`DELETE FROM applications WHERE id = ?`, [id], function (err) {
        if (err) {
          console.error(err);
          return res.status(500).send('Failed to reject');
        }

        res.status(200).send('Application rejected and removed');
      });
    } else {
      res.status(400).send('Invalid status');
    }
  });
});

app.get('/approved-applications', (req, res) => {
  db.all(`SELECT * FROM approved_applications ORDER BY approvedAt DESC`, [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send([]);
    }
    res.json(rows);
  });
});





app.get('/approved.html', requireLogin, requireRole('staff'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'approved.html'));
});

app.get('/studentresult.html', requireLogin, requireRole('staff'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'studentresult.html'));
});
app.get('/check-session', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Session expired');
  }
  res.status(200).send('Session active');
});

// 🔐 Middleware to check if user is logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  next();
}

// 🔐 Middleware to check user role
function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

app.get('/admin-dashboard', requireLogin, requireRole('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/portal', requireLogin, requireRole('staff'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/my-posts', requireLogin, requireRole('staff'), (req, res) => {
  const author = req.session.username;
  db.all(`SELECT * FROM news WHERE author = ? ORDER BY postedAt DESC`, [author], (err, rows) => {
    if (err) return res.status(500).send([]);
    res.json(rows);
  });
});

app.post('/edit-news', requireLogin, requireRole('staff'), (req, res) => {
  const { id, title, content } = req.body;
  const author = req.session.username;

  db.run(
    `UPDATE news SET title = ?, content = ? WHERE id = ? AND author = ?`,
    [title, content, id, author],
    function (err) {
      if (err) return res.status(500).send('Failed to update');
      res.send('Post updated');
    }
  );
});
app.post('/delete-news', requireLogin, requireRole('staff'), (req, res) => {
  const { id } = req.body;
  const author = req.session.username;

  db.run(`DELETE FROM news WHERE id = ? AND author = ?`, [id, author], function (err) {
    if (err) return res.status(500).send('Failed to delete');
    res.send('Post deleted');
  });
});

app.post('/create-news', requireLogin, requireRole('staff'), upload.single('media'), (req, res) => {
  const { title, content, id } = req.body;
  const author = req.session.username; // ✅ Must be set from login
  const mediaPath = req.file ? `/uploads/certificates/${req.file.filename}` : null;

  if (!author) {
    return res.status(400).send('Missing author');
  }

  if (id) {
    db.run(
      `UPDATE news SET title = ?, content = ?, media = ? WHERE id = ? AND author = ?`,
      [title, content, mediaPath || null, id, author],
      function (err) {
        if (err) return res.status(500).send('Failed to update post');
        res.status(200).send('Post updated');
      }
    );
  } else {
    db.run(
      `INSERT INTO news (title, content, author, postedAt, media) VALUES (?, ?, ?, datetime('now'), ?)`,
      [title, content, author, mediaPath],
      function (err) {
        if (err) return res.status(500).send('Failed to create post');
        res.status(200).send('Post created');
      }
    );
  }
});


app.get('/get-news', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 7;
  const offset = (page - 1) * limit;

  db.all(`SELECT * FROM news ORDER BY postedAt DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
    if (err) return res.status(500).send([]);
    db.get(`SELECT COUNT(*) AS total FROM news`, [], (err, countRow) => {
      if (err) return res.status(500).send([]);
      res.json({ news: rows, total: countRow.total });
    });
  });
});


app.get('/my-posts', requireLogin, requireRole('staff'), (req, res) => {
  const author = req.session.username;
  db.all(`SELECT * FROM news WHERE author = ? ORDER BY postedAt DESC`, [author], (err, rows) => {
    if (err) return res.status(500).send([]);
    res.json(rows);
  });
});

app.post('/edit-news', requireLogin, requireRole('staff'), (req, res) => {
  const { id, title, content } = req.body;
  const author = req.session.username;

  db.run(
    `UPDATE news SET title = ?, content = ? WHERE id = ? AND author = ?`,
    [title, content, id, author],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Failed to update post');
      }
      res.send('Post updated');
    }
  );
});
app.post('/delete-news', requireLogin, requireRole('staff'), (req, res) => {
  const { id } = req.body;
  const author = req.session.username;

  db.run(`DELETE FROM news WHERE id = ? AND author = ?`, [id, author], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to delete post');
    }
    res.send('Post deleted');
  });
});





// ✅ Submit alumni story
app.post('/submit-alumni-story', upload.single('photo'), (req, res) => {
  const { name, email, course, year, job, story } = req.body;
  const photo = req.file ? `/uploads/certificates/${req.file.filename}` : null;

  db.run(
    `INSERT INTO alumni_stories (name, email, course, year, job, story, photo, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
    [name, email, course, year, job, story, photo],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send('Failed to submit story');
      } else {
        res.redirect('/index.html');
      }
    }
  );
});

// ✅ Get approved alumni stories
app.get('/get-published-alumni', (req, res) => {
  db.all(`SELECT * FROM alumni_stories WHERE status = 'Approved'`, [], (err, rows) => {
    if (err) return res.status(500).send([]);
    res.json(rows);
  });
});

// ✅ Get pending alumni stories (staff only)
app.get('/get-pending-alumni', requireLogin, requireRole('staff'), (req, res) => {
  db.all(`SELECT * FROM alumni_stories WHERE status = 'Pending'`, [], (err, rows) => {
    if (err) return res.status(500).send([]);
    res.json(rows);
  });
});

// ✅ Approve story
app.post('/approve-alumni-story', requireLogin, requireRole('staff'), (req, res) => {
  const id = parseInt(req.body.id);
  db.run(`UPDATE alumni_stories SET status = 'Approved' WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).send('Failed to approve');
    res.redirect('/alumnipublish.html');
  });
});

// ✅ Decline story
app.post('/decline-alumni-story', requireLogin, requireRole('staff'), (req, res) => {
  const id = parseInt(req.body.id);
  db.run(`DELETE FROM alumni_stories WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).send('Failed to decline');
    res.redirect('/alumnipublish.html');
  });
});

// ✅ Serve staff review page
app.get('/alumnipublish.html', requireLogin, requireRole('staff'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/certificates', 'alumnipublish.html'));
});

app.get('/get-published-alumni-count', (req, res) => {
  const filters = [];
  const params = [];

  if (req.query.course) {
    filters.push("course = ?");
    params.push(req.query.course);
  }

  if (req.query.year) {
    filters.push("year = ?");
    params.push(req.query.year);
  }

  filters.push("status = 'Approved'");
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  db.get(`SELECT COUNT(*) as count FROM alumni_stories ${whereClause}`, params, (err, row) => {
    if (err) return res.status(500).send({ count: 0 });
    res.json({ count: row.count });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});




