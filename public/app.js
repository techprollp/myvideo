/* ==========================================================================
   MY VIDEOS PLATFORM - DUAL-MODE CLIENT JAVASCRIPT
   Supports both Express Node.js Server API & Standalone HTML/CSS/JS Browser Mode
   ========================================================================== */

const API_BASE = '/api';

// Global Application State
let currentUser = null;
let token = localStorage.getItem('my_videos_token') || null;
let allVideos = [];
let adminUsersList = [];
let activeCategory = 'All';
let searchQuery = '';
let currentPlayingVideo = null;
let isAudioMuted = false;
let forgotPasswordUserId = null;

// Standalone LocalStorage Database (Used if running without Node.js server or file://)
const STANDALONE_KEY = 'my_videos_standalone_db_2026';
const defaultStandaloneData = {
  users: [
    {
      id: 'admin_1',
      username: 'admin',
      email: 'admin@myvideos.com',
      phone: '+10000000000',
      password: 'admin123',
      role: 'admin',
      isBlocked: false,
      createdAt: new Date().toISOString()
    }
  ],
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
  ],
  otps: {}
};

function getLocalData() {
  try {
    const raw = localStorage.getItem(STANDALONE_KEY);
    if (!raw) {
      localStorage.setItem(STANDALONE_KEY, JSON.stringify(defaultStandaloneData));
      return defaultStandaloneData;
    }
    return JSON.parse(raw);
  } catch (e) {
    return defaultStandaloneData;
  }
}

function saveLocalData(data) {
  localStorage.setItem(STANDALONE_KEY, JSON.stringify(data));
}

