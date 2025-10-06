# 🔐 Admin Dashboard - Security Documentation

## Overview

The Admin Dashboard is a **secure, isolated administration panel** running on a separate port (3001) with multiple layers of security protection.

## Security Features

### 🛡️ Multi-Layer Authentication

1. **Session-Based Authentication**
   - Separate session store from main application
   - HTTP-only cookies to prevent XSS attacks
   - 1-hour session timeout for security
   - SameSite strict policy for CSRF protection

2. **Role-Based Access Control (RBAC)**
   - Database role verification on EVERY request
   - Cannot be bypassed through session manipulation
   - Only users with `role = 'admin'` can access
   - Regular users see 403 Forbidden page

3. **Database Validation**
   - Every protected route re-validates admin role from database
   - Session data is NEVER trusted alone
   - Double-check mechanism prevents privilege escalation

### 🔒 Security Headers

- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables browser XSS protection
- **Strict-Transport-Security**: HTTPS enforcement (production)

### 📝 Audit Logging

All security events are logged:
- ✅ Successful admin logins
- ⚠️ Failed login attempts
- ⚠️ Unauthorized access attempts by non-admin users
- 📤 Admin logouts
- 🔄 Role changes
- 🗑️ User/post deletions

## Access Instructions

### Starting the Admin Server

**Terminal 1 - Main Application:**
```bash
npm start
```

**Terminal 2 - Admin Dashboard:**
```bash
npm run admin
```

The admin panel will be available at: **http://localhost:3001/admin/login**

### Login Requirements

- Must have an account in the database
- Account role must be set to `'admin'`
- Valid email and password

### Creating Admin Users

Use the role management script:
```bash
node scripts/change-role.js your@email.com admin
```

## Features

### 📊 Dashboard
- Real-time statistics
- User counts by role
- Online user tracking
- Recent registrations

### 👥 Users Management
- View all users
- Change user roles (user, premium, advertiser, admin)
- Delete users
- View user status and details

### 📝 Posts Management
- View all posts
- Delete inappropriate content
- Monitor user activity

## Security Best Practices

### ✅ DO:
- Use strong, unique passwords for admin accounts
- Log out when finished
- Regularly audit admin accounts
- Monitor access logs
- Use HTTPS in production
- Change default session secrets

### ❌ DON'T:
- Share admin credentials
- Leave admin sessions open
- Use weak passwords
- Access from public/untrusted networks
- Ignore security warnings

## Port Configuration

- **Main Application**: Port 3000
- **Admin Dashboard**: Port 3001 (separate isolation)

Running on different ports provides:
- Process isolation
- Independent session management
- Separate security policies
- Better resource control

## Environment Variables

For production, set:
```bash
ADMIN_SESSION_SECRET=your-super-secret-admin-key-here
```

## Troubleshooting

### Cannot Access Dashboard
1. Verify you're using the correct port (3001)
2. Check your user role: `node scripts/list-users.js`
3. Ensure admin server is running: `npm run admin`

### Access Denied (403)
- Your account role is not 'admin'
- Change role: `node scripts/change-role.js your@email.com admin`
- Log out and log back in

### Unauthorized Access Attempts
All attempts are logged and can be reviewed in the terminal output.

## Production Deployment

For production:
1. Enable HTTPS
2. Set secure environment variables
3. Use strong session secrets
4. Enable `cookie.secure = true`
5. Uncomment HSTS header
6. Use reverse proxy (nginx)
7. Implement rate limiting
8. Add IP whitelisting (optional)

## Support

For security concerns or issues, contact your system administrator.

---

**⚠️ This is a restricted area. All access attempts are logged and monitored.**
