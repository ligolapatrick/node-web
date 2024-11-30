const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('chatroom.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, age INTEGER, gender TEXT, interests TEXT, profile_picture TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT, to_user TEXT)");
});

module.exports = db;

const dbUrl = process.env.DATABASE_URL;

ALTER TABLE users ADD COLUMN category TEXT;