const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const speakeasy = require('speakeasy'); 
const qrcode = require('qrcode');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use('/images', express.static(path.join(__dirname, 'images')));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Add JSON body parser
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new LocalStrategy((username, password, done) => {
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Incorrect username or password.' });
        return done(null, user);
    });
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => {
        done(err, user);
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/'
}));

app.post('/register', upload.single('profile-picture'), (req, res) => {
    const { username, password, age, gender, interests } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;
    const stmt = db.prepare("INSERT INTO users (username, password, age, gender, interests, profile_picture) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(username, password, age, gender, interests, profilePicture, (err) => {
        if (err) {
            return res.redirect('/');
        }
        res.redirect('/');
    });
    stmt.finalize();
});

app.post('/profile', upload.single('profile-picture'), (req, res) => {
    const { username, password, age, gender, interests } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;
    let query = "UPDATE users SET password = ?, age = ?, gender = ?, interests = ?";
    const params = [password, age, gender, interests];
    if (profilePicture) {
        query += ", profile_picture = ?";
        params.push(profilePicture);
    }
    query += " WHERE username = ?";
    params.push(username);
    const stmt = db.prepare(query);
    stmt.run(params, (err) => {
        if (err) {
            return res.sendStatus(500);
        }
        res.sendStatus(200);
    });
    stmt.finalize();
});

app.post('/match', (req, res) => {
    const { username, matchType } = req.body;
    db.get("SELECT interests FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.sendStatus(500);
        if (!user) return res.sendStatus(404);

        const query = `
            SELECT username FROM users
            WHERE interests LIKE ?
            AND username != ?
        `;
        const params = [`%${matchType}%`, user.username];
        db.all(query, params, (err, matches) => {
            if (err) return res.sendStatus(500);
            res.json(matches);
        });
    });
});

app.post('/send-friend-request', (req, res) => {
    const { from, to } = req.body;
    const stmt = db.prepare("INSERT INTO friend_requests (from_user, to_user) VALUES (?, ?)");
    stmt.run(from, to, (err) => {
        if (err) {
            return res.sendStatus(500);
        }
        res.sendStatus(200);
    });
    stmt.finalize();
});

app.get('/search-users', (req, res) => {
    const query = req.query.query;
    const stmt = db.prepare("SELECT username FROM users WHERE username LIKE ?");
    stmt.all(`%${query}%`, (err, users) => {
        if (err) {
            return res.sendStatus(500);
        }
        res.json(users);
    });
});