// Universal API Dispatcher (Tries Server Endpoint, Falls Back to Standalone LocalStorage DB)
async function requestApi(endpoint, method = 'GET', body = null, authToken = null) {
  const isFileProtocol = window.location.protocol === 'file:';
  
  if (!isFileProtocol) {
    try {
      const headers = {};
      if (body) headers['Content-Type'] = 'application/json';
      if (authToken || token) headers['Authorization'] = `Bearer ${authToken || token}`;

      const options = { method, headers };
      if (body) options.body = JSON.stringify(body);

      const res = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await res.json();

      if (res.ok) return { ok: true, data, status: res.status };
      return { ok: false, error: data.error || 'Request failed.', status: res.status };
    } catch (err) {
      console.warn("Backend server not reachable, switching to Standalone HTML/CSS/JS mode...", err);
    }
  }

  // --- STANDALONE BROWSER LOCALSTORAGE FALLBACK ---
  const dbData = getLocalData();

  if (endpoint === '/auth/me') {
    if (!authToken && !token) return { ok: false, error: 'No token provided.', status: 401 };
    const savedUser = JSON.parse(localStorage.getItem('my_videos_saved_user') || 'null');
    if (!savedUser) return { ok: false, error: 'Session expired.', status: 401 };

    const freshUser = dbData.users.find(u => u.id === savedUser.id);
    if (!freshUser) return { ok: false, error: 'User deleted.', status: 401 };
    if (freshUser.isBlocked) return { ok: false, error: 'Your account has been blocked by Admin.', status: 403 };

    return { ok: true, data: { user: freshUser }, status: 200 };
  }

  if (endpoint === '/auth/send-otp') {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    dbData.otps[body.phone] = code;
    saveLocalData(dbData);
    return { ok: true, data: { message: `OTP sent to ${body.phone}`, phone: body.phone, demoOtp: code }, status: 200 };
  }

  if (endpoint === '/auth/signup') {
    const { username, email, phone, password, otp } = body;
    if (dbData.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      return { ok: false, error: 'Username is already registered.', status: 400 };
    }
    if (dbData.otps[phone] && dbData.otps[phone] !== otp.trim()) {
      return { ok: false, error: 'Invalid OTP verification code.', status: 400 };
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      username: username.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password: password,
      role: 'user',
      isBlocked: false,
      createdAt: new Date().toISOString()
    };
    dbData.users.push(newUser);
    saveLocalData(dbData);

    const fakeToken = 'standalone_token_' + newUser.id;
    localStorage.setItem('my_videos_saved_user', JSON.stringify(newUser));
    return { ok: true, data: { message: 'Account created!', token: fakeToken, user: newUser }, status: 201 };
  }

  if (endpoint === '/auth/login') {
    const { username, password } = body;
    const clean = username.trim().toLowerCase();
    const user = dbData.users.find(u => 
      u.username.toLowerCase() === clean || 
      (u.email && u.email.toLowerCase() === clean) ||
      (u.phone && u.phone === username.trim())
    );

    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid login credentials.', status: 400 };
    }

    if (user.isBlocked) {
      return { ok: false, error: 'Your account has been blocked by Admin.', status: 403 };
    }

    const fakeToken = 'standalone_token_' + user.id;
    localStorage.setItem('my_videos_saved_user', JSON.stringify(user));
    return { ok: true, data: { message: 'Logged in!', token: fakeToken, user }, status: 200 };
  }

  if (endpoint.startsWith('/videos') && method === 'GET') {
    let videos = [...dbData.videos];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      videos = videos.filter(v => v.title.toLowerCase().includes(q) || v.uploaderName.toLowerCase().includes(q));
    }
    if (activeCategory && activeCategory !== 'All') {
      videos = videos.filter(v => v.category.toLowerCase() === activeCategory.toLowerCase());
    }
    return { ok: true, data: videos.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)), status: 200 };
  }

  if (endpoint === '/videos' && method === 'POST') {
    if (!currentUser || currentUser.role !== 'admin') {
      return { ok: false, error: 'Only Admin can upload videos.', status: 403 };
    }
    const parsed = parseVideoUrl(body.url);
    const newVid = {
      id: 'vid_' + Date.now(),
      title: body.title,
      url: parsed.url,
      embedUrl: parsed.embedUrl,
      embedType: parsed.embedType,
      thumbnailUrl: body.thumbnailUrl || parsed.thumbnailUrl,
      description: body.description || '',
      category: body.category || 'General',
      uploaderId: currentUser.id,
      uploaderName: currentUser.username,
      createdAt: new Date().toISOString()
    };
    dbData.videos.unshift(newVid);
    saveLocalData(dbData);
    return { ok: true, data: { message: 'Video published!', video: newVid }, status: 201 };
  }

  if (endpoint.startsWith('/videos/') && method === 'DELETE') {
    const vidId = endpoint.replace('/videos/', '');
    const idx = dbData.videos.findIndex(v => v.id === vidId);
    if (idx !== -1) {
      dbData.videos.splice(idx, 1);
      saveLocalData(dbData);
      return { ok: true, data: { message: 'Video deleted!' }, status: 200 };
    }
    return { ok: false, error: 'Video not found.', status: 404 };
  }

  if (endpoint === '/admin/users' && method === 'GET') {
    return { ok: true, data: dbData.users, status: 200 };
  }

  if (endpoint.includes('/admin/users/') && endpoint.endsWith('/block')) {
    const userId = endpoint.split('/')[3];
    const target = dbData.users.find(u => u.id === userId);
    if (target) {
      target.isBlocked = !target.isBlocked;
      saveLocalData(dbData);
      return { ok: true, data: { message: `User status updated.` }, status: 200 };
    }
  }

  if (endpoint.startsWith('/admin/users/') && method === 'DELETE') {
    const userId = endpoint.replace('/admin/users/', '');
    const idx = dbData.users.findIndex(u => u.id === userId && u.role !== 'admin');
    if (idx !== -1) {
      dbData.users.splice(idx, 1);
      saveLocalData(dbData);
      return { ok: true, data: { message: 'User deleted.' }, status: 200 };
    }
  }

  if (endpoint === '/admin/credentials' && method === 'PUT') {
    const admin = dbData.users.find(u => u.id === currentUser.id);
    if (admin.password !== body.currentPassword) {
      return { ok: false, error: 'Incorrect current password.', status: 400 };
    }
    if (body.newUsername) admin.username = body.newUsername.trim();
    if (body.newPassword) admin.password = body.newPassword.trim();
    saveLocalData(dbData);
    localStorage.setItem('my_videos_saved_user', JSON.stringify(admin));
    return { ok: true, data: { message: 'Credentials updated!', token: 'standalone_token_' + admin.id, user: admin }, status: 200 };
  }

  if (endpoint === '/auth/forgot-password-otp') {
    const clean = body.identifier.trim().toLowerCase();
    const found = dbData.users.find(u => u.username.toLowerCase() === clean || (u.phone && u.phone === body.identifier.trim()));
    if (!found) return { ok: false, error: 'Account not found.', status: 404 };
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    dbData.otps[found.phone || 'forgot'] = code;
    saveLocalData(dbData);
    return { ok: true, data: { userId: found.id, demoOtp: code }, status: 200 };
  }

  if (endpoint === '/auth/reset-password') {
    const user = dbData.users.find(u => u.id === body.userId);
    if (!user) return { ok: false, error: 'User not found.', status: 404 };
    user.password = body.newPassword.trim();
    saveLocalData(dbData);
    return { ok: true, data: { message: 'Password reset successfully!' }, status: 200 };
  }

  return { ok: false, error: 'Endpoint not implemented in standalone mode.', status: 404 };
}

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

