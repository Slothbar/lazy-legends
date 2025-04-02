const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

const auth = new google.auth.GoogleAuth({
    keyFile: './lazy-legends-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;

const lastChecked = {};

async function appendToGoogleSheet(xUsername, hederaWallet) {
    const timestamp = new Date().toISOString();
    const values = [[xUsername, hederaWallet, timestamp]];
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

    // Validate Hedera wallet address
    if (!hederaWallet || !hederaWallet.startsWith('0.0')) {
        return res.status(400).json({ error: 'Invalid Hedera wallet address. It must start with 0.0 (e.g., 0.0.12345).' });
    }

    const hederaWalletRegex = /^0\.0\.\d+$/;
    if (!hederaWalletRegex.test(hederaWallet)) {
        return res.status(400).json({ error: 'Invalid Hedera wallet address format. It must be in the format 0.0.<number> (e.g., 0.0.12345).' });
    }

    db.run(
        `INSERT INTO users (xUsername, hederaWallet) VALUES (?, ?) ON CONFLICT(xUsername) DO UPDATE SET hederaWallet = ?`,
        [xUsername, hederaWallet, hederaWallet],
        async (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            await appendToGoogleSheet(xUsername, hederaWallet);
            res.status(200).json({ message: 'Profile saved' });
        }
    );
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

// Admin endpoint to delete a user
app.post('/api/admin/delete-user', (req, res) => {
    const { xUsername, adminPassword } = req.body;

    // Simple password check (replace 'your-secret-password' with your secure password)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    // Validate X username (must not be empty)
    if (!xUsername) {
        return res.status(400).json({ error: 'X username is required' });
    }

    // Check if the user exists
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

            // Delete the user from the database
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

// Admin endpoint to clear invalid users from the leaderboard
app.post('/api/admin/clear-leaderboard', (req, res) => {
    const { adminPassword } = req.body;

    // Simple password check (replace 'your-secret-password' with your secure password)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    // Log the current users before deletion
    db.all(`SELECT xUsername, hederaWallet FROM users`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users before clearing:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log('Users before clearing:', rows);

        // Delete users where xUsername does NOT start with @ OR hederaWallet does NOT start with 0.0
        db.run(
            `DELETE FROM users WHERE xUsername NOT LIKE '@%' OR hederaWallet NOT LIKE '0.0%'`,
            (err) => {
                if (err) {
                    console.error('Error clearing invalid users from leaderboard:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                console.log('Cleared invalid users from the leaderboard');

                // Log the remaining users after deletion
                db.all(`SELECT xUsername, hederaWallet FROM users`, [], (err, remainingRows) => {
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

async function trackLazyLegendsPosts() {
    setInterval(async () => {
        console.log('Checking for #LazyLegends posts now...');
        db.all(`SELECT xUsername FROM users`, [], async (err, rows) => {
            if (err) return console.error(err);

            if (!rows || rows.length === 0) {
                console.log('No users to check for #LazyLegends posts.');
                return;
            }

            console.log(`Found ${rows.length} users to check.`);

            for (const row of rows) {
                const lastTime = lastChecked[row.xUsername] || 0;
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
                        return tweetTime > lastTime;
                    });

                    const pointsToAdd = newTweets.length * 2;
                    if (pointsToAdd > 0) {
                        db.run(
                            `UPDATE users SET sloMoPoints = sloMoPoints + ? WHERE xUsername = ?`,
                            [pointsToAdd, row.xUsername],
                            (err) => {
                                if (err) console.error(err);
                                console.log(`${row.xUsername} earned ${pointsToAdd} SloMo Points`);
                            }
                        );
                    } else {
                        console.log(`No new #LazyLegends tweets found for ${row.xUsername}`);
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
    }, 1800000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    trackLazyLegendsPosts();
});
