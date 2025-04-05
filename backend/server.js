const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { google } = require('googleapis');
const db = require('./database.js');
const path = require('path');
const session = require('express-session');
const { Client, TokenTransferTransaction, AccountId, PrivateKey, TokenAssociateTransaction } = require('@hashgraph/sdk');

const app = express();
app.use(cors({
    origin: true, // Allow all origins (adjust in production)
    credentials: true // Allow cookies to be sent
}));
app.use(express.json());

// Configure session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
const treasuryAccountId = process.env.TREASURY_ACCOUNT_ID;
const treasuryPrivateKey = process.env.TREASURY_PRIVATE_KEY;
const slothTokenId = process.env.SLOTH_TOKEN_ID;

// Validate environment variables
if (!treasuryAccountId || treasuryAccountId.includes('<your-treasury-account-id>')) {
    throw new Error('TREASURY_ACCOUNT_ID environment variable is not set or invalid');
}
if (!treasuryPrivateKey || treasuryPrivateKey.includes('<your-treasury-private-key>')) {
    throw new Error('TREASURY_PRIVATE_KEY environment variable is not set or invalid');
}
if (!slothTokenId || slothTokenId.includes('<your-sloth-token-id>')) {
    throw new Error('SLOTH_TOKEN_ID environment variable is not set or invalid');
}

const client = Client.forTestnet(); // Use .forMainnet() for production
client.setOperator(AccountId.fromString(treasuryAccountId), PrivateKey.fromString(treasuryPrivateKey));

const lastChecked = {};

// Debug log to confirm ADMIN_PASSWORD value
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-secret-password';
console.log('ADMIN_PASSWORD loaded:', ADMIN_PASSWORD);

async function appendToGoogleSheet(xUsername, hederaWallet) {
    const timestamp = new Date().toISOString();
    // Mask the wallet address for privacy (show only first 6 characters)
    const maskedWallet = hederaWallet !== 
