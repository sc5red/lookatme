const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, '..', 'lookatme.db');

// Create SQLite connection
const db = new sqlite3.Database(dbPath);

// Database connection function
async function connectDB() {
  try {
    console.log('Connected to SQLite database');
    
    // Create tables if they don't exist
    await createTables();
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Create necessary tables
async function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          avatar TEXT DEFAULT NULL,
          bio TEXT DEFAULT NULL,
          status TEXT DEFAULT 'offline',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS friends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          friend_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (friend_id) REFERENCES users(id),
          UNIQUE(user_id, friend_id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating tables:', err.message);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    });
  });
}

// Database query functions
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve({ rows });
      }
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ 
          lastID: this.lastID, 
          changes: this.changes 
        });
      }
    });
  });
}

// User-related database functions
const userDB = {
  async create(userData) {
    const { name, email, hashedPassword } = userData;
    const result = await runQuery(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    
    const user = await query('SELECT id, name, email, created_at FROM users WHERE id = ?', [result.lastID]);
    return user.rows[0];
  },

  async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = ?', [email]);
    return result.rows[0];
  },

  async findById(id) {
    const result = await query('SELECT id, name, email, avatar, bio, status, created_at FROM users WHERE id = ?', [id]);
    return result.rows[0];
  },

  async updateStatus(id, status) {
    await runQuery('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    const result = await query('SELECT * FROM users WHERE id = ?', [id]);
    return result.rows[0];
  },

  async getOnlineFriends(userId) {
    const result = await query(`
      SELECT u.id, u.name, u.avatar, u.status 
      FROM users u
      JOIN friends f ON (f.friend_id = u.id OR f.user_id = u.id)
      WHERE (f.user_id = ? OR f.friend_id = ?) 
      AND u.id != ? 
      AND f.status = 'accepted' 
      AND u.status = 'online'
    `, [userId, userId, userId]);
    return result.rows;
  }
};

module.exports = {
  connectDB,
  query,
  runQuery,
  userDB,
  db
};