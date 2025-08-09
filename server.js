require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GROUP_ID,
  ALLOWED_ROLE_IDS,
  SESSION_SECRET,
  MONGODB_URI,
  PORT = 3000
} = process.env;

const allowedRoles = ALLOWED_ROLE_IDS.split(',').map(r => Number(r.trim()));

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import your Mongoose models here:
const User = require('./models/User');   // You must create these models according to your schema
const Shift = require('./models/Shift');
const LOA = require('./models/LOA');
const Note = require('./models/Note');

const app = express();

app.use(cors({
  origin: 'http://localhost:3001',  // Change this to your frontend URL
  credentials: true
}));

app.use(bodyParser.json());

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // If you use HTTPS, set true here
}));

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// OAuth login start: Redirect to Roblox OAuth
app.get('/auth/login', (req, res) => {
  const authUrl = `https://apis.roblox.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid`;
  res.redirect(authUrl);
});

// OAuth callback: exchange code for token and validate user
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code in callback');

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://apis.roblox.com/oauth/token',
      new URLSearchP
