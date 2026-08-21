const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'my_videos_super_secret_jwt_key_2026';

// Initialize Admin User on server start
db.initSeedAdmin();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to parse Video URL
function parseVideoUrl(inputUrl) {
  let url = inputUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const ytMatch = url.match(ytRegExp);

  if (ytMatch && ytMatch[2].length === 11) {
    const videoId = ytMatch[2];
    return {
      url: url,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
      embedType: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };
  }

  const vimeoRegExp = /https?:\/\/(www\.)?vimeo\.com\/(\d+)/;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch && vimeoMatch[2]) {
    const videoId = vimeoMatch[2];
    return {
      url: url,
      embedUrl: `https://player.vimeo.com/video/${videoId}?autoplay=1`,
      embedType: 'vimeo',
      thumbnailUrl: `https://vumbnail.com/${videoId}.jpg`
    };
  }

  return {
    url: url,
    embedUrl: url,
    embedType: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80'
  };
}

// Authentication Middleware with Blocked User Check
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Please log in or sign up to view videos.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const user = db.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked by Admin. Please contact support.' });
    }

    req.user = user;
    next();
  });
}

// Admin authorization Middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin can access Admin Panel.' });
  }
  next();
}

// --- AUTH, OTP & FORGOT PASSWORD ROUTES ---

// Send OTP for Signup
app.post('/api/auth/send-otp', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 6) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const cleanPhone = phone.trim();
    const code = db.generateOtp(cleanPhone);

    console.log(`📱 [MOBILE OTP SENT] To: ${cleanPhone} | Code: ${code}`);

    res.json({
      message: `OTP sent to ${cleanPhone}`,
      phone: cleanPhone,
      demoOtp: code
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// Forgot Password - Request OTP by Username or Phone Number
app.post('/api/auth/forgot-password-otp', (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: 'Username or Mobile Phone Number is required.' });
    }

    const user = db.getUserByIdentifier(identifier);
    if (!user) {
      return res.status(404).json({ error: `Account '${identifier.trim()}' not found. Please check spelling or click Sign Up to create an account.` });
    }

    const phoneToUse = user.phone || '+10000000000';
    const code = db.generateOtp(phoneToUse);

    console.log(`🔑 [FORGOT PASSWORD OTP SENT] User: ${user.username} | Phone: ${phoneToUse} | Code: ${code}`);

    res.json({
      message: `OTP sent to registered mobile (${phoneToUse})`,
      userId: user.id,
      username: user.username,
      phone: phoneToUse,
      demoOtp: code
    });
  } catch (err) {
    console.error('Forgot password OTP error:', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// Forgot Password - Reset Password with OTP
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;

    if (!userId || !otp || !newPassword) {
      return res.status(400).json({ error: 'All fields (User ID, OTP code, and New Password) are required.' });
    }

    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const phoneToVerify = user.phone || '+10000000000';
    const isValidOtp = db.verifyOtp(phoneToVerify, otp.trim());

    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP verification code.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword.trim(), salt);

    db.resetUserPassword(user.id, passwordHash);

    res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Signup Endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, phone, password, otp } = req.body;

    if (!username || !email || !phone || !password || !otp) {
      return res.status(400).json({ error: 'All fields (Username, Email, Phone, Password, and OTP) are mandatory.' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    if (db.getUserByUsername(cleanUsername)) {
      return res.status(400).json({ error: 'Username is already registered.' });
    }

    if (db.getUserByEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Email ID is already registered.' });
    }

    if (db.getUserByPhone(cleanPhone)) {
      return res.status(400).json({ error: 'Phone number is already registered.' });
    }

    const isValidOtp = db.verifyOtp(cleanPhone, otp.trim());
    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP code. Please request a new OTP.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.createUser({
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash,
      role: 'user'
    });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created and verified successfully!',
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, phone: newUser.phone, role: newUser.role }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

// Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanInput = username.trim();
    const user = db.getUserByIdentifier(cleanInput);

    if (!user) {
      return res.status(400).json({ error: `Account '${cleanInput}' not found. Please check spelling or Sign Up to create an account.` });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked by Admin. Access denied.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password. Please try again or click Forgot Password.' });
    }

    const userRole = user.role || 'user';

    const token = jwt.sign(
      { id: user.id, username: user.username, role: userRole },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, username: user.username, email: user.email, phone: user.phone, role: userRole }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get Current User Info Endpoint
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, email: req.user.email, phone: req.user.phone, role: req.user.role || 'user' } });
});


