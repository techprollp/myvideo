const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

// Turso Cloud Database Configuration
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://myvideo-shareef123.aws-us-east-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODczMTE5OTYsImlkIjoiMDFhMDI0MTgtOWIwMS03NTk1LWFkZTctYzZhNDMzOWQ0OTA1Iiwia2lkIjoiY0FYMDhoMU9mc0Nyc3lra3JYOGNNUmYzWnhQOEFSa1lhNkdjb2FnQnlFVSIsInJpZCI6IjA5MTUxYTg1LTRlYWUtNGE3OS05MTFlLTViYjM5YzA0Nzg0YyJ9.TLieDAQSWLzec0Ed9UzPkMl6OXVP3PO29IFyOC0s7AFttgICwYwwm22521Ujf_Hq5DWh9wdKraodaXJZD5XRDg';

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize Turso Client
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

const defaultVideos = [
  {
    id: "vid_seed_1",
    title: "Big Buck Bunny - Animated Short Film",
    url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    embedUrl: "https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&enablejsapi=1",
    embedType: "youtube",
    thumbnailUrl: "https://img.youtube.com/vi/aqz-KE-bpKQ/maxresdefault.jpg",
    description: "Classic open-source animated short film created by the Blender Institute.",
    category: "Animation",
    uploaderId: "admin_1",
    uploaderName: "admin",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: "vid_seed_2",
    title: "Tears of Steel - Sci-Fi Short",
    url: "https://www.youtube.com/watch?v=r6Lie3sI072",
    embedUrl: "https://www.youtube.com/embed/r6Lie3sI072?autoplay=1&enablejsapi=1",
    embedType: "youtube",
    thumbnailUrl: "https://img.youtube.com/vi/r6Lie3sI072/maxresdefault.jpg",
    description: "Visual effects open movie project set in dystopian Amsterdam.",
    category: "Sci-Fi",
    uploaderId: "admin_1",
    uploaderName: "admin",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: "vid_seed_3",
    title: "Nature Wildlife & Forest Streams (Direct MP4)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    embedUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    embedType: "video",
    thumbnailUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
    description: "High definition nature footage streaming directly via standard MP4 link.",
    category: "Nature",
    uploaderId: "admin_1",
    uploaderName: "admin",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: "vid_seed_4",
    title: "Sintel - Fantasy Quest",
    url: "https://www.youtube.com/watch?v=eRsGyueVLvQ",
    embedUrl: "https://www.youtube.com/embed/eRsGyueVLvQ?autoplay=1&enablejsapi=1",
    embedType: "youtube",
    thumbnailUrl: "https://img.youtube.com/vi/eRsGyueVLvQ/maxresdefault.jpg",
    description: "An epic dragon fantasy story produced by Blender Foundation.",
    category: "Fantasy",
    uploaderId: "admin_1",
    uploaderName: "admin",
    createdAt: new Date().toISOString()
  }
];

// Initialize Turso Cloud Schema & Seed Data
async function initSeedAdmin() {
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT,
        phone TEXT,
        passwordHash TEXT,
        role TEXT,
        isBlocked INTEGER DEFAULT 0,
        createdAt TEXT
      );
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        url TEXT,
        embedUrl TEXT,
        embedType TEXT,
        thumbnailUrl TEXT,
        description TEXT,
        category TEXT,
        uploaderId TEXT,
        uploaderName TEXT,
        createdAt TEXT
      );
    `);

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS otps (
        phone TEXT PRIMARY KEY,
        code TEXT,
        expiresAt INTEGER
      );
    `);

    // Check if seed admin exists
    const adminCheck = await turso.execute("SELECT * FROM users WHERE role = 'admin' OR username = 'admin' LIMIT 1;");
    if (adminCheck.rows.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await turso.execute({
        sql: "INSERT INTO users (id, username, email, phone, passwordHash, role, isBlocked, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?);",
        args: ['admin_1', 'admin', 'admin@myvideos.com', '+10000000000', passwordHash, 'admin', new Date().toISOString()]
      });
      console.log("🔑 Default Admin seeded in Turso Cloud Database: 'admin' / 'admin123'");
    }

    // Seed initial videos if empty
    const videoCheck = await turso.execute("SELECT COUNT(*) as count FROM videos;");
    if (videoCheck.rows[0].count === 0) {
      for (const v of defaultVideos) {
        await turso.execute({
          sql: "INSERT INTO videos (id, title, url, embedUrl, embedType, thumbnailUrl, description, category, uploaderId, uploaderName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
          args: [v.id, v.title, v.url, v.embedUrl, v.embedType, v.thumbnailUrl, v.description, v.category, v.uploaderId, v.uploaderName, v.createdAt]
        });
      }
      console.log("📹 Seed videos inserted into Turso Cloud Database!");
    }

    console.log("⚡ Turso Cloud Database Schema & Connection Ready!");
  } catch (err) {
    console.error("Turso init error:", err);
  }
}

