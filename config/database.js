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
          role TEXT DEFAULT 'user',
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
          // After friends, create posts table
          db.run(`
            CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              content TEXT DEFAULT '',
              image TEXT DEFAULT NULL,
              media_type TEXT DEFAULT NULL,
              media_url TEXT DEFAULT NULL,
              audio_duration TEXT DEFAULT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `, (err2) => {
            if (err2) {
              console.error('Error creating posts table:', err2.message);
              reject(err2);
            } else {
              // Migration: Add new columns to existing table if they don't exist
              db.run(`ALTER TABLE posts ADD COLUMN media_type TEXT DEFAULT NULL`, () => {});
              db.run(`ALTER TABLE posts ADD COLUMN media_url TEXT DEFAULT NULL`, () => {});
              db.run(`ALTER TABLE posts ADD COLUMN audio_duration TEXT DEFAULT NULL`, () => {});
              db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, () => {});
              resolve();
            }
          });
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
    const result = await query('SELECT id, name, email, avatar, bio, status, role, created_at FROM users WHERE id = ?', [id]);
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
  },

  async getFriendSummary(userId) {
    const total = await query(`
      SELECT COUNT(*) as count
      FROM friends
      WHERE status='accepted' AND (user_id = ? OR friend_id = ?)
    `, [userId, userId]);
    const online = await query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN friends f ON (f.friend_id = u.id OR f.user_id = u.id)
      WHERE (f.user_id = ? OR f.friend_id = ?) 
        AND u.id != ?
        AND f.status='accepted'
        AND u.status='online'
    `, [userId, userId, userId]);
    return { total: total.rows[0]?.count || 0, online: online.rows[0]?.count || 0 };
  },

  async listFriends(userId, searchTerm) {
    const like = searchTerm ? `%${searchTerm.toLowerCase()}%` : null;
    const sql = `
      SELECT DISTINCT u.id, u.name, u.avatar, u.status,
        CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END as relation_id
      FROM users u
      JOIN friends f ON ( (f.user_id = ? AND f.friend_id = u.id) OR (f.friend_id = ? AND f.user_id = u.id) )
      WHERE f.status='accepted'
        ${like ? 'AND lower(u.name) LIKE ?' : ''}
      ORDER BY lower(u.name) ASC
      LIMIT 200
    `;
    const params = like ? [userId, userId, userId, like] : [userId, userId, userId];
    const result = await query(sql, params);
    return result.rows;
  },

  async searchUsersExcludingExisting(userId, term) {
    const like = `%${term.toLowerCase()}%`;
    const result = await query(`
      SELECT u.id, u.name, u.avatar, u.status,
        CASE 
          WHEN f.status IS NULL THEN 'none'
          ELSE f.status
        END as friend_status
      FROM users u
      LEFT JOIN friends f ON (
        (f.user_id = ? AND f.friend_id = u.id) OR 
        (f.friend_id = ? AND f.user_id = u.id)
      )
      WHERE u.id != ?
        AND lower(u.name) LIKE ?
      ORDER BY lower(u.name) ASC
      LIMIT 50
    `, [userId, userId, userId, like]);
    return result.rows;
  },

  async sendFriendRequest(userId, targetId) {
    if (userId === targetId) return { error: 'Cannot add yourself' };
    try {
      await runQuery(`INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')`, [userId, targetId]);
      return { success: true };
    } catch (e) {
      return { error: 'Failed to send request' };
    }
  },

  async acceptFriendRequest(userId, fromUserId) {
    try {
      await runQuery(`UPDATE friends SET status='accepted' WHERE user_id = ? AND friend_id = ? AND status='pending'`, [fromUserId, userId]);
      return { success: true };
    } catch (e) {
      return { error: 'Failed to accept request' };
    }
  },

  async getPendingRequests(userId) {
    // Incoming requests: where current user is target (friend_id)
    const incoming = await query(`
      SELECT f.user_id as fromUserId, u.name, u.status
      FROM friends f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status='pending'
      ORDER BY f.created_at DESC
      LIMIT 100
    `, [userId]);
    // Outgoing requests: where current user initiated (user_id)
    const outgoing = await query(`
      SELECT f.friend_id as toUserId, u.name, u.status
      FROM friends f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status='pending'
      ORDER BY f.created_at DESC
      LIMIT 100
    `, [userId]);
    return { incoming: incoming.rows, outgoing: outgoing.rows };
  },

  async getPendingCount(userId) {
    const inc = await query(`SELECT COUNT(*) as count FROM friends WHERE friend_id = ? AND status='pending'`, [userId]);
    const out = await query(`SELECT COUNT(*) as count FROM friends WHERE user_id = ? AND status='pending'`, [userId]);
    return { incoming: inc.rows[0]?.count || 0, outgoing: out.rows[0]?.count || 0 };
  }
};

module.exports = {
  connectDB,
  query,
  runQuery,
  userDB,
  postsDB: {
    async create(userId, { content='', image=null, mediaType=null, mediaUrl=null, audioDuration=null }) {
      const result = await runQuery(
        `INSERT INTO posts (user_id, content, image, media_type, media_url, audio_duration) VALUES (?, ?, ?, ?, ?, ?)`, 
        [userId, content, image, mediaType, mediaUrl, audioDuration]
      );
      const row = await query(
        `SELECT p.id, p.content, p.image, p.media_type as mediaType, p.media_url as mediaUrl, p.audio_duration as audioDuration, p.created_at as createdAt, u.name, u.avatar, u.role, u.id as userId 
         FROM posts p 
         JOIN users u ON u.id = p.user_id 
         WHERE p.id = ?`, 
        [result.lastID]
      );
      return row.rows[0];
    },
    async listForUserAndFriends(userId, { limit=50, offset=0 } = {}) {
      const rows = await query(`
        SELECT p.id, p.content, p.image, p.media_type as mediaType, p.media_url as mediaUrl, p.audio_duration as audioDuration, p.created_at as createdAt, u.name, u.avatar, u.role, u.id as userId
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ? OR p.user_id IN (
          SELECT CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
          FROM friends f
          WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status='accepted'
        )
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `, [userId, userId, userId, userId, limit, offset]);
      return rows.rows;
    }
  },
  db
};