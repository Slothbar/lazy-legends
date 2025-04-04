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

    // New seasons table to track season start timestamps
    db.run(`
        CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startTimestamp INTEGER NOT NULL
        )
    `);

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
