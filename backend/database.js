const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:'); // Use in-memory DB for simplicity; replace with a file for persistence

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
