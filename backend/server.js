// ==== Hedera SDK integration ====
const { Client, AccountId, PrivateKey, TokenMintTransaction } = require("@hashgraph/sdk");

// Load operator credentials (Env vars preferred, fallback to JSON file)
let operatorId = process.env.HEDERA_OPERATOR_ID;
let operatorKey = process.env.HEDERA_OPERATOR_KEY;
if (!operatorId || !operatorKey) {
  try {
    const creds = require('./lazy-legends-credentials.json');
    operatorId = creds.operatorId;
    operatorKey = creds.operatorKey;
    console.log('Using credentials from JSON fallback');
  } catch (e) {
    console.error('Hedera credentials not set in env or JSON!');
    process.exit(1);
  }
}

// init Hedera client
const hederaClient = Client.forName("testnet");
hederaClient.setOperator(
  AccountId.fromString(operatorId),
  PrivateKey.fromString(operatorKey)
);
// ===============================================

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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session middleware with SQLite store
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: '/app/data', concurrentDB: true }),
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 86400000, sameSite: 'lax' }
}));

app.use((err, req, res, next) => {
  if (err) {
    console.error('Session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
});

// Static file serving
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));

// File upload config
const uploadDir = path.join(__dirname, '../Uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${req.session.xUsername}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    return cb(ok, ok ? null : new Error('Only images allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Google Sheets auth
const auth = new google.auth.GoogleAuth({
  keyFile: './lazy-legends-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id';
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
const lastChecked = {};
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
console.log('ADMIN_PASSWORD loaded');

// Migrate users to add password, profilePhoto
db.serialize(() => {
  db.run("ALTER TABLE users ADD COLUMN password TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN profilePhoto TEXT", () => {});
  bcrypt.hash('defaultpassword123', 10, (err, hash) => {
    if (!err) db.run("UPDATE users SET password = ? WHERE password IS NULL", [hash]);
  });
});

// Utility: append to sheet
async function appendToGoogleSheet(xUsername, hederaWallet) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:B',
      valueInputOption: 'RAW',
      resource: { values: [[xUsername, hederaWallet]] }
    });
  } catch(e) {
    console.error('Sheet append err', e);
  }
}

// ========== ROUTES ==========

// Mint NFT
app.post('/api/mint', async (req, res) => {
  try {
    const { accountId, itemId } = req.body;
    const mintTx = new TokenMintTransaction()
      .setTokenId(itemId)
      .setMetadata([Uint8Array.from(Buffer.from(`LazyLegend#${itemId}`))])
      .freezeWith(hederaClient)
      .sign(PrivateKey.fromString(operatorKey));
    const mintResp = await mintTx.execute(hederaClient);
    const receipt = await mintResp.getReceipt(hederaClient);
    res.json({ txId: receipt.transactionId.toString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Signup
app.post('/api/signup', async (req, res) => {
  const { xUsername, password, hederaWallet } = req.body;
  if (!xUsername || !password) return res.status(400).json({ error: 'Username and password required' });

  const stmt = db.prepare('SELECT xUsername FROM users WHERE xUsername = ?');
  if (stmt.get(xUsername)) return res.status(409).json({ error: 'Username taken' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Hashing error' });
    db.run('INSERT INTO users (xUsername, password, hederaWallet, sloMoPoints) VALUES (?, ?, ?, ?)',
      [xUsername, hash, hederaWallet || null, hederaWallet ? 5 : 0], function(err) {
        if (err) return res.status(500).json({ error: 'DB insert failed' });
        req.session.xUsername = xUsername;
        appendToGoogleSheet(xUsername, hederaWallet || '');
        res.json({ message: 'Signup successful', bonusPoints: hederaWallet ? 5 : 0 });
      });
  });
});

// Signin
app.post('/api/signin', (req, res) => {
  const { xUsername, password } = req.body;
  if (!xUsername || !password) return res.status(400).json({ error: 'Username and password required' });

  const stmt = db.prepare('SELECT password, sloMoPoints FROM users WHERE xUsername = ?');
  const user = stmt.get(xUsername);
  if (!user) return res.status(401).json({ error: 'User not found' });

  bcrypt.compare(password, user.password, (err, match) => {
    if (err || !match) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.xUsername = xUsername;
    res.json({ message: 'Signin successful', sloMoPoints: user.sloMoPoints });
  });
});

// Signout
app.post('/api/signout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logout successful' });
  });
});

// Delete account
app.post('/api/delete-account', (req, res) => {
  const { walletAddress } = req.body;
  if (!req.session.xUsername) return res.status(401).json({ error: 'Not logged in' });

  db.run('DELETE FROM users WHERE xUsername = ?', [req.session.xUsername], (err) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    if (walletAddress) {
      const photoPath = path.join(uploadDir, path.basename(walletAddress));
      fs.unlink(photoPath, () => {}); // Ignore errors if file doesn't exist
    }
    req.session.destroy(() => res.json({ message: 'Account deleted' }));
  });
});

// Profile
app.get('/api/whoami', (req, res) => {
  if (!req.session.xUsername) return res.status(401).json({ error: 'Not logged in' });
  const stmt = db.prepare('SELECT xUsername, hederaWallet, sloMoPoints, profilePhoto FROM users WHERE xUsername = ?');
  const user = stmt.get(req.session.xUsername);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.session.xUsername) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const photoUrl = `/uploads/${req.file.filename}`;
  db.run('UPDATE users SET profilePhoto = ? WHERE xUsername = ?', [photoUrl, req.session.xUsername], (err) => {
    if (err) return res.status(500).json({ error: 'Update failed' });
    res.json({ photoUrl });
  });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const stmt = db.prepare('SELECT xUsername, hederaWallet, sloMoPoints, profilePhoto FROM users ORDER BY sloMoPoints DESC LIMIT 10');
  const rows = stmt.all();
  res.json(rows);
});

