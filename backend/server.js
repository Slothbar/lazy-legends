const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors({
    origin: 'https://www.lazylegends.xyz',
    credentials: true
}));
app.use(express.json());

// Configure session middleware with SQLite store
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '/app/data',
        concurrentDB: true
    }),
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));

app.use((err, req, res, next) => {
    if (err) {
        console.error('Session middleware error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } else {
        next();
    }
});

app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../Uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.session.xUsername}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (jpeg, jpg, png, gif) are allowed!'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Google Sheets authentication
const auth = new google.auth.GoogleAuth({
    keyFile: './lazy-legends-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;

const lastChecked = {};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
console.log('ADMIN_PASSWORD loaded:', ADMIN_PASSWORD);

// Migrate existing users to add default password
db.serialize(() => {
    db.run(`
        ALTER TABLE users ADD COLUMN password TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding password column:', err);
        }
    });

    db.run(`
        ALTER TABLE users ADD COLUMN profilePhoto TEXT
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding profilePhoto column:', err);
        }
    });

    bcrypt.hash('defaultpassword123', 10, (err, hash) => {
        if (err) {
            console.error('Error hashing default password:', err);
            return;
        }
        db.run(`
            UPDATE users SET password = ? WHERE password IS NULL
        `, [hash], (err) => {
            if (err) {
                console.error('Error updating existing users with default password:', err);
            } else {
                console.log('Migrated existing users with default password');
            }
        });
    });
});

async function appendToGoogleSheet(xUsername, hederaWallet) {
    const values = [[xUsername, hederaWallet]];
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:B',
            valueInputOption: 'RAW',
            resource: { values },
        });
        console.log(`Appended ${xUsername} to Google Sheet`);
    } catch (error) {
        console.error('Error appending to Google Sheet:', error);
    }
}

// Sign-up endpoint
app.post('/api/signup', async (req, res) => {
    const { xUsername, password, hederaWallet } = req.body;

    const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
    if (!xUsername || !xUsernameRegex.test(xUsername)) {
        return res.status(400).json({ error: 'Invalid X username. It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).' });
    }

    if (!password || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    let walletAddress = hederaWallet || 'N/A';
    if (hederaWallet) {
        const walletRegex = /^0\.0\.\d+$/;
        if (!walletRegex.test(hederaWallet)) {
            return res.status(400).json({ error: 'Invalid Hedera wallet address. It must start with 0.0. followed by numbers (e.g., 0.0.12345).' });
        }
        walletAddress = hederaWallet;
    }

    const normalizedXUsername = xUsername.toLowerCase();

    db.get(`SELECT xUsername FROM users WHERE xUsername = ?`, [normalizedXUsername], async (err, row) => {
        if (err) {
            console.error('Error checking username:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (row) {
            return res.status(400).json({ error: 'Username already taken.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const bonusPoints = walletAddress !== 'N/A' ? 5 : 0;

            db.run(
                `INSERT INTO users (xUsername, password, hederaWallet, sloMoPoints) VALUES (?, ?, ?, ?)`,
                [normalizedXUsername, hashedPassword, walletAddress, bonusPoints],
                async (err) => {
                    if (err) {
                        console.error('Error inserting user:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    await appendToGoogleSheet(normalizedXUsername, walletAddress);
                    req.session.xUsername = normalizedXUsername;
                    console.log(`Session set for user: ${normalizedXUsername}`);
                    res.status(200).json({ message: 'Sign-up successful' });
                }
            );
        } catch (error) {
            console.error('Error hashing password:', error);
            res.status(500).json({ error: 'Error hashing password' });
        }
    });
});

// Sign-in endpoint
app.post('/api/signin', (req, res) => {
    const { xUsername, password } = req.body;

    const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
    if (!xUsername || !xUsernameRegex.test(xUsername)) {
        return res.status(400).json({ error: 'Invalid X username. It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).' });
    }

    if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
    }

    const normalizedXUsername = xUsername.toLowerCase();

    db.get(`SELECT * FROM users WHERE xUsername = ?`, [normalizedXUsername], async (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.xUsername = normalizedXUsername;
                console.log(`Session set for user: ${normalizedXUsername}`);
                res.status(200).json({ message: 'Sign-in successful' });
            } else {
                res.status(401).json({ error: 'Invalid username or password.' });
            }
        } catch (error) {
            console.error('Error comparing passwords:', error);
            res.status(500).json({ error: 'Error verifying password' });
        }
    });
});

// Sign-out endpoint
app.post('/api/signout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Error signing out' });
        }
        res.status(200).json({ message: 'Signed out successfully' });
    });
});

