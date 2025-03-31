const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/lazy-legends.db'); // Save to a file on Render's disk

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            xUsername TEXT UNIQUE,
            hederaWallet TEXT,
            sloMoPoints INTEGER DEFAULT 0
        )
    `);
});

module.exports = db;
