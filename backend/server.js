const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');
const { Client, TokenTransferTransaction, AccountId, PrivateKey } = require('@hashgraph/sdk');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Google Sheets authentication
const auth = new google.auth.GoogleAuth({
    keyFile: './lazy-legends-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;

// Hedera SDK setup
const treasuryAccountId = process.env.TREASURY_ACCOUNT_ID || '0.0.<your-treasury-account-id>';
const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY || '<your-treasury-private-key>';
const slothTokenId = process.env.SLOTH_TOKEN_ID || '0.0.<your-sloth-token-id>';

const client = Client.forTestnet(); // Use .forMainnet() for production
client.setOperator(AccountId.fromString(treasuryAccountId), PrivateKey.fromString(treasuryPrivateKey));

const lastChecked = {};

// Debug log to confirm ADMIN_PASSWORD value
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
console.log('ADMIN_PASSWORD loaded:', ADMIN_PASSWORD);

async function appendToGoogleSheet(xUsername, hederaWallet) {
    const timestamp = new Date().toISOString();
    // Mask the wallet address for privacy (show only first 6 characters)
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

    // Add 5 bonus SloMo Points if wallet address is provided
    const bonusPoints = hederaWallet !== 'N/A' ? 5 : 0;

    db.run(
        `INSERT INTO users (xUsername, hederaWallet, sloMoPoints) VALUES (?, ?, ?) ON CONFLICT(xUsername) DO UPDATE SET hederaWallet = ?, sloMoPoints = sloMoPoints + ?`,
        [xUsername, hederaWallet, bonusPoints, hederaWallet, bonusPoints],
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

// Endpoint to check if today is a bonus day
app.get('/api/bonus-day', (req, res) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isBonusDay = dayOfWeek === 0; // Sunday
    const multiplier = isBonusDay ? 2 : 1; // 2x on Sundays, 1x otherwise
    res.json({ isBonusDay, multiplier });
});

// Endpoint to get season winners and claim status
app.get('/api/season-winners', (req, res) => {
    // Get the current season (latest season)
    db.get(
        `SELECT id FROM seasons ORDER BY id DESC LIMIT 1`,
        [],
        (err, currentSeason) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!currentSeason) return res.status(404).json({ error: 'No seasons found' });

            const currentSeasonId = currentSeason.id;

            // Get the previous season (second-to-last season)
            db.get(
                `SELECT id FROM seasons WHERE id < ? ORDER BY id DESC LIMIT 1`,
                [currentSeasonId],
                (err, previousSeason) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    if (!previousSeason) return res.status(404).json({ error: 'No previous season found' });

                    const previousSeasonId = previousSeason.id;

                    // Check if winners have already been recorded for the previous season
                    db.get(
                        `SELECT COUNT(*) as count FROM season_rewards WHERE seasonId = ?`,
                        [previousSeasonId],
                        (err, row) => {
                            if (err) return res.status(500).json({ error: 'Database error' });

                            if (row.count === 0) {
                                // Winners not recorded yet, determine the top 3 from the previous season
                                // Note: We don't have historical points, so we'll assume the current leaderboard reflects the end of the previous season
                                // In a future improvement, we can store points at season end
                                db.all(
                                    `SELECT xUsername, sloMoPoints FROM users ORDER BY sloMoPoints DESC LIMIT 3`,
                                    [],
                                    (err, topPlayers) => {
                                        if (err) return res.status(500).json({ error: 'Database error' });

                                        // Define reward amounts
                                        const rewards = [
                                            { rank: 1, amount: 100 }, // 1st place: 100 $SLOTH
                                            { rank: 2, amount: 50 },  // 2nd place: 50 $SLOTH
                                            { rank: 3, amount: 25 }   // 3rd place: 25 $SLOTH
                                        ];

                                        // Insert the winners into season_rewards
                                        const insertStmt = db.prepare(`
                                            INSERT INTO season_rewards (seasonId, xUsername, rank, rewardAmount, claimed)
                                            VALUES (?, ?, ?, ?, 0)
                                        `);
                                        topPlayers.forEach((player, index) => {
                                            const reward = rewards[index];
                                            if (reward) {
                                                insertStmt.run(previousSeasonId, player.xUsername, reward.rank, reward.amount);
                                            }
                                        });
                                        insertStmt.finalize();

                                        // Fetch the winners with claim status
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
                            } else {
                                // Winners already recorded, fetch them with claim status
                                db.all(
                                    `SELECT xUsername, rank, rewardAmount, claimed FROM season_rewards WHERE seasonId = ?`,
                                    [previousSeasonId],
                                    (err, winners) => {
                                        if (err) return res.status(500).json({ error: 'Database error' });
                                        res.json({ seasonId: previousSeasonId, winners });
                                    }
                                );
                            }
                        }
                    );
                }
            );
        }
    );
});

// Endpoint to claim rewards
app.post('/api/claim-rewards', async (req, res) => {
    const { xUsername } = req.body;

    if (!xUsername) {
        return res.status(400).json({ error: 'X username is required' });
    }

    // Get the current season
    db.get(
        `SELECT id FROM seasons ORDER BY id DESC LIMIT 1`,
        [],
        async (err, currentSeason) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!currentSeason) return res.status(404).json({ error: 'No seasons found' });

            const currentSeasonId = currentSeason.id;

            // Get the previous season
            db.get(
                `SELECT id FROM seasons WHERE id < ? ORDER BY id DESC LIMIT 1`,
                [currentSeasonId],
                async (err, previousSeason) => {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    if (!previousSeason) return res.status(404).json({ error: 'No previous season found' });

                    const previousSeasonId = previousSeason.id;

                    // Check if the user is eligible to claim rewards
                    db.get(
                        `SELECT rank, rewardAmount, claimed, hederaWallet
                         FROM season_rewards sr
                         JOIN users u ON sr.xUsername = u.xUsername
                         WHERE sr.seasonId = ? AND sr.xUsername = ?`,
                        [previousSeasonId, xUsername],
                        async (err, reward) => {
                            if (err) return res.status(500).json({ error: 'Database error' });
                            if (!reward) return res.status(403).json({ error: 'You are not eligible to claim rewards for this season' });
                            if (reward.claimed) return res.status(403).json({ error: 'You have already claimed your rewards for this season' });
                            if (!reward.hederaWallet || reward.hederaWallet === 'N/A') return res.status(403).json({ error: 'No wallet address provided. Please update your profile with a valid Hedera wallet address.' });

                            // Perform the token transfer
                            const rewardAmount = reward.rewardAmount;
                            const recipientWallet = reward.hederaWallet;

                            try {
                                const transaction = new TokenTransferTransaction()
                                    .addTokenTransfer(slothTokenId, treasuryAccountId, -rewardAmount) // Deduct from treasury
                                    .addTokenTransfer(slothTokenId, recipientWallet, rewardAmount); // Add to recipient

                                const txResponse = await transaction.execute(client);
                                const receipt = await txResponse.getReceipt(client);

                                if (receipt.status.toString() !== 'SUCCESS') {
                                    throw new Error('Token transfer failed');
                                }

                                // Update the claim status
                                db.run(
                                    `UPDATE season_rewards SET claimed = 1 WHERE seasonId = ? AND xUsername = ?`,
                                    [previousSeasonId, xUsername],
                                    (err) => {
                                        if (err) {
                                            console.error('Error updating claim status:', err);
                                            return res.status(500).json({ error: 'Database error' });
                                        }
                                        console.log(`Reward claimed: ${rewardAmount} $SLOTH to ${recipientWallet} for ${xUsername}`);
                                        res.json({ message: `Successfully claimed ${rewardAmount} $SLOTH!` });
                                    }
                                );
                            } catch (error) {
                                console.error('Error transferring tokens:', error);
                                res.status(500).json({ error: 'Failed to transfer tokens. Please try again later.' });
                            }
                        }
                    );
                }
            );
        }
    );
});

