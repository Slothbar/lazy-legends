const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/app/data/lazy-legends.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            xUsername TEXT PRIMARY KEY,
            hederaWallet TEXT,
            sloMoPoints INTEGER DEFAULT 0
        )
    `);
});

module.exports = db;
