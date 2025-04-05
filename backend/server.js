const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

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

async function appendToGoogleSheet(xUsername, hederaWallet) {
    const timestamp = new Date().toISOString();
    const maskedWallet = hederaWallet !== 'N/A' ? hederaWallet.slice(0, 6) + '***' : 'N/A';
    console.log(`Logging to Google Sheet - xUsername: ${xUsername}, maskedWallet: ${maskedWallet}, timestamp: ${timestamp}`);
    const values = [[xUsername, maskedWallet, timestamp]];
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:C',
            valueInputOption: 'RAW',
            resource: { values },
        });
        console.log(`Appended ${xUsername} to Google Sheet`);
    } catch (error) {
        console.error('Error appending to Google Sheet:', error);
    }
}

app.post('/api/profile', (req, res) => {
    const { xUsername, hederaWallet } = req.body;

    // Validate X username
    const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
    if (!xUsername || !xUsernameRegex.test(xUsername)) {
        return res.status(400).json({ error: 'Invalid X username. It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).' });
    }

    // Normalize xUsername to lowercase for consistency
    const normalizedXUsername = xUsername.toLowerCase();

    // Add 5 bonus SloMo Points if wallet address is provided
    const bonusPoints = hederaWallet !== 'N/A' ? 5 : 0;

    db.run(
        `INSERT INTO users (xUsername, hederaWallet, sloMoPoints) VALUES (?, ?, ?) ON CONFLICT(xUsername) DO UPDATE SET hederaWallet = ?, sloMoPoints = sloMoPoints + ?`,
        [normalizedXUsername, hederaWallet, bonusPoints, hederaWallet, bonusPoints],
        async (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            await appendToGoogleSheet(normalizedXUsername, hederaWallet);
            // Store the xUsername in the session
            req.session.xUsername = normalizedXUsername;
            console.log(`Session set for user: ${normalizedXUsername}`);
            res.status(200).json({ message: 'Profile saved' });
        }
    );
});

app.get('/api/whoami', (req, res) => {
    console.log('Session data:', req.session);
    if (req.session.xUsername) {
        res.json({ xUsername: req.session.xUsername });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

app.get('/api/leaderboard', (req, res) => {
    db.all(
        `SELECT xUsername, sloMoPoints FROM users ORDER BY sloMoPoints DESC LIMIT 10`,
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
                            res.json({ seasonId: previousSeasonId, winners });
                        }
                    );
                }
            );
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

app.post('/api/admin/delete-user', (req, res) => {
    const { xUsername, adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    if (!xUsername) {
        return res.status(400).json({ error: 'X username is required' });
    }

    db.get(
        `SELECT xUsername FROM users WHERE xUsername = ?`,
        [xUsername],
        (err, row) => {
            if (err) {
                console.error('Error checking user:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: `User ${xUsername} not found` });
            }

            db.run(
                `DELETE FROM users WHERE xUsername = ?`,
                [xUsername],
                (err) => {
                    if (err) {
                        console.error('Error deleting user:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    console.log(`Deleted user ${xUsername} from the leaderboard`);
                    res.status(200).json({ message: `Successfully deleted user ${xUsername}` });
                }
            );
        }
    );
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
                    res.status(200).json({ message: 'Successfully cleared invalid users from the leaderboard' });
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
                        { rank: 1, amount: 100 },
                        { rank: 2, amount: 50 },
                        { rank: 3, amount: 25 }
                    ];

                    const insertStmt = db.prepare(`
                        INSERT INTO season_rewards (seasonId, xUsername, rank, rewardAmount, claimed)
                        VALUES (?, ?, ?, ?, 0)
                    `);
                    topPlayers.forEach((player, index) => {
                        const reward = rewards[index];
                        if (reward) {
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

                                    Object.keys(lastChecked).forEach(key => delete lastChecked[key]);
                                    console.log('Cleared lastChecked timestamps for new season');

                                    res.status(200).json({ message: 'Successfully reset the leaderboard and started a new season' });
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
                                        if (err) console.error(err);
                                        console.log(`${row.xUsername} earned ${pointsToAdd} SloMo Points (multiplier: ${multiplier})`);
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
