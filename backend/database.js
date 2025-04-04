const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/lazy-legends.db');

db.serialize(() => {
    // Existing users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            xUsername TEXT PRIMARY KEY,
            hederaWallet TEXT,
            sloMoPoints INTEGER DEFAULT 0
        )
    `);

    // Existing seasons table
    db.run(`
        CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startTimestamp INTEGER NOT NULL
        )
    `);

    // Existing announcements table
    db.run(`
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            text TEXT NOT NULL
        )
    `);

    // New bonus_days table to store bonus day schedules
    db.run(`
        CREATE TABLE IF NOT EXISTS bonus_days (
            date TEXT PRIMARY KEY, -- Date in YYYY-MM-DD format
            multiplier INTEGER NOT NULL
        )
    `);

    // Insert a default announcement if none exists
    db.get(`SELECT COUNT(*) as count FROM announcements`, (err, row) => {
        if (err) {
            console.error('Error checking announcements table:', err);
            return;
        }
        if (row.count === 0) {
            db.run(`INSERT INTO announcements (id, text) VALUES (1, 'Welcome to Season 1 of Lazy Legends! Post #LazyLegends to earn SloMo Points! 🦥')`, (err) => {
                if (err) {
                    console.error('Error inserting default announcement:', err);
                } else {
                    console.log('Initialized default announcement');
                }
            });
        }
    });

    // Insert a default season if none exists (for initial setup)
    db.get(`SELECT COUNT(*) as count FROM seasons`, (err, row) => {
        if (err) {
            console.error('Error checking seasons table:', err);
            return;
        }
        if (row.count === 0) {
            const initialTimestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
            db.run(`INSERT INTO seasons (startTimestamp) VALUES (?)`, [initialTimestamp], (err) => {
                if (err) {
                    console.error('Error inserting initial season:', err);
                } else {
                    console.log('Initialized first season with timestamp:', initialTimestamp);
                }
            });
        }
    });
});

module.exports = db;
