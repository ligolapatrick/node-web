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
const git = require('git');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