// Initialize App on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  if (token) {
    await checkAuthSession();
  } else {
    updateAuthUI();
  }
}

// --- AUTHENTICATION STATE & SESSION ---

async function checkAuthSession() {
  const result = await requestApi('/auth/me');
  if (result.ok && result.data.user) {
    currentUser = result.data.user;
    updateAuthUI();
    await fetchVideos();
  } else {
    if (result.error && result.error.includes("blocked")) {
      showToast("Your account has been blocked by Admin.", "error");
    }
    clearTokenSession();
    updateAuthUI();
  }
}

function clearTokenSession() {
  token = null;
  currentUser = null;
  localStorage.removeItem('my_videos_token');
  localStorage.removeItem('my_videos_saved_user');
}

function updateAuthUI() {
  const guestControls = document.getElementById('guestControls');
  const userControls = document.getElementById('userControls');
  const navUsername = document.getElementById('navUsername');
  const navUserRoleBadge = document.getElementById('navUserRoleBadge');
  const adminPanelNavBtn = document.getElementById('adminPanelNavBtn');
  const adminUploadBtn = document.getElementById('adminUploadBtn');
  
  const guestLandingSection = document.getElementById('guestLandingSection');
  const loggedInFeedSection = document.getElementById('loggedInFeedSection');
  const categoriesBar = document.getElementById('categoriesBar');
  const navSearchContainer = document.getElementById('navSearchContainer');

  if (currentUser) {
    guestControls.style.display = 'none';
    userControls.style.display = 'flex';
    navUsername.textContent = currentUser.username;
    
    const isAdmin = currentUser.role === 'admin';
    navUserRoleBadge.textContent = isAdmin ? 'ADMIN' : 'MEMBER';
    navUserRoleBadge.className = `role-badge ${isAdmin ? 'admin' : 'user'}`;

    adminPanelNavBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    adminUploadBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    guestLandingSection.style.display = 'none';
    loggedInFeedSection.style.display = 'block';
    categoriesBar.style.display = 'block';
    navSearchContainer.style.display = 'block';
  } else {
    guestControls.style.display = 'flex';
    userControls.style.display = 'none';

    guestLandingSection.style.display = 'flex';
    loggedInFeedSection.style.display = 'none';
    categoriesBar.style.display = 'none';
    navSearchContainer.style.display = 'none';
  }
}

function handleLogout() {
  clearTokenSession();
  updateAuthUI();
  showToast("You have been signed out successfully.", "success");
}

// --- MOBILE OTP & SIGNUP/LOGIN HANDLERS ---