// Delete account endpoint
app.post('/api/delete-account', (req, res) => {
    if (!req.session.xUsername) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const username = req.session.xUsername;

    db.get(
        `SELECT profilePhoto FROM users WHERE xUsername = ?`,
        [username],
        (err, row) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            // Delete profile photo if exists
            if (row && row.profilePhoto) {
                const photoPath = path.join(__dirname, '../', row.profilePhoto);
                fs.unlink(photoPath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error(`Error deleting profile photo for ${username}:`, err);
                    }
                });
            }

            // Delete user from users table (cascades to season_rewards and point_activity)
            db.run(
                `DELETE FROM users WHERE xUsername = ?`,
                [username],
                (err) => {
                    if (err) {
                        console.error('Error deleting user:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    req.session.destroy((err) => {
                        if (err) {
                            console.error('Error destroying session:', err);
                            return res.status(500).json({ error: 'Error signing out after deletion' });
                        }
                        console.log(`Deleted user ${username} from the system`);
                        db.run(
                            `INSERT INTO audit_log (action, xUsername, timestamp) VALUES (?, ?, ?)`,
                            ['delete_account', username, new Date().toISOString()],
                            (err) => {
                                if (err) {
                                    console.error('Error logging deletion:', err);
                                }
                                res.status(200).json({ message: 'Account deleted successfully' });
                            }
                        );
                    });
                }
            );
        }
    );
});

// Get user profile data
app.get('/api/profile/:username', (req, res) => {
    const { username } = req.params;
    const normalizedUsername = username.toLowerCase();

    if (!req.session.xUsername) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    if (req.session.xUsername !== normalizedUsername) {
        return res.status(403).json({ error: 'Unauthorized to view this profile' });
    }

    db.get(
        `SELECT xUsername, hederaWallet, sloMoPoints, profilePhoto FROM users WHERE xUsername = ?`,
        [normalizedUsername],
        (err, user) => {
            if (err) {
                console.error('Error fetching user profile:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        }
    );
});

// Profile photo upload endpoint
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
    if (!req.session.xUsername) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    db.run(
        `UPDATE users SET profilePhoto = ? WHERE xUsername = ?`,
        [photoUrl, req.session.xUsername],
        (err) => {
            if (err) {
                console.error('Error updating profile photo:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ photoUrl });
        }
    );
});

// Profile page route
app.get('/profile/:username', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/whoami', (req, res) => {
    console.log('Session data:', req.session);
    if (req.session.xUsername) {
        db.get(
            `SELECT xUsername, hederaWallet, sloMoPoints, profilePhoto FROM users WHERE xUsername = ?`,
            [req.session.xUsername],
            (err, user) => {
                if (err) {
                    console.error('Error fetching user data:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.json(user);
            }
        );
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.get('/api/leaderboard', (req, res) => {
    db.all(
        `SELECT xUsername, sloMoPoints, profilePhoto FROM users ORDER BY sloMoPoints DESC LIMIT 10`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows);
        }
    );
});

app.get('/api/bonus-day', (req, res) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isBonusDay = dayOfWeek === 0;
    const multiplier = isBonusDay ? 2 : 1;
    res.json({ isBonusDay, multiplier });
});

app.get('/api/season-winners', (req, res) => {
    db.get(
        `SELECT id FROM seasons ORDER BY id DESC LIMIT 1`,
        [],
        (err, currentSeason) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!currentSeason) return res.status(404).json({ error: 'No seasons found' });

            const currentSeasonId = currentSeason.id;

            db.get(
                `SELECT id FROM seasons WHERE id < ? ORDER BY id DESC LIMIT 1`,
                [currentSeasonId],
                (err, previousSeason) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    if (!previousSeason) return res.status(404).json({ error: 'No previous season found' });

                    const previousSeasonId = previousSeason.id;

                    db.all(
                        `SELECT xUsername, rank, rewardAmount, claimed FROM season_rewards WHERE seasonId = ?`,
                        [previousSeasonId],
                        (err, winners) => {
                            if (err) return res.status(500).json({ error: 'Database error' });

                            // Calculate sloMoPoints from rewardAmount (rewardAmount = sloMoPoints * 500)
                            const updatedWinners = winners.map(winner => ({
                                xUsername: winner.xUsername,
                                rank: winner.rank,
                                sloMoPoints: winner.rewardAmount / 500, // Reverse calculation
                                claimed: winner.claimed
                            }));

                            res.json({ seasonId: previousSeasonId, winners: updatedWinners });
                        }
                    );
                }
            );
        }
    );
});

app.get('/api/recent-activity', (req, res) => {
    db.all(
        `SELECT xUsername, points, timestamp FROM point_activity ORDER BY timestamp DESC LIMIT 5`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching recent activity:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

app.post('/api/admin/verify-password', (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    res.status(200).json({ message: 'Password verified' });
});

app.get('/api/admin/users', (req, res) => {
    db.all(
        `SELECT xUsername, hederaWallet, sloMoPoints FROM users`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows);
        }
    );
});

app.get('/api/admin/announcement', (req, res) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isBonusDay = dayOfWeek === 0;

    db.get(
        `SELECT text FROM announcements WHERE id = 1`,
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!row) return res.status(404).json({ error: 'Announcement not found' });

            let announcementText = row.text;
            if (isBonusDay) {
                announcementText += ' 🦥 It’s Sloth Bonus Day! 2x SloMo Points today!';
            }

            res.json({ text: announcementText });
        }
    );
});

