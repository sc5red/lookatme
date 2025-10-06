// Utility script to list all users and their roles
// Usage: node scripts/list-users.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'lookatme.db');
const db = new sqlite3.Database(dbPath);

console.log('📋 User List\n');
console.log('═'.repeat(80));

db.all('SELECT id, name, email, role, status FROM users ORDER BY id', [], (err, users) => {
  if (err) {
    console.error('Database error:', err);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log('No users found in the database.');
    process.exit(0);
  }

  users.forEach((user, index) => {
    const roleEmoji = {
      'admin': '👑',
      'advertiser': '📢',
      'premium': '⭐',
      'user': '👤'
    };

    const emoji = roleEmoji[user.role] || '👤';
    const role = (user.role || 'user').toUpperCase();

    console.log(`${index + 1}. ${emoji} ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   ID: ${user.id}`);
    console.log('─'.repeat(80));
  });

  console.log(`\nTotal Users: ${users.length}`);
  
  db.close();
});
