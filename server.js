const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { connectDB, userDB } = require("./config/database");
const cookieParser = require('cookie-parser');

const app = express();

app.set("view engine", "ejs");
app.use(express.static('public'));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Theme class injection middleware
app.use((req, res, next) => {
  const theme = req.cookies['color-theme'];
  // default: no class (light) unless dark specified
  res.locals.themeClass = theme === 'dark' ? 'class="dark"' : '';
  next();
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'lookatme-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Login page (public route)
app.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render("login", {
    pageTitle: 'Login',
    themeClass: res.locals.themeClass
  });
});

// Home route (protected)
app.get("/", requireAuth, (req, res) => {
  res.render("index", { 
    user: req.session.user, 
    pageTitle: 'Home', 
    activePage: 'home',
    themeClass: res.locals.themeClass // ensure defined for template
  });
});

// Authentication routes
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    
    // Check if user already exists
    const existingUser = await userDB.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }
    
    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await userDB.create({ name, email, hashedPassword });
    
    // Set session
    req.session.userId = newUser.id;
    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email
    };
    
    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    // Find user
    const user = await userDB.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }
    
    // Update user status to online
    await userDB.updateStatus(user.id, 'online');
    
    // Set session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };
    
    res.json({ success: true, user: req.session.user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/auth/logout", (req, res) => {
  const userId = req.session.userId;
  
  // Update user status to offline
  if (userId) {
    userDB.updateStatus(userId, 'offline').catch(console.error);
  }
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, redirect: '/login' });
  });
});

// Protected routes
app.get("/profile", requireAuth, (req, res) => {
  res.render("profile", { 
    user: req.session.user, 
    pageTitle: 'Profile', 
    activePage: 'profile',
    themeClass: res.locals.themeClass
  });
});

app.get("/settings", requireAuth, (req, res) => {
  res.render("settings", { 
    user: req.session.user, 
    pageTitle: 'Settings', 
    activePage: 'settings',
    themeClass: res.locals.themeClass
  });
});

// Premium page (protected)
app.get('/premium', requireAuth, (req, res) => {
  res.render('premium', {
    user: req.session.user,
    pageTitle: 'Premium',
    activePage: 'premium',
    themeClass: res.locals.themeClass
  });
});

// Database status check endpoint (protected)
app.get("/api/status/database", requireAuth, (req, res) => {
  try {
    // Check database connection status
    res.json({
      database: 'connected',
      message: 'Database connection successful'
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    res.status(500).json({
      database: 'error',
      message: 'Database status check failed'
    });
  }
});

// Friends online endpoint (protected)
app.get("/api/friends/online", requireAuth, async (req, res) => {
  try {
    const friends = await userDB.getOnlineFriends(req.session.userId);
    res.json(friends);
  } catch (error) {
    console.error('Failed to fetch friends:', error);
    res.json([]); // Return empty array if error
  }
});

// Friends page (protected)
app.get('/friends', requireAuth, async (req, res) => {
  res.render('friends', {
    user: req.session.user,
    pageTitle: 'Friends',
    activePage: 'friends',
    themeClass: res.locals.themeClass
  });
});

// Friend summary
app.get('/api/friends/summary', requireAuth, async (req, res) => {
  try {
    const summary = await userDB.getFriendSummary(req.session.userId);
    const pending = await userDB.getPendingCount(req.session.userId);
    res.json({ ...summary, pendingIncoming: pending.incoming, pendingOutgoing: pending.outgoing });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// List friends (optional search param)
app.get('/api/friends/list', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const list = await userDB.listFriends(req.session.userId, q || null);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

// Search users (excluding current) including relation status
app.get('/api/friends/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);
    const results = await userDB.searchUsersExcludingExisting(req.session.userId, q.trim());
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Send friend request
app.post('/api/friends/request', requireAuth, async (req, res) => {
  try {
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'targetId required' });
    const result = await userDB.sendFriendRequest(req.session.userId, Number(targetId));
    if (result.error) return res.status(400).json(result);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Request failed' });
  }
});

// Accept friend request
app.post('/api/friends/accept', requireAuth, async (req, res) => {
  try {
    const { fromUserId } = req.body;
    if (!fromUserId) return res.status(400).json({ error: 'fromUserId required' });
    const result = await userDB.acceptFriendRequest(req.session.userId, Number(fromUserId));
    if (result.error) return res.status(400).json(result);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Accept failed' });
  }
});

// Pending requests (incoming/outgoing lists)
app.get('/api/friends/pending', requireAuth, async (req, res) => {
  try {
    const data = await userDB.getPendingRequests(req.session.userId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load pending' });
  }
});



// Initialize database connection (deduplicated)
async function initializeApp() {
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.log('Warning: Database not connected. Some features may not work.');
  } else {
    console.log('Database connected successfully');
  }
}

initializeApp();

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
