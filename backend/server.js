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
      .sign(HEDERA_OPERATOR_KEY);
    const mintResp = await mintTx.execute(hederaClient);
    const receipt = await mintResp.getReceipt(hederaClient);
    res.json({ txId: receipt.transactionId.toString() });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// Signup
app.post('/api/signup', async (req, res) => { /* ... */ });
// Signin
app.post('/api/signin', (req, res) => { /* ... */ });
// Signout
app.post('/api/signout', (req, res) => { /* ... */ });
// Delete account
app.post('/api/delete-account', (req, res) => { /* ... */ });

// Profile
app.get('/api/whoami', (req, res) => { /* ... */ });
app.post('/api/upload-photo', upload.single('photo'), (req, res) => { /* ... */ });

// Leaderboard, activity, seasons, admin routes...
// (Keep your existing code here)

async function trackLazyLegendsPosts() { /* ... */ }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server on ${PORT}`); trackLazyLegendsPosts(); });
