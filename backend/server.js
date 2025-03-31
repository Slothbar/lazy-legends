const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
    keyFile: './lazy-legends-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1SizgE0qHuB1JgTpOpifEdeJ_ABQEVaESHeFIdPGWeAQ';

// X API setup
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || 'X_BEARER_TOKEN'; // Add this in Render later

// Function to append data to Google Sheet
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

// Save or update user profile and append to Google Sheet
app.post('/api/profile', (req, res) => {
    const { xUsername, hederaWallet } = req.body;
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

// Get leaderboard
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

// Track #LazyLegends posts on X
async function trackLazyLegendsPosts() {
    setInterval(async () => {
        db.all(`SELECT xUsername FROM users`, [], async (err, rows) => {
            if (err) return console.error(err);

            for (const row of rows) {
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
                        const now = Date.now();
                        return (now - tweetTime) < 60000;
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
                    }
                } catch (error) {
                    console.error(`Error fetching tweets for ${row.xUsername}:`, error.response?.data || error.message);
                    if (error.response?.status === 429) {
                        console.log('Hit 429 limit, waiting 15 seconds...');
                        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay between users
            }
        });
    }, 60000);
}

// Start server and tracking
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    trackLazyLegendsPosts();
});