app.post('/api/admin/update-announcement', (req, res) => {
    const { adminPassword, text } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Announcement text cannot be empty' });
    }

    db.run(
        `INSERT OR REPLACE INTO announcements (id, text) VALUES (1, ?)`,
        [text.trim()],
        (err) => {
            if (err) {
                console.error('Error updating announcement:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            console.log('Updated announcement:', text);
            res.status(200).json({ message: 'Announcement updated successfully' });
        }
    );
});

app.get('/api/admin/season-dates', (req, res) => {
    db.get(
        `SELECT startDate, endDate FROM season_dates WHERE id = 1`,
        [],
        (err, row) => {
            if (err) {
                console.error('Error fetching season dates:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Season dates not found' });
            }
            res.json({ startDate: row.startDate, endDate: row.endDate });
        }
    );
});

app.post('/api/admin/update-season-dates', (req, res) => {
    const { adminPassword, startDate, endDate } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
    }
    if (start >= end) {
        return res.status(400).json({ error: 'End date must be after start date' });
    }

    db.run(
        `INSERT OR REPLACE INTO season_dates (id, startDate, endDate) VALUES (1, ?, ?)`,
        [startDate, endDate],
        (err) => {
            if (err) {
                console.error('Error updating season dates:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            console.log(`Updated season dates: start=${startDate}, end=${endDate}`);
            res.status(200).json({ message: 'Season dates updated successfully' });
        }
    );
});

app.post('/api/admin/delete-user', (req, res) => {
    const { xUsername, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    if (!xUsername) {
        return res.status(400).json({ error: 'X username is required' });
    }

    // Begin transaction
    db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Database error: Failed to start transaction' });
        }

        db.get(
            `SELECT xUsername, profilePhoto FROM users WHERE xUsername = ?`,
            [xUsername],
            (err, row) => {
                if (err) {
                    console.error('Error checking user:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: `Database error: ${err.message}` });
                }
                if (!row) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: `User ${xUsername} not found` });
                }

                // Delete profile photo if exists
                if (row.profilePhoto) {
                    const photoPath = path.join(__dirname, '../', row.profilePhoto);
                    try {
                        fs.unlinkSync(photoPath);
                    } catch (err) {
                        if (err.code !== 'ENOENT') {
                            console.error(`Error deleting profile photo for ${xUsername}:`, err);
                        }
                    }
                }

                // Manually delete from season_rewards
                db.run(
                    `DELETE FROM season_rewards WHERE xUsername = ?`,
                    [xUsername],
                    (err) => {
                        if (err) {
                            console.error('Error deleting from season_rewards:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: `Database error: ${err.message}` });
                        }

                        // Manually delete from point_activity
                        db.run(
                            `DELETE FROM point_activity WHERE xUsername = ?`,
                            [xUsername],
                            (err) => {
                                if (err) {
                                    console.error('Error deleting from point_activity:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: `Database error: ${err.message}` });
                                }

                                // Delete from users table
                                db.run(
                                    `DELETE FROM users WHERE xUsername = ?`,
                                    [xUsername],
                                    (err) => {
                                        if (err) {
                                            console.error('Error deleting user:', err);
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: `Database error: ${err.message}` });
                                        }

                                        // Log deletion in audit_log
                                        db.run(
                                            `INSERT INTO audit_log (action, xUsername, timestamp) VALUES (?, ?, ?)`,
                                            ['admin_delete_user', xUsername, new Date().toISOString()],
                                            (err) => {
                                                if (err) {
                                                    console.error('Error logging deletion:', err);
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: `Database error: ${err.message}` });
                                                }

                                                // Commit transaction
                                                db.run('COMMIT', (err) => {
                                                    if (err) {
                                                        console.error('Error committing transaction:', err);
                                                        db.run('ROLLBACK');
                                                        return res.status(500).json({ error: `Database error: ${err.message}` });
                                                    }
                                                    console.log(`Deleted user ${xUsername} by admin`);
                                                    res.status(200).json({ message: `Successfully deleted user ${xUsername}` });
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
});

app.post('/api/admin/clear-leaderboard', (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    db.all(`SELECT xUsername FROM users`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users before clearing:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log('Users before clearing:', rows);

        db.run(
            `DELETE FROM users WHERE xUsername IS NULL`,
            (err) => {
                if (err) {
                    console.error('Error clearing invalid users from leaderboard:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                console.log('Cleared invalid users from the leaderboard');

                db.all(`SELECT xUsername FROM users`, [], (err, remainingRows) => {
                    if (err) {
                        console.error('Error fetching users after clearing:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    console.log('Users after clearing:', remainingRows);
                    db.run(
                        `INSERT INTO audit_log (action, xUsername, timestamp) VALUES (?, ?, ?)`,
                        ['clear_invalid_users', 'admin', new Date().toISOString()],
                        (err) => {
                            if (err) {
                                console.error('Error logging clear leaderboard:', err);
                            }
                            res.status(200).json({ message: 'Successfully cleared invalid users from the leaderboard' });
                        }
                    );
                });
            }
        );
    });
});

app.post('/api/admin/reset-leaderboard', (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    db.get(
        `SELECT id FROM seasons ORDER BY id DESC LIMIT 1`,
        [],
        (err, currentSeason) => {
            if (err) {
                console.error('Error fetching current season:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!currentSeason) {
                console.error('No seasons found');
                return res.status(404).json({ error: 'No seasons found' });
            }

            const currentSeasonId = currentSeason.id;

            db.all(
                `SELECT xUsername, sloMoPoints FROM users ORDER BY sloMoPoints DESC LIMIT 3`,
                [],
                (err, topPlayers) => {
                    if (err) {
                        console.error('Error fetching top players:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    console.log('Top players before season end:', topPlayers);

                    const rewards = [
                        { rank: 1, amount: topPlayers[0] ? topPlayers[0].sloMoPoints * 500 : 0 },
                        { rank: 2, amount: topPlayers[1] ? topPlayers[1].sloMoPoints * 500 : 0 },
                        { rank: 3, amount: topPlayers[2] ? topPlayers[2].sloMoPoints * 500 : 0 }
                    ];

                    const insertStmt = db.prepare(`
                        INSERT INTO season_rewards (seasonId, xUsername, rank, rewardAmount, claimed)
                        VALUES (?, ?, ?, ?, 0)
                    `);
                    topPlayers.forEach((player, index) => {
                        const reward = rewards[index];
                        if (reward && reward.amount > 0) {
                            insertStmt.run(currentSeasonId, player.xUsername, reward.rank, reward.amount);
                        }
                    });
                    insertStmt.finalize();

                    db.run(
                        `UPDATE users SET sloMoPoints = 0`,
                        (err) => {
                            if (err) {
                                console.error('Error resetting SloMo Points:', err);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            console.log('Reset all users\' SloMo Points to 0');

                            const newSeasonStart = Math.floor(Date.now() / 1000);
                            db.run(
                                `INSERT INTO seasons (startTimestamp) VALUES (?)`,
                                [newSeasonStart],
                                (err) => {
                                    if (err) {
                                        console.error('Error inserting new season:', err);
                                        return res.status(500).json({ error: 'Database error' });
                                    }
                                    console.log('Started new season with timestamp:', newSeasonStart);

                                    db.run(
                                        `DELETE FROM point_activity`,
                                        (err) => {
                                            if (err) {
                                                console.error('Error clearing point_activity:', err);
                                                return res.status(500).json({ error: 'Database error' });
                                            }
                                            Object.keys(lastChecked).forEach(key => delete lastChecked[key]);
                                            console.log('Cleared lastChecked timestamps and point_activity for new season');
                                            db.run(
                                                `INSERT INTO audit_log (action, xUsername, timestamp) VALUES (?, ?, ?)`,
                                                ['reset_leaderboard', 'admin', new Date().toISOString()],
                                                (err) => {
                                                    if (err) {
                                                        console.error('Error logging reset:', err);
                                                    }
                                                    res.status(200).json({ message: 'Successfully reset the leaderboard and started a new season' });
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

async function trackLazyLegendsPosts() {
    setInterval(async () => {
        console.log('Checking for #LazyLegends posts now...');

        db.get(
            `SELECT startTimestamp FROM seasons ORDER BY id DESC LIMIT 1`,
            [],
            async (err, row) => {
                if (err) {
                    console.error('Error fetching season start timestamp:', err);
                    return;
                }
                if (!row) {
                    console.log('No season found, skipping tweet tracking.');
                    return;
                }
                const seasonStartTimestamp = row.startTimestamp * 1000;

                const today = new Date();
                const dayOfWeek = today.getDay();
                const isBonusDay = dayOfWeek === 0;
                const multiplier = isBonusDay ? 2 : 1;
                console.log(`Today is ${isBonusDay ? '' : 'not '}a bonus day. Multiplier: ${multiplier}`);

                db.all(`SELECT xUsername FROM users WHERE xUsername IS NOT NULL`, [], async (err, rows) => {
                    if (err) return console.error(err);

                    if (!rows || rows.length === 0) {
                        console.log('No users to check for #LazyLegends posts.');
                        return;
                    }

                    console.log(`Found ${rows.length} users to check.`);

                    for (const row of rows) {
                        const lastTime = lastChecked[row.xUsername] || seasonStartTimestamp;
                        const now = Date.now();
                        if (now - lastTime < 1800000) {
                            console.log(`Skipping ${row.xUsername} - last checked at ${new Date(lastTime).toISOString()}`);
                            continue;
                        }

                        console.log(`Checking tweets for ${row.xUsername}...`);
                        try {
                            const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
                                headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
                                params: {
                                    query: `#LazyLegends from:${row.xUsername.replace('@', '')}`,
                                    max_results: 10,
                                    'tweet.fields': 'created_at'
                                }
                            });

                            const tweets = response.data.data || [];
                            const newTweets = tweets.filter(tweet => {
                                const tweetTime = new Date(tweet.created_at).getTime();
                                return tweetTime > lastTime && tweetTime >= seasonStartTimestamp;
                            });

                            const pointsToAdd = (newTweets.length * 2) * multiplier;
                            if (pointsToAdd > 0) {
                                db.run(
                                    `UPDATE users SET sloMoPoints = sloMoPoints + ? WHERE xUsername = ?`,
                                    [pointsToAdd, row.xUsername],
                                    (err) => {
                                        if (err) {
                                            console.error(`Error updating points for ${row.xUsername}:`, err);
                                            return;
                                        }
                                        console.log(`${row.xUsername} earned ${pointsToAdd} SloMo Points (multiplier: ${multiplier})`);
                                        db.run(
                                            `INSERT INTO point_activity (xUsername, points, timestamp) VALUES (?, ?, ?)`,
                                            [row.xUsername, pointsToAdd, new Date().toISOString()],
                                            (err) => {
                                                if (err) {
                                                    console.error(`Error logging activity for ${row.xUsername}:`, err);
                                                }
                                            }
                                        );
                                    }
                                );
                            } else {
                                console.log(`No new #LazyLegends tweets found for ${row.xUsername} since season start`);
                            }
                            lastChecked[row.xUsername] = now;
                        } catch (error) {
                            console.error(`Error fetching tweets for ${row.xUsername}:`, error.response?.data || error.message);
                            if (error.response?.status === 429) {
                                console.log('Hit 429 limit, waiting 5 minutes...');
                                await new Promise(resolve => setTimeout(resolve, 300000));
                            }
                        }
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                });
            }
        );
    }, 1800000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    trackLazyLegendsPosts();
});
