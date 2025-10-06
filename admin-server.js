require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { query, runQuery, userDB, postsDB } = require('./config/database');

const app = express();
const ADMIN_PORT = process.env.ADMIN_PORT || 3001;

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Strict HTTPS (uncomment in production with HTTPS)
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Session configuration with secure settings
app.use(session({
  secret: process.env.ADMIN_SESSION_SECRET || 'admin-super-secret-key-2025-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'admin.sid', // Different session name than main app
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    httpOnly: true, // Prevent XSS attacks
    maxAge: 60 * 60 * 1000, // 1 hour - shorter session for admin
    sameSite: 'strict' // CSRF protection
  }
}));

// Admin authentication middleware - CRITICAL SECURITY CHECK
function requireAdmin(req, res, next) {
  // Check if user is logged in
  if (!req.session.userId) {
    return res.redirect('/admin/login');
  }
  
  // CRITICAL: Verify user is actually an admin in the database
  // Don't trust session alone - always verify against database
  userDB.findById(req.session.userId)
    .then(user => {
      if (!user) {
        req.session.destroy();
        return res.redirect('/admin/login');
      }
      
      // SECURITY: Only allow admin role
      if (user.role !== 'admin') {
        // Log unauthorized access attempt
        console.warn(`⚠️  Unauthorized admin access attempt by user ${user.id} (${user.email}) with role: ${user.role}`);
        req.session.destroy();
        return res.status(403).render('admin-forbidden', { 
          user: user.name,
          role: user.role 
        });
      }
      
      // User is verified admin
      req.session.user = user;
      next();
    })
    .catch(err => {
      console.error('Admin auth error:', err);
      res.status(500).send('Authentication error');
    });
}

// Login page
app.get('/admin/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin-login', { error: null });
});

// Login POST
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.render('admin-login', { error: 'Email and password required' });
    }
    
    const bcrypt = require('bcrypt');
    const user = await userDB.findByEmail(email);
    
    if (!user) {
      // Log failed attempt
      console.warn(`⚠️  Failed admin login attempt for email: ${email} (user not found)`);
      return res.render('admin-login', { error: 'Invalid credentials' });
    }
    
    // CRITICAL: Check if user is admin BEFORE checking password
    if (user.role !== 'admin') {
      // Log unauthorized access attempt
      console.warn(`⚠️  Non-admin user ${user.id} (${email}) attempted to access admin panel. Role: ${user.role}`);
      return res.render('admin-login', { error: 'Access denied. Admin privileges required.' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.warn(`⚠️  Failed admin login attempt for ${email} (wrong password)`);
      return res.render('admin-login', { error: 'Invalid credentials' });
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.user = user;
    
    console.log(`✅ Admin ${user.name} (${email}) logged in successfully`);
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Admin login error:', error);
    res.render('admin-login', { error: 'Login failed' });
  }
});

// Logout
app.post('/admin/logout', (req, res) => {
  const userName = req.session.user?.name || 'Unknown';
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    console.log(`📤 Admin ${userName} logged out`);
    res.redirect('/admin/login');
  });
});

// Dashboard - Protected Route
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    // Get statistics
    const stats = await getStatistics();
    
    res.render('admin-dashboard', { 
      user: req.session.user,
      stats
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Users management
app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await query('SELECT id, name, email, role, status, created_at FROM users ORDER BY id DESC');
    res.render('admin-users', { 
      user: req.session.user,
      users: users.rows
    });
  } catch (error) {
    console.error('Users page error:', error);
    res.status(500).send('Error loading users');
  }
});

// Update user role - API endpoint
app.post('/admin/api/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['user', 'premium', 'advertiser', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Prevent admin from removing their own admin role
    if (parseInt(id) === req.session.userId && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }
    
    await runQuery('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    console.log(`✅ Admin ${req.session.user.name} changed user ${id} role to ${role}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user
app.delete('/admin/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await runQuery('DELETE FROM users WHERE id = ?', [id]);
    console.log(`🗑️  Admin ${req.session.user.name} deleted user ${id}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Posts management
app.get('/admin/posts', requireAdmin, async (req, res) => {
  try {
    const posts = await query(`
      SELECT p.id, p.content, p.created_at, u.name as userName, u.email as userEmail
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    
    res.render('admin-posts', { 
      user: req.session.user,
      posts: posts.rows
    });
  } catch (error) {
    console.error('Posts page error:', error);
    res.status(500).send('Error loading posts');
  }
});

// Delete post
app.delete('/admin/api/posts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await runQuery('DELETE FROM posts WHERE id = ?', [id]);
    console.log(`🗑️  Admin ${req.session.user.name} deleted post ${id}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Post deletion error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Helper function to get statistics
async function getStatistics() {
  const totalUsers = await query('SELECT COUNT(*) as count FROM users');
  const totalPosts = await query('SELECT COUNT(*) as count FROM posts');
  const onlineUsers = await query("SELECT COUNT(*) as count FROM users WHERE status = 'online'");
  const adminUsers = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  const premiumUsers = await query("SELECT COUNT(*) as count FROM users WHERE role = 'premium'");
  const advertiserUsers = await query("SELECT COUNT(*) as count FROM users WHERE role = 'advertiser'");
  
  const recentUsers = await query(`
    SELECT name, email, created_at 
    FROM users 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  
  return {
    totalUsers: totalUsers.rows[0].count,
    totalPosts: totalPosts.rows[0].count,
    onlineUsers: onlineUsers.rows[0].count,
    adminUsers: adminUsers.rows[0].count,
    premiumUsers: premiumUsers.rows[0].count,
    advertiserUsers: advertiserUsers.rows[0].count,
    recentUsers: recentUsers.rows
  };
}

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Start server
app.listen(ADMIN_PORT, () => {
  console.log('');
  console.log('🔐 ═══════════════════════════════════════════════════════════');
  console.log('🔐  ADMIN DASHBOARD SERVER STARTED');
  console.log('🔐 ═══════════════════════════════════════════════════════════');
  console.log(`🔐  Port: ${ADMIN_PORT}`);
  console.log(`🔐  URL: http://localhost:${ADMIN_PORT}/admin/login`);
  console.log('🔐  Access: ADMIN ONLY');
  console.log('🔐 ═══════════════════════════════════════════════════════════');
  console.log('');
});