async function sendMobileOtp() {
  const phoneInput = document.getElementById('signupPhone');
  const phone = phoneInput.value.trim();
  const alertBox = document.getElementById('landingAuthAlert');

  if (!phone || phone.length < 6) {
    showAlert(alertBox, "Please enter a valid mobile phone number before requesting OTP.", "error");
    phoneInput.focus();
    return;
  }

  const result = await requestApi('/auth/send-otp', 'POST', { phone });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  const otpBanner = document.getElementById('otpDisplayBanner');
  const otpCodeSpan = document.getElementById('simulatedOtpCode');
  otpCodeSpan.textContent = result.data.demoOtp;
  otpBanner.style.display = 'flex';

  document.getElementById('signupOtp').value = result.data.demoOtp;
  showToast(`Verification OTP sent to ${phone}! (Code: ${result.data.demoOtp})`, "success");
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const alertBox = document.getElementById('landingAuthAlert');
  alertBox.style.display = 'none';

  const result = await requestApi('/auth/login', 'POST', { username, password });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  token = result.data.token;
  currentUser = result.data.user;
  localStorage.setItem('my_videos_token', token);

  updateAuthUI();
  showToast(`Logged in successfully as ${currentUser.username} (${currentUser.role.toUpperCase()})`, "success");

  document.getElementById('landingLoginForm').reset();
  await fetchVideos();
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('signupUsername').value;
  const email = document.getElementById('signupEmail').value;
  const phone = document.getElementById('signupPhone').value;
  const otp = document.getElementById('signupOtp').value;
  const password = document.getElementById('signupPassword').value;
  const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
  const alertBox = document.getElementById('landingAuthAlert');
  alertBox.style.display = 'none';

  if (password !== passwordConfirm) {
    showAlert(alertBox, "Passwords do not match. Please re-enter.", "error");
    return;
  }

  const result = await requestApi('/auth/signup', 'POST', { username, email, phone, otp, password });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  token = result.data.token;
  currentUser = result.data.user;
  localStorage.setItem('my_videos_token', token);

  updateAuthUI();
  showToast(`Account & Mobile verified! Welcome, ${currentUser.username}!`, "success");

  document.getElementById('landingSignupForm').reset();
  document.getElementById('otpDisplayBanner').style.display = 'none';
  await fetchVideos();
}


// --- FORGOT PASSWORD MODAL & HANDLERS ---

function openForgotPasswordModal() {
  document.getElementById('forgotAlert').style.display = 'none';
  document.getElementById('forgotStep1Form').style.display = 'flex';
  document.getElementById('forgotStep2Form').style.display = 'none';
  document.getElementById('forgotPasswordModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.remove('open');
  document.body.style.overflow = '';
  forgotPasswordUserId = null;
}

function closeForgotPasswordOnOverlay(e) {
  if (e.target.id === 'forgotPasswordModal') {
    closeForgotPasswordModal();
  }
}

async function handleForgotStep1Submit(e) {
  e.preventDefault();
  const identifier = document.getElementById('forgotIdentifier').value.trim();
  const alertBox = document.getElementById('forgotAlert');
  alertBox.style.display = 'none';

  const result = await requestApi('/auth/forgot-password-otp', 'POST', { identifier });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  forgotPasswordUserId = result.data.userId;
  document.getElementById('forgotSimulatedCode').textContent = result.data.demoOtp;
  document.getElementById('forgotOtpCode').value = result.data.demoOtp;

  document.getElementById('forgotStep1Form').style.display = 'none';
  document.getElementById('forgotStep2Form').style.display = 'flex';

  showToast(`Reset OTP code sent! (Code: ${result.data.demoOtp})`, "success");
}

async function handleForgotStep2Submit(e) {
  e.preventDefault();
  const otp = document.getElementById('forgotOtpCode').value;
  const newPassword = document.getElementById('forgotNewPassword').value;
  const newPasswordConfirm = document.getElementById('forgotNewPasswordConfirm').value;
  const alertBox = document.getElementById('forgotAlert');
  alertBox.style.display = 'none';

  if (newPassword !== newPasswordConfirm) {
    showAlert(alertBox, "Passwords do not match. Please re-enter.", "error");
    return;
  }

  const result = await requestApi('/auth/reset-password', 'POST', { userId: forgotPasswordUserId, otp, newPassword });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  showToast("Password reset successfully! Please log in with your new password.", "success");
  closeForgotPasswordModal();
  showLandingTab('login');
}


// --- ADMIN PANEL MODAL, USER BLOCKING & CREDENTIALS UPDATE ---

async function openAdminPanelModal() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Access Denied. Admin Panel is restricted to Admin.", "error");
    return;
  }

  document.getElementById('adminPanelModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  await loadAdminUsersData();
  renderAdminVideosTable();
}

