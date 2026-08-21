const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data.json');

const otpStore = {};

const defaultData = {
  users: [],
  videos: [
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
  ]
};

function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      saveDb(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.users) data.users = [];
    if (!data.videos) data.videos = [];
    return data;
  } catch (err) {
    console.error("Error reading database file, using fallback", err);
    return defaultData;
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Seed default Admin user if none exists
async function initSeedAdmin() {
  const data = loadDb();
  let adminUser = data.users.find(u => u.role === 'admin' || u.username.toLowerCase() === 'admin');
  
  if (!adminUser) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    adminUser = {
      id: 'admin_1',
      username: 'admin',
      email: 'admin@myvideos.com',
      phone: '+10000000000',
      passwordHash: passwordHash,
      role: 'admin',
      isBlocked: false,
      createdAt: new Date().toISOString()
    };
    data.users.unshift(adminUser);
    saveDb(data);
    console.log("🔑 Default Admin Account initialized: username 'admin'");
  } else {
    if (!adminUser.email) adminUser.email = 'admin@myvideos.com';
    if (!adminUser.phone) adminUser.phone = '+10000000000';
    if (!adminUser.role) adminUser.role = 'admin';
    if (adminUser.isBlocked === undefined) adminUser.isBlocked = false;
    saveDb(data);
  }
}

const db = {
  initSeedAdmin,
  
  // OTP Management
  generateOtp: (phone) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[phone] = {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    };
    return code;
  },

  verifyOtp: (phone, code) => {
    const record = otpStore[phone];
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      delete otpStore[phone];
      return false;
    }
    if (record.code === code.trim()) {
      delete otpStore[phone];
      return true;
    }
    return false;
  },

  getUsers: () => {
    return loadDb().users;
  },

  getAllUsersForAdmin: () => {
    const users = loadDb().users;
    return users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email || 'N/A',
      phone: u.phone || 'N/A',
      role: u.role || 'user',
      isBlocked: !!u.isBlocked,
      createdAt: u.createdAt
    }));
  },

  getUserByUsername: (username) => {
    const data = loadDb();
    return data.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  },

  getUserByEmail: (email) => {
    const data = loadDb();
    return data.users.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  },

  getUserByPhone: (phone) => {
    const data = loadDb();
    const cleanDigits = phone.replace(/\D/g, '');
    return data.users.find(u => {
      const dbPhoneDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
      return u.phone === phone.trim() || (cleanDigits && dbPhoneDigits && dbPhoneDigits === cleanDigits);
    });
  },

  getUserByIdentifier: (identifier) => {
    const data = loadDb();
    const clean = identifier.trim().toLowerCase();
    const digits = identifier.replace(/\D/g, '');

    return data.users.find(u => {
      const uPhoneDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
      return (
        u.username.toLowerCase() === clean || 
        (u.email && u.email.toLowerCase() === clean) ||
        (u.phone && u.phone.toLowerCase() === clean) ||
        (digits.length >= 5 && uPhoneDigits && uPhoneDigits.endsWith(digits))
      );
    });
  },

  getUserById: (id) => {
    const data = loadDb();
    return data.users.find(u => u.id === id);
  },

  createUser: ({ username, email, phone, passwordHash, role = 'user' }) => {
    const data = loadDb();
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
    data.users.push(newUser);
    saveDb(data);
    return newUser;
  },

  resetUserPassword: (userId, newPasswordHash) => {
    const data = loadDb();
    const user = data.users.find(u => u.id === userId);
    if (!user) return null;

    user.passwordHash = newPasswordHash;
    saveDb(data);
    return user;
  },

  updateAdminCredentials: async (adminId, newUsername, newPasswordHash) => {
    const data = loadDb();
    const adminUser = data.users.find(u => u.id === adminId && u.role === 'admin');
    if (!adminUser) return null;

    if (newUsername) adminUser.username = newUsername.trim();
    if (newPasswordHash) adminUser.passwordHash = newPasswordHash;

    saveDb(data);
    return adminUser;
  },

  toggleBlockUser: (userId) => {
    const data = loadDb();
    const user = data.users.find(u => u.id === userId);
    if (!user || user.role === 'admin') return null;

    user.isBlocked = !user.isBlocked;
    saveDb(data);
    return user;
  },

  deleteUser: (userId) => {
    const data = loadDb();
    const idx = data.users.findIndex(u => u.id === userId && u.role !== 'admin');
    if (idx !== -1) {
      const deleted = data.users.splice(idx, 1);
      saveDb(data);
      return deleted[0];
    }
    return null;
  },

  getVideos: (query = '', category = '') => {
    const data = loadDb();
    let videos = [...data.videos];

    if (query) {
      const q = query.toLowerCase();
      videos = videos.filter(v => 
        v.title.toLowerCase().includes(q) || 
        v.description.toLowerCase().includes(q) ||
        v.uploaderName.toLowerCase().includes(q)
      );
    }

    if (category && category !== 'All') {
      videos = videos.filter(v => v.category.toLowerCase() === category.toLowerCase());
    }

    return videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getVideoById: (id) => {
    const data = loadDb();
    return data.videos.find(v => v.id === id);
  },

  addVideo: (videoData) => {
    const data = loadDb();
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
    data.videos.unshift(newVideo);
    saveDb(data);
    return newVideo;
  },

  deleteVideo: (id, requesterUser) => {
    const data = loadDb();
    let idx = -1;
    if (requesterUser.role === 'admin') {
      idx = data.videos.findIndex(v => v.id === id);
    } else {
      idx = data.videos.findIndex(v => v.id === id && v.uploaderId === requesterUser.id);
    }

    if (idx !== -1) {
      const deleted = data.videos.splice(idx, 1);
      saveDb(data);
      return deleted[0];
    }
    return null;
  }
};

module.exports = db;
