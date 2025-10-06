// Utility script to change user roles
// Usage: node scripts/change-role.js <email> <role>
// Roles: user, premium, advertiser, admin

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lookatme.db');
const db = new sqlite3.Database(dbPath);

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log('Usage: node scripts/change-role.js <email> <role>');
  console.log('Available roles: user, premium, advertiser, admin');
  process.exit(1);
}

const [email, role] = args;
const validRoles = ['user', 'premium', 'advertiser', 'admin'];

if (!validRoles.includes(role)) {
  console.error(`Invalid role: ${role}`);
  console.log('Available roles: user, premium, advertiser, admin');
  process.exit(1);
}

// First check if user exists
db.get('SELECT id, name, email, role FROM users WHERE email = ?', [email], (err, user) => {
  if (err) {
    console.error('Database error:', err);
    process.exit(1);
  }

  if (!user) {
    console.error(`User not found with email: ${email}`);
    process.exit(1);
  }

  console.log('Current user info:');
  console.log(`  ID: ${user.id}`);
  console.log(`  Name: ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Current Role: ${user.role || 'user'}`);
  console.log('');

  // Update the role
  db.run('UPDATE users SET role = ? WHERE email = ?', [role, email], function(err) {
    if (err) {
      console.error('Error updating role:', err);
      process.exit(1);
    }

    console.log(`✅ Successfully updated role to: ${role}`);
    console.log(`   User: ${user.name} (${email})`);
    
    db.close();
  });
});
