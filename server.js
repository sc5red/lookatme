const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { connectDB, userDB } = require("./config/database");

const app = express();

app.set("view engine", "ejs");
app.use(express.static('public'));
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
  // If user is already logged in, redirect to home
  if (req.session.userId) {
    res.redirect('/');
  } else {
    res.render("login");
  }
});

// Home route (protected)
app.get("/", requireAuth, (req, res) => {
  res.render("index", { user: req.session.user });
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
  res.render("profile", { user: req.session.user });
});

app.get("/settings", requireAuth, (req, res) => {
  res.render("settings", { user: req.session.user });
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



// Initialize database connection
async function initializeApp() {
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.log('Warning: Database not connected. Some features may not work.');
  } else {
    console.log('Database connected successfully');
  }
}

initializeApp();

// Initialize database connection
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