function closeAdminPanelModal() {
  document.getElementById('adminPanelModal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeAdminPanelOnOverlay(e) {
  if (e.target.id === 'adminPanelModal') {
    closeAdminPanelModal();
  }
}

function switchAdminTab(tab) {
  const usersSection = document.getElementById('adminUsersSection');
  const videosSection = document.getElementById('adminVideosSection');
  const settingsSection = document.getElementById('adminSettingsSection');
  
  const usersTabBtn = document.getElementById('adminTabUsersBtn');
  const videosTabBtn = document.getElementById('adminTabVideosBtn');
  const settingsTabBtn = document.getElementById('adminTabSettingsBtn');

  usersSection.style.display = 'none';
  videosSection.style.display = 'none';
  settingsSection.style.display = 'none';

  usersTabBtn.classList.remove('active');
  videosTabBtn.classList.remove('active');
  settingsTabBtn.classList.remove('active');

  if (tab === 'users') {
    usersSection.style.display = 'block';
    usersTabBtn.classList.add('active');
  } else if (tab === 'videos') {
    videosSection.style.display = 'block';
    videosTabBtn.classList.add('active');
  } else if (tab === 'settings') {
    settingsSection.style.display = 'block';
    settingsTabBtn.classList.add('active');
  }
}

async function loadAdminUsersData() {
  const result = await requestApi('/admin/users');
  if (!result.ok) {
    showToast(result.error || "Failed to load user list.", "error");
    return;
  }
  adminUsersList = result.data;
  document.getElementById('adminUsersCount').textContent = adminUsersList.length;
  renderAdminUsersTable();
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!adminUsersList || adminUsersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No users registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminUsersList.map(u => {
    const isBlocked = !!u.isBlocked;
    const isAdmin = u.role === 'admin';

    return `
      <tr>
        <td><strong>${escapeHtml(u.username)}</strong></td>
        <td>${escapeHtml(u.email || 'N/A')}</td>
        <td>${escapeHtml(u.phone || 'N/A')}</td>
        <td><span class="role-badge ${isAdmin ? 'admin' : 'user'}">${escapeHtml(u.role || 'user')}</span></td>
        <td>
          <span class="status-badge ${isBlocked ? 'blocked' : 'active'}">
            <i class="fa-solid ${isBlocked ? 'fa-user-slash' : 'fa-circle-check'}"></i>
            ${isBlocked ? 'Blocked' : 'Active'}
          </span>
        </td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td>
          ${!isAdmin ? `
            <div class="table-actions">
              <button class="btn btn-warning btn-sm" onclick="handleToggleBlockUser('${u.id}', ${isBlocked})">
                <i class="fa-solid ${isBlocked ? 'fa-lock-open' : 'fa-lock'}"></i> ${isBlocked ? 'Unblock' : 'Block'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="handleAdminDeleteUser('${u.id}', '${escapeHtml(u.username)}')">
                <i class="fa-solid fa-user-xmark"></i> Delete
              </button>
            </div>
          ` : '<span style="color:var(--text-muted); font-size:0.8rem;">(Protected Admin)</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

async function handleToggleBlockUser(userId, currentBlockedStatus) {
  const actionText = currentBlockedStatus ? "unblock" : "block";
  if (!confirm(`Are you sure you want to ${actionText} this user account?`)) return;

  const result = await requestApi(`/admin/users/${userId}/block`, 'POST');
  if (!result.ok) {
    showToast(result.error || "Failed to update block status.", "error");
    return;
  }

  showToast(result.data.message || `User status updated.`, "success");
  await loadAdminUsersData();
}

async function handleAdminDeleteUser(userId, username) {
  if (!confirm(`Are you sure you want to PERMANENTLY DELETE user '${username}'?`)) return;

  const result = await requestApi(`/admin/users/${userId}`, 'DELETE');
  if (!result.ok) {
    showToast(result.error || "Failed to delete user.", "error");
    return;
  }

  showToast(result.data.message || "User account deleted.", "success");
  await loadAdminUsersData();
}

async function handleAdminCredentialsSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('adminCurrentPassword').value;
  const newUsername = document.getElementById('adminNewUsername').value;
  const newPassword = document.getElementById('adminNewPassword').value;
  const newPasswordConfirm = document.getElementById('adminNewPasswordConfirm').value;
  const alertBox = document.getElementById('adminSettingsAlert');
  alertBox.style.display = 'none';

  if (newPassword && newPassword !== newPasswordConfirm) {
    showAlert(alertBox, "New passwords do not match.", "error");
    return;
  }

  const result = await requestApi('/admin/credentials', 'PUT', { currentPassword, newUsername, newPassword });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  token = result.data.token;
  currentUser = result.data.user;
  localStorage.setItem('my_videos_token', token);

  updateAuthUI();
  showToast("Admin credentials updated successfully!", "success");
  document.getElementById('adminCredentialsForm').reset();
}

function renderAdminVideosTable() {
  const tbody = document.getElementById('adminVideosTableBody');
  document.getElementById('adminVideosCount').textContent = allVideos.length;

  if (!allVideos || allVideos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No video links published yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allVideos.map(v => `
    <tr>
      <td>
        <img class="table-thumb" src="${escapeHtml(v.thumbnailUrl)}" alt="thumb" onerror="this.src='https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=200&q=80'">
      </td>
      <td><strong>${escapeHtml(v.title)}</strong></td>
      <td><span class="video-type-badge">${escapeHtml(v.embedType)}</span></td>
      <td>${escapeHtml(v.category || 'General')}</td>
      <td>${escapeHtml(v.uploaderName || 'Admin')}</td>
      <td>${new Date(v.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="handleAdminDeleteVideo('${v.id}')">
          <i class="fa-solid fa-trash-can"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleAdminDeleteVideo(videoId) {
  if (!confirm("Are you sure you want to delete this video link from Admin Panel?")) return;

  const result = await requestApi(`/videos/${videoId}`, 'DELETE');
  if (!result.ok) {
    showToast(result.error || "Failed to delete video.", "error");
    return;
  }

  showToast("Video link deleted from Admin Panel!", "success");
  await fetchVideos();
  renderAdminVideosTable();
}


// --- API FETCH & RENDER VIDEOS ---

async function fetchVideos() {
  if (!token) return;

  let url = '/videos?';
  if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`;
  if (activeCategory && activeCategory !== 'All') url += `category=${encodeURIComponent(activeCategory)}`;

  const result = await requestApi(url);
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      clearTokenSession();
      updateAuthUI();
      showToast(result.error || "Session ended. Please log in.", "error");
      return;
    }
    showToast("Could not load videos.", "error");
    return;
  }

  allVideos = result.data;
  renderVideoFeed();
}

function renderVideoFeed() {
  const grid = document.getElementById('videoGrid');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('videoCountBadge');

  let videosToDisplay = [...allVideos];
  countBadge.textContent = `${videosToDisplay.length} ${videosToDisplay.length === 1 ? 'video' : 'videos'}`;

  if (videosToDisplay.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    const emptyText = document.getElementById('emptyStateText');
    if (searchQuery) {
      emptyText.textContent = `No videos matched "${searchQuery}". Try searching for something else.`;
    } else {
      emptyText.textContent = "No videos available in this category.";
    }
    return;
  }

  emptyState.style.display = 'none';

  grid.innerHTML = videosToDisplay.map(video => {
    const isYouTube = video.embedType === 'youtube';
    const isVimeo = video.embedType === 'vimeo';
    const badgeIcon = isYouTube ? 'fa-youtube' : isVimeo ? 'fa-vimeo' : 'fa-circle-play';
    const badgeText = isYouTube ? 'YouTube' : isVimeo ? 'Vimeo' : 'Video';
    const timeAgo = formatTimeAgo(video.createdAt);

    return `
      <div class="video-card" onclick="openPlayerModal('${video.id}')">
        <div class="card-thumbnail-wrapper">
          <img class="card-thumbnail" src="${escapeHtml(video.thumbnailUrl)}" alt="${escapeHtml(video.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&q=80'">
          <div class="play-overlay">
            <div class="play-btn-circle">
              <i class="fa-solid fa-play"></i>
            </div>
          </div>
          <span class="video-type-badge">
            <i class="fa-brands ${badgeIcon}"></i> ${badgeText}
          </span>
          <span class="video-category-badge">${escapeHtml(video.category || 'General')}</span>
        </div>
        <div class="card-info">
          <h3 class="card-title">${escapeHtml(video.title)}</h3>
          <div class="card-meta">
            <span class="card-uploader">
              <i class="fa-solid fa-user-circle"></i> ${escapeHtml(video.uploaderName || 'Admin')}
            </span>
            <span class="card-date">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- PLAYER MODAL & AUDIO/FULLSCREEN CONTROLS ---

function openPlayerModal(videoId) {
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return;

  currentPlayingVideo = video;
  isAudioMuted = false;
  updateMuteButtonUI();

  const modal = document.getElementById('playerModal');
  const container = document.getElementById('playerContainer');
  const title = document.getElementById('modalVideoTitle');
  const category = document.getElementById('modalVideoCategory');
  const uploader = document.getElementById('modalVideoUploader');
  const date = document.getElementById('modalVideoDate');
  const description = document.getElementById('modalVideoDescription');
  const deleteBtnContainer = document.getElementById('modalDeleteContainer');

  title.textContent = video.title;
  category.textContent = video.category || 'General';
  uploader.textContent = video.uploaderName || 'Admin';
  date.textContent = new Date(video.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  description.textContent = video.description || 'No description provided for this video.';

  if (video.embedType === 'youtube' || video.embedType === 'vimeo') {
    container.innerHTML = `
      <iframe id="videoIframePlayer" src="${escapeHtml(video.embedUrl)}" 
              title="${escapeHtml(video.title)}" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
      </iframe>
    `;
  } else {
    container.innerHTML = `
      <video id="html5VideoPlayer" src="${escapeHtml(video.embedUrl)}" controls autoplay preload="metadata">
        Your browser does not support HTML5 video streaming.
      </video>
    `;
  }

  if (currentUser && currentUser.role === 'admin') {
    deleteBtnContainer.innerHTML = `
      <button class="btn btn-danger" onclick="handleDeleteVideo('${video.id}')">
        <i class="fa-solid fa-trash-can"></i> Delete Video Link (Admin)
      </button>
    `;
  } else {
    deleteBtnContainer.innerHTML = '';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
  const modal = document.getElementById('playerModal');
  const container = document.getElementById('playerContainer');
  
  container.innerHTML = '';
  modal.classList.remove('open');
  document.body.style.overflow = '';
  currentPlayingVideo = null;
}

function closePlayerModalOnOverlay(e) {
  if (e.target.id === 'playerModal') {
    closePlayerModal();
  }
}

function toggleAudioMute() {
  const videoElem = document.getElementById('html5VideoPlayer');
  const iframeElem = document.getElementById('videoIframePlayer');

  isAudioMuted = !isAudioMuted;

  if (videoElem) {
    videoElem.muted = isAudioMuted;
  } else if (iframeElem && currentPlayingVideo && currentPlayingVideo.embedType === 'youtube') {
    const func = isAudioMuted ? 'mute' : 'unMute';
    iframeElem.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*');
  }

  updateMuteButtonUI();
  showToast(isAudioMuted ? "Audio Muted" : "Audio Unmuted", "success");
}

function updateMuteButtonUI() {
  const btn = document.getElementById('playerMuteBtn');
  const textSpan = document.getElementById('muteBtnText');
  if (!btn || !textSpan) return;

  if (isAudioMuted) {
    btn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> <span id="muteBtnText">Unmute Audio</span>`;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span id="muteBtnText">Mute Audio</span>`;
  }
}

function toggleFullscreen() {
  const container = document.getElementById('playerContainer');
  if (!container) return;

  if (!document.fullscreenElement) {
    if (container.requestFullscreen) container.requestFullscreen();
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    else if (container.msRequestFullscreen) container.msRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

function copyVideoUrl() {
  if (currentPlayingVideo && currentPlayingVideo.url) {
    navigator.clipboard.writeText(currentPlayingVideo.url);
    showToast("Video link copied to clipboard!", "success");
  }
}

async function handleDeleteVideo(videoId) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Only Admin can delete videos.", "error");
    return;
  }

  if (!confirm("Are you sure you want to delete this video link?")) return;

  const result = await requestApi(`/videos/${videoId}`, 'DELETE');
  if (!result.ok) {
    showToast(result.error || "Failed to delete video.", "error");
    return;
  }

  showToast("Video link deleted by Admin!", "success");
  closePlayerModal();
  await fetchVideos();
}

// --- LANDING AUTH TABS ---

function showLandingTab(tab) {
  const loginForm = document.getElementById('landingLoginForm');
  const signupForm = document.getElementById('landingSignupForm');
  const tabLoginBtn = document.getElementById('landingTabLoginBtn');
  const tabSignupBtn = document.getElementById('landingTabSignupBtn');
  const alertBox = document.getElementById('landingAuthAlert');

  alertBox.style.display = 'none';

  if (tab === 'login') {
    loginForm.style.display = 'flex';
    signupForm.style.display = 'none';
    tabLoginBtn.classList.add('active');
    tabSignupBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    signupForm.style.display = 'flex';
    tabLoginBtn.classList.remove('active');
    tabSignupBtn.classList.add('active');
  }
}

// --- ADMIN UPLOAD VIDEO MODAL ---

function openUploadModal() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Access Denied. Only Admin can upload videos.", "error");
    return;
  }

  document.getElementById('uploadAlert').style.display = 'none';
  document.getElementById('urlTypePreview').style.display = 'none';
  document.getElementById('uploadModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeUploadModalOnOverlay(e) {
  if (e.target.id === 'uploadModal') {
    closeUploadModal();
  }
}

function detectUrlType() {
  const url = document.getElementById('videoUrl').value.trim();
  const previewBadge = document.getElementById('urlTypePreview');

  if (!url) {
    previewBadge.style.display = 'none';
    return;
  }

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    previewBadge.innerHTML = `<i class="fa-brands fa-youtube" style="color:#ff0000;"></i> YouTube link detected (Auto-embed enabled)`;
    previewBadge.style.display = 'inline-flex';
  } else if (url.includes('vimeo.com')) {
    previewBadge.innerHTML = `<i class="fa-brands fa-vimeo" style="color:#1ab7ea;"></i> Vimeo link detected (Auto-embed enabled)`;
    previewBadge.style.display = 'inline-flex';
  } else if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')) {
    previewBadge.innerHTML = `<i class="fa-solid fa-file-video" style="color:#4ade80;"></i> Direct Video File Link detected (.mp4)`;
    previewBadge.style.display = 'inline-flex';
  } else {
    previewBadge.innerHTML = `<i class="fa-solid fa-globe"></i> Web Link Video (Stream player)`;
    previewBadge.style.display = 'inline-flex';
  }
}

async function handleUploadSubmit(e) {
  e.preventDefault();

  if (!currentUser || currentUser.role !== 'admin') {
    showToast("Access Denied: Only Admin can publish video links.", "error");
    return;
  }

  const title = document.getElementById('videoTitle').value;
  const url = document.getElementById('videoUrl').value;
  const category = document.getElementById('videoCategory').value;
  const thumbnailUrl = document.getElementById('videoThumbnail').value;
  const description = document.getElementById('videoDescription').value;
  const alertBox = document.getElementById('uploadAlert');

  alertBox.style.display = 'none';

  const result = await requestApi('/videos', 'POST', { title, url, category, thumbnailUrl, description });
  if (!result.ok) {
    showAlert(alertBox, result.error, "error");
    return;
  }

  showToast("Video published by Admin!", "success");
  closeUploadModal();
  document.getElementById('uploadForm').reset();
  
  await fetchVideos();
  if (result.data.video && result.data.video.id) {
    openPlayerModal(result.data.video.id);
  }
}

// --- SEARCH & CATEGORIES ---

function selectCategory(categoryName, pillBtn) {
  activeCategory = categoryName;
  document.querySelectorAll('.cat-pill').forEach(pill => pill.classList.remove('active'));
  pillBtn.classList.add('active');
  fetchVideos();
}

function handleSearch(e) {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  searchQuery = input.value.trim();

  clearBtn.style.display = searchQuery.length > 0 ? 'block' : 'none';

  if (e.key === 'Enter' || searchQuery === '') {
    fetchVideos();
  }
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  input.value = '';
  searchQuery = '';
  clearBtn.style.display = 'none';
  fetchVideos();
}

// --- UTILITY HELPERS ---

function showAlert(element, message, type) {
  element.className = `alert-box alert-${type}`;
  element.textContent = message;
  element.style.display = 'block';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