// Recent Activity
app.get('/api/recent-activity', (req, res) => {
  const stmt = db.prepare('SELECT xUsername, sloMoPoints FROM users ORDER BY sloMoPoints DESC LIMIT 5');
  const rows = stmt.all();
  res.json(rows.map(row => ({
    xUsername: row.xUsername,
    points: row.sloMoPoints,
    timestamp: new Date().toISOString()
  })));
});

// Season Winners
app.get('/api/season-winners', (req, res) => {
  const stmt = db.prepare('SELECT xUsername, sloMoPoints FROM users ORDER BY sloMoPoints DESC LIMIT 3');
  const rows = stmt.all();
  const winners = rows.map((row, index) => ({
    xUsername: row.xUsername,
    sloMoPoints: row.sloMoPoints,
    rank: index + 1
  }));
  res.json({ seasonId: 'previous', winners });
});

// Admin Routes
app.get('/api/admin/users', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  const stmt = db.prepare('SELECT xUsername, hederaWallet, sloMoPoints FROM users');
  res.json(stmt.all());
});

app.get('/api/admin/announcement', (req, res) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const isBonusDay = dayOfWeek === 0;
  let text = 'Welcome to Lazy Legends! 🦥';
  if (isBonusDay) text += ' 🦥 It’s Sloth Bonus Day! 2x SloMo Points today!';
  res.json({ text });
});

app.post('/api/admin/update-announcement', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  res.json({ message: 'Announcement updated successfully' });
});

app.get('/api/admin/season-dates', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  res.json({ startDate: '2025-05-01T00:00:00-05:00', endDate: '2025-05-29T00:00:00-05:00' });
});

app.post('/api/admin/update-season-dates', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: 'Dates required' });
  res.json({ message: 'Season dates updated successfully' });
});

app.post('/api/admin/delete-user', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  const { xUsername } = req.body;
  if (!xUsername) return res.status(400).json({ error: 'Username required' });
  db.run('DELETE FROM users WHERE xUsername = ?', [xUsername], (err) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ message: `User ${xUsername} deleted` });
  });
});

app.post('/api/admin/clear-leaderboard', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  db.run('UPDATE users SET sloMoPoints = 0', [], (err) => {
    if (err) return res.status(500).json({ error: 'Clear failed' });
    res.json({ message: 'Leaderboard cleared successfully' });
  });
});

app.post('/api/admin/reset-leaderboard', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(403).json({ error: 'Unauthorized' });
  db.run('UPDATE users SET sloMoPoints = 0', [], (err) => {
    if (err) return res.status(500).json({ error: 'Reset failed' });
    res.json({ message: 'Leaderboard reset successfully' });
  });
});

// Track LazyLegends Posts with Photo Requirement for Season 2
async function trackLazyLegendsPosts() {
    setInterval(async () => {
        console.log('Checking for #LazyLegends posts...');
        const seasonStartTimestamp = new Date('2025-05-01T00:00:00-05:00').getTime();
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isBonusDay = dayOfWeek === 0;
        const multiplier = isBonusDay ? 2 : 1;
        console.log(`Today is ${isBonusDay ? '' : 'not '}a bonus day. Multiplier: ${multiplier}`);

        const users = db.prepare('SELECT xUsername FROM users').all();
        if (users.length === 0) {
            console.log('No users to check for #LazyLegends posts.');
            return;
        }

        for (const user of users) {
            const xUsername = user.xUsername;
            if (!xUsername) continue;

            const lastTime = lastChecked[xUsername] || seasonStartTimestamp;
            const now = Date.now();
            if (now - lastTime < 1800000) {
                console.log(`Skipping ${xUsername} - last checked at ${new Date(lastTime).toISOString()}`);
                continue;
            }

            try {
                const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
                    headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
                    params: {
                        query: `#LazyLegends from:${xUsername.replace('@', '')}`,
                        max_results: 10,
                        'tweet.fields': 'created_at,attachments'
                    }
                });

                const tweets = response.data.data || [];
                const newTweets = tweets.filter(tweet => {
                    const tweetTime = new Date(tweet.created_at).getTime();
                    const hasPhoto = tweet.attachments && tweet.attachments.media_keys && tweet.attachments.media_keys.length > 0;
                    return tweetTime > lastTime && tweetTime >= seasonStartTimestamp && hasPhoto;
                });

                const pointsToAdd = (newTweets.length * 2) * multiplier;
                if (pointsToAdd > 0) {
                    db.run('UPDATE users SET sloMoPoints = sloMoPoints + ? WHERE xUsername = ?', [pointsToAdd, xUsername]);
                    console.log(`${xUsername} earned ${pointsToAdd} SloMo Points`);
                }

                lastChecked[xUsername] = now;
            } catch (error) {
                console.error(`Error fetching tweets for ${xUsername}:`, error.response?.data || error.message);
                if (error.response?.status === 429) {
                    console.log('Hit 429 limit, waiting 5 minutes...');
                    await new Promise(resolve => setTimeout(resolve, 300000));
                }
            }
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }, 1800000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server on ${PORT}`); trackLazyLegendsPosts(); });
