require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const app = express();

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GROUP_ID,
  ALLOWED_ROLE_IDS,
  SESSION_SECRET
} = process.env;

const allowedRoles = ALLOWED_ROLE_IDS.split(',').map(r => Number(r.trim()));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`
      <h1>Welcome ${req.session.user.username}</h1>
      <p>Your role ID: ${req.session.user.roleId}</p>
      <a href="/dashboard">Go to Dashboard</a><br/>
      <a href="/logout">Logout</a>
    `);
  } else {
    res.send(`<a href="/auth/login">Login with Roblox</a>`);
  }
});

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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const accessToken = tokenResponse.data.access_token;

    // Get user info
    const userInfoResponse = await axios.get('https://apis.roblox.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const userId = userInfoResponse.data.sub;

    // Check group membership and role
    const groupRolesResponse = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);

    const roles = groupRolesResponse.data.data;
    const groupRole = roles.find(g => g.group.id === Number(GROUP_ID));

    if (!groupRole) return res.status(403).send('You are not in the group.');

    if (!allowedRoles.includes(groupRole.role.id)) return res.status(403).send('You do not have permission.');

    // Save user session
    req.session.user = {
      userId,
      username: userInfoResponse.data.preferred_username,
      roleId: groupRole.role.id
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  res.send(`
    <h1>Staff Dashboard</h1>
    <p>Welcome, ${req.session.user.username}!</p>
    <p>Your role ID is: ${req.session.user.roleId}</p>
    <p>[Here you will build shift planning, LOA, admin panels, etc.]</p>
    <a href="/logout">Logout</a>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
