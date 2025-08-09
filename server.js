require('dotenv').config();
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
  PORT
} = process.env;

const allowedRoles = ALLOWED_ROLE_IDS.split(',').map(r => Number(r.trim()));

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected')).catch(console.error);

const User = require('./models/User');
const Shift = require('./models/Shift');
const LOA = require('./models/LOA');
const Note = require('./models/Note');

const app = express();

app.use(cors({
  origin: 'http://localhost:3001', // frontend URL, change as needed
  credentials: true
}));
app.use(bodyParser.json());

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true if using HTTPS
}));

// Roblox OAuth2 Login
app.get('/auth/login', (req, res) => {
  const authUrl = `https://apis.roblox.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://apis.roblox.com/oauth/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const accessToken = tokenResponse.data.access_token;

    // Get user info from Roblox
    const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const userId = userInfoResponse.data.sub;

    // Check user's group roles
    const groupRolesResponse = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);

    const roles = groupRolesResponse.data.data;
    const groupRole = roles.find(g => g.group.id === Number(GROUP_ID));

    if (!groupRole) return res.status(403).send('You are not in the group.');
    if (!allowedRoles.includes(groupRole.role.id)) return res.status(403).send('No permission.');

    // Save or update user in DB
    let user = await User.findOne({ robloxId: userId });
    if (!user) {
      user = new User({
        robloxId: userId,
        username: userInfoResponse.data.preferred_username,
        roleId: groupRole.role.id
      });
      await user.save();
    } else {
      user.roleId = groupRole.role.id;
      await user.save();
    }

    // Store user in session
    req.session.user = {
      id: user._id,
      robloxId: userId,
      username: user.username,
      roleId: groupRole.role.id,
    };

    // Redirect to frontend dashboard
    res.redirect('http://localhost:3001/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed');
  }
});

// Logout route
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.sendStatus(200);
  });
});

// Middleware to check auth
function checkAuth(req, res, next) {
  if (!req.session.user) return res.status(401).send('Unauthorized');
  next();
}

// API routes

// Get current user info
app.get('/api/user', checkAuth, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.json(user);
});

// Get all shifts
app.get('/api/shifts', checkAuth, async (req, res) => {
  const shifts = await Shift.find();
  res.json(shifts);
});

// Create new shift (owners/admins only)
app.post('/api/shifts', checkAuth, async (req, res) => {
  if (![254,255].includes(req.session.user.roleId)) return res.status(403).send('Forbidden');
  const { title, date, startTime, endTime, assignedTo } = req.body;
  const shift = new Shift({ title, date, startTime, endTime, assignedTo });
  await shift.save();
  res.json(shift);
});

// Get LOA requests
app.get('/api/loa', checkAuth, async (req, res) => {
  const loaList = await LOA.find();
  res.json(loaList);
});

// Submit LOA request
app.post('/api/loa', checkAuth, async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  const loa = new LOA({
    userId: req.session.user.id,
    startDate,
    endDate,
    reason,
    status: 'Pending'
  });
  await loa.save();
  res.json(loa);
});

// Approve LOA (owners/admins only)
app.post('/api/loa/:id/approve', checkAuth, async (req, res) => {
  if (![254,255].includes(req.session.user.roleId)) return res.status(403).send('Forbidden');
  const loa = await LOA.findById(req.params.id);
  if (!loa) return res.status(404).send('LOA not found');
  loa.status = 'Approved';
  await loa.save();
  res.json(loa);
});

// Deny LOA (owners/admins only)
app.post('/api/loa/:id/deny', checkAuth, async (req, res) => {
  if (![254,255].includes(req.session.user.roleId)) return res.status(403).send('Forbidden');
  const loa = await LOA.findById(req.params.id);
  if (!loa) return res.status(404).send('LOA not found');
  loa.status = 'Denied';
  await loa.save();
  res.json(loa);
});

// Get user profile by robloxId with notes
app.get('/api/user/:robloxId', checkAuth, async (req, res) => {
  const user = await User.findOne({ robloxId: req.params.robloxId });
  if (!user) return res.status(404).send('User not found');

  const notes = await Note.find({ userId: user._id });

  res.json({
    user,
    notes
  });
});

// Add note (owners/admins only)
app.post('/api/user/:robloxId/note', checkAuth, async (req, res) => {
  if (![254,255].includes(req.session.user.roleId)) return res.status(403).send('Forbidden');
  const { type, reason } = req.body;
  const user = await User.findOne({ robloxId: req.params.robloxId });
  if (!user) return res.status(404).send('User not found');

  const note = new Note({
    userId: user._id,
    type,
    reason,
    addedBy: req.session.user.id,
    date: new Date()
  });

  await note.save();
  res.json(note);
});

app.listen(PORT || 3000, () => {
  console.log(`Server running on port ${PORT || 3000}`);
});