// --- ADMIN PANEL ROUTES ---

// GET All Registered Users Details (ADMIN ONLY)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.getAllUsersForAdmin();
    res.json(users);
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Failed to fetch user list.' });
  }
});

// Block / Unblock User (ADMIN ONLY)
app.post('/api/admin/users/:id/block', authenticateToken, requireAdmin, (req, res) => {
  try {
    const targetUserId = req.params.id;
    const updatedUser = db.toggleBlockUser(targetUserId);

    if (!updatedUser) {
      return res.status(400).json({ error: 'User not found or cannot block Admin account.' });
    }

    const statusText = updatedUser.isBlocked ? 'blocked' : 'unblocked';
    res.json({ message: `User ${updatedUser.username} has been ${statusText}.`, user: updatedUser });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to update user block status.' });
  }
});

// Delete User Account (ADMIN ONLY)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const targetUserId = req.params.id;
    const deletedUser = db.deleteUser(targetUserId);

    if (!deletedUser) {
      return res.status(400).json({ error: 'User not found or cannot delete Admin account.' });
    }

    res.json({ message: `User account ${deletedUser.username} deleted successfully.`, userId: targetUserId });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

// Update Admin Username & Password (ADMIN ONLY)
app.put('/api/admin/credentials', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to update credentials.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    let newHash = null;
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      newHash = await bcrypt.hash(newPassword.trim(), salt);
    }

    if (newUsername && newUsername.trim().toLowerCase() !== req.user.username.toLowerCase()) {
      const existing = db.getUserByUsername(newUsername.trim());
      if (existing) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }
    }

    const updatedAdmin = await db.updateAdminCredentials(req.user.id, newUsername, newHash);

    const newToken = jwt.sign(
      { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin credentials updated successfully!',
      token: newToken,
      user: { id: updatedAdmin.id, username: updatedAdmin.username, role: updatedAdmin.role }
    });
  } catch (err) {
    console.error('Update admin credentials error:', err);
    res.status(500).json({ error: 'Failed to update Admin credentials.' });
  }
});


// --- VIDEO ROUTES ---

// GET Videos List (REQUIRES AUTH)
app.get('/api/videos', authenticateToken, (req, res) => {
  try {
    const { q, category } = req.query;
    const videos = db.getVideos(q, category);
    res.json(videos);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos.' });
  }
});

// POST New Video Link (ADMIN ONLY)
app.post('/api/videos', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { title, url, description, category, thumbnailUrl } = req.body;

    if (!title || !url) {
      return res.status(400).json({ error: 'Video title and video URL are required.' });
    }

    const parsed = parseVideoUrl(url);

    const newVideo = db.addVideo({
      title: title.trim(),
      url: parsed.url,
      embedUrl: parsed.embedUrl,
      embedType: parsed.embedType,
      thumbnailUrl: thumbnailUrl && thumbnailUrl.trim() ? thumbnailUrl.trim() : parsed.thumbnailUrl,
      description: description ? description.trim() : '',
      category: category || 'General',
      uploaderId: req.user.id,
      uploaderName: req.user.username
    });

    res.status(201).json({
      message: 'Video published successfully!',
      video: newVideo
    });
  } catch (err) {
    console.error('Error uploading video:', err);
    res.status(500).json({ error: 'Failed to publish video.' });
  }
});

// DELETE Video (ADMIN ONLY)
app.delete('/api/videos/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const videoId = req.params.id;
    const deleted = db.deleteVideo(videoId, req.user);

    if (!deleted) {
      return res.status(404).json({ error: 'Video not found or already deleted.' });
    }

    res.json({ message: 'Video deleted successfully!', videoId });
  } catch (err) {
    console.error('Error deleting video:', err);
    res.status(500).json({ error: 'Failed to delete video.' });
  }
});

// Fallback to serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🎬 MY VIDEOS server running at http://localhost:${PORT}`);
  console.log(`=================================================`);
});