// Socket.io connection
const users = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('new user', (username) => {
        users[socket.id] = username;
        io.emit('user list', Object.values(users)); // Broadcast updated user list to all clients
    });

    socket.on('chat message', (msg) => {
        const stmt = db.prepare("INSERT INTO messages (username, message) VALUES (?, ?)");
        stmt.run(msg.username, msg.text);
        stmt.finalize();

        io.emit('chat message', {
            username: msg.username,
            text: msg.text,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('private message', (data) => {
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('private message', {
                from: data.from,
                text: data.text
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        delete users[socket.id];
        io.emit('user list', Object.values(users)); // Broadcast updated user list to all clients
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
app.post('/update-location', (req, res) => {
  const userId = req.user.id;  // Assuming user is authenticated
  const { latitude, longitude } = req.body;

  const query = `UPDATE users SET latitude = ?, longitude = ? WHERE id = ?`;
  db.run(query, [latitude, longitude, userId], (err) => {
    if (err) {
      return res.status(500).send('Error updating location');
    }
    res.status(200).send('Location updated');
  });
});
const getNearbyUsers = (latitude, longitude, radius, callback) => {
  const query = `
    SELECT *, (
      6371 * acos(
        cos(radians(?)) *
        cos(radians(latitude)) *
        cos(radians(longitude) - radians(?)) +
        sin(radians(?)) *
        sin(radians(latitude))
      )
    ) AS distance
    FROM users
    HAVING distance < ?
    ORDER BY distance
  `;

  db.all(query, [latitude, longitude, latitude, radius], (err, rows) => {
    if (err) {
      return callback(err);
    }
    callback(null, rows);
  });
};

// Example usage in a route
app.get('/nearby-matches', (req, res) => {
  const { latitude, longitude } = req.user;  // Assuming user is authenticated
  const radius = 50;  // 50 km radius

  getNearbyUsers(latitude, longitude, radius, (err, matches) => {
    if (err) {
      return res.status(500).send('Error fetching matches');
    }
    res.status(200).json(matches);
  });
});
// Assuming you have a users table with a 'category' column

app.get('/category/:category', (req, res) => {
  const category = req.params.category;

  const query = `SELECT * FROM users WHERE category = ?`;
  db.all(query, [category], (err, rows) => {
    if (err) {
      return res.status(500).send('Error fetching users in category');
    }
    res.status(200).json(rows);
  });
});
// Fetch All Messages
app.get('/messages', (req, res) => {
    const userId = req.user.id;  // Assuming user is authenticated

    const query = `SELECT * FROM messages WHERE recipient_id = ? ORDER BY timestamp DESC`;
    db.all(query, [userId], (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching messages');
        }
        res.status(200).json(rows);
    });
});

// Fetch Unread Messages
app.get('/unread-messages', (req, res) => {
    const userId = req.user.id;  // Assuming user is authenticated

    const query = `SELECT * FROM messages WHERE recipient_id = ? AND is_read = 0 ORDER BY timestamp DESC`;
    db.all(query, [userId], (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching unread messages');
        }
        res.status(200).json(rows);
    });
});

// Mark messages as read (This can be called when a user views a message)
app.post('/mark-as-read', (req, res) => {
    const messageId = req.body.messageId;

    const query = `UPDATE messages SET is_read = 1 WHERE id = ?`;
    db.run(query, [messageId], (err) => {
        if (err) {
            return res.status(500).send('Error marking message as read');
        }
        res.status(200).send('Message marked as read');
    });
});
// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to handle registration
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    // Add your registration logic here
    res.json({ success: true, message: 'Registration successful' });
});

// Route to handle login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Add your login logic here
    res.json({ success: true, message: 'Login successful' });
});

// Hash password before saving to the database
app.post('/register', upload.single('profile-picture'), async (req, res) => {
    const { username, password, age, gender, interests } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, password, age, gender, interests, profile_picture) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(username, hashedPassword, age, gender, interests, profilePicture, (err) => {
        if (err) {
            return res.status(500).send('Registration failed');
        }
        res.redirect('/');
    });
    stmt.finalize();
});

// Verify password during login
passport.use(new LocalStrategy(async (username, password, done) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Incorrect username or password.' });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            return done(null, user);
        } else {
            return done(null, false, { message: 'Incorrect username or password.' });
        }
    });
}));
app.post('/privacy', (req, res) => {
    const { username, profileVisibility, messagePrivacy, onlineStatus } = req.body;
    const stmt = db.prepare("UPDATE users SET profile_visibility = ?, message_privacy = ?, online_status = ? WHERE username = ?");
    stmt.run(profileVisibility, messagePrivacy, onlineStatus, username, (err) => {
        if (err) {
            return res.status(500).send('Error updating privacy settings');
        }
        res.send('Privacy settings updated');
    });
    stmt.finalize();
});
function calculateMatchScore(user1, user2) {
    let score = 0;

    // Match interests
    const interests1 = user1.interests.split(',');
    const interests2 = user2.interests.split(',');
    const commonInterests = interests1.filter(interest => interests2.includes(interest));
    score += commonInterests.length * 10; // Add 10 points per common interest

    // Match age range
    const ageDiff = Math.abs(user1.age - user2.age);
    if (ageDiff <= 5) {
        score += 20; // Add 20 points if age difference is within 5 years
    } else if (ageDiff <= 10) {
        score += 10; // Add 10 points if age difference is within 10 years
    }

    // Match gender preference
    if (user1.gender === user2.preferences && user2.gender === user1.preferences) {
        score += 30; // Add 30 points if gender preferences match
    }

    // Match location (assuming a simple proximity check)
    if (user1.location === user2.location) {
        score += 40; // Add 40 points if locations are the same
    }

    return score;
}

app.post('/match', (req, res) => {
    const { username } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.sendStatus(500);
        if (!user) return res.sendStatus(404);

        db.all("SELECT * FROM users WHERE username != ?", [username], (err, allUsers) => {
            if (err) return res.sendStatus(500);

            const matches = allUsers.map(otherUser => ({
                username: otherUser.username,
                score: calculateMatchScore(user, otherUser)
            }));

            matches.sort((a, b) => b.score - a.score);
            res.json(matches);
        });
    });
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

function sendEmailNotification(to, subject, text) {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: to,
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

// Example usage: send a notification when a new message is received
io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
        // Save the message to the database...
        
        // Notify the recipient
        db.get("SELECT email FROM users WHERE username = ?", [msg.recipient], (err, user) => {
            if (user) {
                sendEmailNotification(user.email, 'New Message', `You have received a new message from ${msg.sender}`);
            }
        });

        io.emit('chat message', msg);
    });
});
app.post('/feedback', (req, res) => {
    const { feedback } = req.body;
    const stmt = db.prepare("INSERT INTO feedback (content) VALUES (?)");
    stmt.run(feedback, (err) => {
        if (err) {
            return res.status(500).send('Error submitting feedback');
        }
        res.send('Feedback submitted');
    });
    stmt.finalize();
});

app.post('/report', (req, res) => {
    const { reportUsername, reportReason } = req.body;
    const stmt = db.prepare("INSERT INTO reports (username, reason) VALUES (?, ?)");
    stmt.run(reportUsername, reportReason, (err) => {
        if (err) {
            return res.status(500).send('Error submitting report');
        }
        res.send('Report submitted');
    });
    stmt.finalize();
});