// Admin endpoint to verify the password
app.post('/api/admin/verify-password', (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: ' WUnauthorized: Invalid admin password' });
    }

    res.status(200).json({ message: 'Password verified' });
});

// Admin endpoint to get all users
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

// Admin endpoint to get the current announcement
app.get('/api/admin/announcement', (req, res) => {
    // Check if today is a bonus day
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isBonusDay = dayOfWeek === 0; // Sunday

    db.get(
        `SELECT text FROM announcements WHERE id = 1`,
        [],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!row) return res.status(404).json({ error: 'Announcement not found' });

            // Append bonus day message if today is Sunday
            let announcementText = row.text;
            if (isBonusDay) {
                announcementText += ' 🦥 It’s Sloth Bonus Day! 2x SloMo Points today!';
            }

            res.json({ text: announcementText });
        }
    );
});

// Admin endpoint to update the announcement
app.post('/api/admin/update-announcement', (req, res) => {
    const { adminPassword, text } = req.body;

    // Simple password check
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    // Validate announcement text
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

// Admin endpoint to delete a user
app.post('/api/admin/delete-user', (req, res) => {
    const { xUsername, adminPassword } = req.body;

    // Simple password check
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

    // Simple password check
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    // Log the current users before deletion
    db.all(`SELECT xUsername FROM users`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users before clearing:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log('Users before clearing:', rows);

        // Delete users where xUsername is NULL (not linked)
        db.run(
            `DELETE FROM users WHERE xUsername IS NULL`,
            (err) => {
                if (err) {
                    console.error('Error clearing invalid users from leaderboard:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                console.log('Cleared invalid users from the leaderboard');

                // Log the remaining users after deletion
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

// Admin endpoint to reset the leaderboard (reset points and start new season)
app.post('/api/admin/reset-leaderboard', (req, res) => {
    const { adminPassword } = req.body;

    // Simple password check
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    // Log the current users before resetting points
    db.all(`SELECT xUsername, sloMoPoints FROM users`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users before resetting:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log('Users before resetting:', rows);

        // Reset all users' SloMo Points to 0
        db.run(
            `UPDATE users SET sloMoPoints = 0`,
            (err) => {
                if (err) {
                    console.error('Error resetting SloMo Points:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                console.log('Reset all users\' SloMo Points to 0');

                // Insert a new season start timestamp
                const newSeasonStart = Math.floor(Date.now() / 1000); // Current timestamp in seconds
                db.run(
                    `INSERT INTO seasons (startTimestamp) VALUES (?)`,
                    [newSeasonStart],
                    (err) => {
                        if (err) {
                            console.error('Error inserting new season:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        console.log('Started new season with timestamp:', newSeasonStart);

                        // Clear the lastChecked object to reset tweet tracking
                        Object.keys(lastChecked).forEach(key => delete lastChecked[key]);
                        console.log('Cleared lastChecked timestamps for new season');

                        res.status(200).json({ message: 'Successfully reset the leaderboard and started a new season' });
                    }
                );
            }
        );
    });
});

async function trackLazyLegendsPosts() {
    setInterval(async () => {
        console.log('Checking for #LazyLegends posts now...');

        // Get the latest season start timestamp
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
                const seasonStartTimestamp = row.startTimestamp * 1000; // Convert to milliseconds

                // Check if today is a bonus day
                const today = new Date();
                const dayOfWeek = today.getDay();
                const isBonusDay = dayOfWeek === 0; // Sunday
                const multiplier = isBonusDay ? 2 : 1; // 2x on Sundays, 1x otherwise
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

                            const pointsToAdd = (newTweets.length * 2) * multiplier; // Apply the multiplier
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
