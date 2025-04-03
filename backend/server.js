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

// Debug log to confirm ADMIN_PASSWORD value
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
console.log('ADMIN_PASSWORD loaded:', ADMIN_PASSWORD);

async function appendToGoogleSheet(xUsername) {
    const timestamp = new Date().toISOString();
    const values = [[xUsername, timestamp]];
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

app.post('/api/profile', (req, res) => {
    const { xUsername } = req.body;

    // Validate X username
    const xUsernameRegex = /^@[a-zA-Z0-9_]{1,15}$/;
    if (!xUsername || !xUsernameRegex.test(xUsername)) {
        return res.status(400).json({ error: 'Invalid X username. It must start with @ and contain only letters, numbers, or underscores (e.g., @slothhbar).' });
    }

    db.run(
        `INSERT INTO users (xUsername) VALUES (?) ON CONFLICT(xUsername) DO NOTHING`,
        [xUsername],
        async (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            await appendToGoogleSheet(xUsername);
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

// Admin endpoint to verify the password
app.post('/api/admin/verify-password', (req, res) => {
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }

    res.status(200).json({ message: 'Password verified' });
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

// Admin endpoint to reset the entire leaderboard
app.post('/api/admin/reset-leaderboard', (req, res) => {
    const { adminPassword } = req.body;

    // Simple password check
    if (adminPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Unauthorized