// Database Layer Implementation (Turso Primary + Async Cloud Sync)
const db = {
  initSeedAdmin,

  // OTP Management
  generateOtp: async (phone) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    try {
      await turso.execute({
        sql: "INSERT OR REPLACE INTO otps (phone, code, expiresAt) VALUES (?, ?, ?);",
        args: [phone.trim(), code, expiresAt]
      });
    } catch (e) {
      console.error("OTP cloud save error:", e);
    }
    return code;
  },

  verifyOtp: async (phone, code) => {
    try {
      const res = await turso.execute({
        sql: "SELECT * FROM otps WHERE phone = ?;",
        args: [phone.trim()]
      });

      if (res.rows.length === 0) return false;
      const record = res.rows[0];

      if (Date.now() > record.expiresAt) {
        await turso.execute({ sql: "DELETE FROM otps WHERE phone = ?;", args: [phone.trim()] });
        return false;
      }

      if (record.code === code.trim()) {
        await turso.execute({ sql: "DELETE FROM otps WHERE phone = ?;", args: [phone.trim()] });
        return true;
      }
      return false;
    } catch (e) {
      console.error("OTP verification error:", e);
      return false;
    }
  },

  getUsers: async () => {
    const res = await turso.execute("SELECT * FROM users;");
    return res.rows.map(mapUserRow);
  },

  getAllUsersForAdmin: async () => {
    const res = await turso.execute("SELECT id, username, email, phone, role, isBlocked, createdAt FROM users;");
    return res.rows.map(r => ({
      id: r.id,
      username: r.username,
      email: r.email || 'N/A',
      phone: r.phone || 'N/A',
      role: r.role || 'user',
      isBlocked: !!r.isBlocked,
      createdAt: r.createdAt
    }));
  },

  getUserByUsername: async (username) => {
    const res = await turso.execute({
      sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?);",
      args: [username.trim()]
    });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  getUserByEmail: async (email) => {
    const res = await turso.execute({
      sql: "SELECT * FROM users WHERE LOWER(email) = LOWER(?);",
      args: [email.trim()]
    });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  getUserByPhone: async (phone) => {
    const res = await turso.execute({
      sql: "SELECT * FROM users WHERE phone = ?;",
      args: [phone.trim()]
    });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  getUserByIdentifier: async (identifier) => {
    const clean = identifier.trim().toLowerCase();
    const digits = identifier.replace(/\D/g, '');

    const allUsersRes = await turso.execute("SELECT * FROM users;");
    const users = allUsersRes.rows.map(mapUserRow);

    return users.find(u => {
      const uPhoneDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
      return (
        u.username.toLowerCase() === clean || 
        (u.email && u.email.toLowerCase() === clean) ||
        (u.phone && u.phone.toLowerCase() === clean) ||
        (digits.length >= 5 && uPhoneDigits && uPhoneDigits.endsWith(digits))
      );
    }) || null;
  },

  getUserById: async (id) => {
    const res = await turso.execute({
      sql: "SELECT * FROM users WHERE id = ?;",
      args: [id]
    });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  createUser: async ({ username, email, phone, passwordHash, role = 'user' }) => {
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      username: username.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      passwordHash,
      role,
      isBlocked: false,
      createdAt: new Date().toISOString()
    };

    await turso.execute({
      sql: "INSERT INTO users (id, username, email, phone, passwordHash, role, isBlocked, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?);",
      args: [newUser.id, newUser.username, newUser.email, newUser.phone, newUser.passwordHash, newUser.role, newUser.createdAt]
    });

    return newUser;
  },

  resetUserPassword: async (userId, newPasswordHash) => {
    await turso.execute({
      sql: "UPDATE users SET passwordHash = ? WHERE id = ?;",
      args: [newPasswordHash, userId]
    });
    const res = await turso.execute({ sql: "SELECT * FROM users WHERE id = ?;", args: [userId] });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  updateAdminCredentials: async (adminId, newUsername, newPasswordHash) => {
    if (newUsername && newPasswordHash) {
      await turso.execute({
        sql: "UPDATE users SET username = ?, passwordHash = ? WHERE id = ? AND role = 'admin';",
        args: [newUsername.trim(), newPasswordHash, adminId]
      });
    } else if (newUsername) {
      await turso.execute({
        sql: "UPDATE users SET username = ? WHERE id = ? AND role = 'admin';",
        args: [newUsername.trim(), adminId]
      });
    } else if (newPasswordHash) {
      await turso.execute({
        sql: "UPDATE users SET passwordHash = ? WHERE id = ? AND role = 'admin';",
        args: [newPasswordHash, adminId]
      });
    }

    const res = await turso.execute({ sql: "SELECT * FROM users WHERE id = ?;", args: [adminId] });
    return res.rows.length > 0 ? mapUserRow(res.rows[0]) : null;
  },

  toggleBlockUser: async (userId) => {
    const userRes = await turso.execute({ sql: "SELECT * FROM users WHERE id = ?;", args: [userId] });
    if (userRes.rows.length === 0) return null;
    const user = mapUserRow(userRes.rows[0]);
    if (user.role === 'admin') return null;

    const newBlockedStatus = user.isBlocked ? 0 : 1;
    await turso.execute({
      sql: "UPDATE users SET isBlocked = ? WHERE id = ?;",
      args: [newBlockedStatus, userId]
    });

    user.isBlocked = !!newBlockedStatus;
    return user;
  },

  deleteUser: async (userId) => {
    const userRes = await turso.execute({ sql: "SELECT * FROM users WHERE id = ? AND role != 'admin';", args: [userId] });
    if (userRes.rows.length === 0) return null;

    const user = mapUserRow(userRes.rows[0]);
    await turso.execute({ sql: "DELETE FROM users WHERE id = ?;", args: [userId] });
    return user;
  },

  getVideos: async (query = '', category = '') => {
    let sql = "SELECT * FROM videos";
    const conditions = [];
    const args = [];

    if (query) {
      conditions.push("(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(uploaderName) LIKE ?)");
      const q = `%${query.toLowerCase()}%`;
      args.push(q, q, q);
    }

    if (category && category !== 'All') {
      conditions.push("LOWER(category) = LOWER(?)");
      args.push(category);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY createdAt DESC;";

    const res = await turso.execute({ sql, args });
    return res.rows.map(mapVideoRow);
  },

  getVideoById: async (id) => {
    const res = await turso.execute({ sql: "SELECT * FROM videos WHERE id = ?;", args: [id] });
    return res.rows.length > 0 ? mapVideoRow(res.rows[0]) : null;
  },

  addVideo: async (videoData) => {
    const newVideo = {
      id: 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: videoData.title,
      url: videoData.url,
      embedUrl: videoData.embedUrl,
      embedType: videoData.embedType,
      thumbnailUrl: videoData.thumbnailUrl || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80',
      description: videoData.description || '',
      category: videoData.category || 'General',
      uploaderId: videoData.uploaderId,
      uploaderName: videoData.uploaderName,
      createdAt: new Date().toISOString()
    };

    await turso.execute({
      sql: "INSERT INTO videos (id, title, url, embedUrl, embedType, thumbnailUrl, description, category, uploaderId, uploaderName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
      args: [newVideo.id, newVideo.title, newVideo.url, newVideo.embedUrl, newVideo.embedType, newVideo.thumbnailUrl, newVideo.description, newVideo.category, newVideo.uploaderId, newVideo.uploaderName, newVideo.createdAt]
    });

    return newVideo;
  },

  deleteVideo: async (id, requesterUser) => {
    let checkSql = "SELECT * FROM videos WHERE id = ?;";
    const args = [id];

    if (requesterUser.role !== 'admin') {
      checkSql = "SELECT * FROM videos WHERE id = ? AND uploaderId = ?;";
      args.push(requesterUser.id);
    }

    const res = await turso.execute({ sql: checkSql, args });
    if (res.rows.length === 0) return null;

    const video = mapVideoRow(res.rows[0]);
    await turso.execute({ sql: "DELETE FROM videos WHERE id = ?;", args: [id] });
    return video;
  }
};

function mapUserRow(r) {
  return {
    id: r.id,
    username: r.username,
    email: r.email || '',
    phone: r.phone || '',
    passwordHash: r.passwordHash,
    role: r.role || 'user',
    isBlocked: !!r.isBlocked,
    createdAt: r.createdAt
  };
}

function mapVideoRow(r) {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    embedUrl: r.embedUrl,
    embedType: r.embedType,
    thumbnailUrl: r.thumbnailUrl,
    description: r.description || '',
    category: r.category || 'General',
    uploaderId: r.uploaderId,
    uploaderName: r.uploaderName,
    createdAt: r.createdAt
  };
}

module.exports = db;
