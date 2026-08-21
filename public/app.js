/* ==========================================================================
   MY VIDEOS PLATFORM - CLIENT JAVASCRIPT (WITH FORGOT PASSWORD & OTP RESET)
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
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.user) {
      currentUser = data.user;
      updateAuthUI();
      await fetchVideos();
    } else {
      if (data.error && data.error.includes("blocked")) {
        showToast("Your account has been blocked by Admin.", "error");
      }
      clearTokenSession();
      updateAuthUI();
    }
  } catch (err) {
    console.error("Session check failed:", err);
    clearTokenSession();
    updateAuthUI();
  }
}

function clearTokenSession() {
  token = null;
  currentUser = null;
  localStorage.removeItem('my_videos_token');
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

  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send OTP.");

    const otpBanner = document.getElementById('otpDisplayBanner');
    const otpCodeSpan = document.getElementById('simulatedOtpCode');
    otpCodeSpan.textContent = data.demoOtp;
    otpBanner.style.display = 'flex';

    document.getElementById('signupOtp').value = data.demoOtp;
    showToast(`Verification OTP sent to ${phone}! (Code: ${data.demoOtp})`, "success");
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const alertBox = document.getElementById('landingAuthAlert');

  alertBox.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed.");

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('my_videos_token', token);

    updateAuthUI();
    showToast(`Logged in successfully as ${currentUser.username} (${currentUser.role.toUpperCase()})`, "success");

    document.getElementById('landingLoginForm').reset();
    await fetchVideos();
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, phone, otp, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed.");

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('my_videos_token', token);

    updateAuthUI();
    showToast(`Account & Mobile verified! Welcome, ${currentUser.username}!`, "success");

    document.getElementById('landingSignupForm').reset();
    document.getElementById('otpDisplayBanner').style.display = 'none';
    await fetchVideos();
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Account not found.");

    forgotPasswordUserId = data.userId;

    // Display OTP and pre-fill for convenient testing
    document.getElementById('forgotSimulatedCode').textContent = data.demoOtp;
    document.getElementById('forgotOtpCode').value = data.demoOtp;

    // Transition to Step 2
    document.getElementById('forgotStep1Form').style.display = 'none';
    document.getElementById('forgotStep2Form').style.display = 'flex';

    showToast(`Reset OTP code sent! (Code: ${data.demoOtp})`, "success");
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: forgotPasswordUserId, otp, newPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to reset password.");

    showToast("Password reset successfully! Please log in with your new password.", "success");
    closeForgotPasswordModal();
    showLandingTab('login');
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
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
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to load user list for admin.");
    adminUsersList = await res.json();

    document.getElementById('adminUsersCount').textContent = adminUsersList.length;
    renderAdminUsersTable();
  } catch (err) {
    console.error("Admin user load error:", err);
    showToast(err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/block`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to ${actionText} user.`);

    showToast(data.message, "success");
    await loadAdminUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleAdminDeleteUser(userId, username) {
  if (!confirm(`Are you sure you want to PERMANENTLY DELETE user '${username}'?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete user account.");

    showToast(data.message, "success");
    await loadAdminUsersData();
  } catch (err) {
    showToast(err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/admin/credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update admin credentials.");

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('my_videos_token', token);

    updateAuthUI();
    showToast("Admin credentials updated successfully!", "success");
    document.getElementById('adminCredentialsForm').reset();
  } catch (err) {
    showAlert(alertBox, err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete video.");

    showToast("Video link deleted from Admin Panel!", "success");
    await fetchVideos();
    renderAdminVideosTable();
  } catch (err) {
    showToast(err.message, "error");
  }
}


// --- API FETCH & RENDER VIDEOS ---

async function fetchVideos() {
  if (!token) return;

  try {
    let url = `${API_BASE}/videos?`;
    if (searchQuery) url += `q=${encodeURIComponent(searchQuery)}&`;
    if (activeCategory && activeCategory !== 'All') url += `category=${encodeURIComponent(activeCategory)}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      const data = await res.json();
      clearTokenSession();
      updateAuthUI();
      showToast(data.error || "Session ended. Please log in.", "error");
      return;
    }

    if (!res.ok) throw new Error("Failed to load videos.");
    
    allVideos = await res.json();
    renderVideoFeed();
  } catch (err) {
    console.error("Fetch videos error:", err);
    showToast("Could not load videos from server.", "error");
  }
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

// Audio Control: Toggle Mute / Unmute
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

// Fullscreen Control
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

  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete video.");

    showToast("Video link deleted by Admin!", "success");
    closePlayerModal();
    await fetchVideos();
  } catch (err) {
    showToast(err.message, "error");
  }
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

  try {
    const res = await fetch(`${API_BASE}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title, url, category, thumbnailUrl, description
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to publish video link.");

    showToast("Video published by Admin!", "success");
    closeUploadModal();
    document.getElementById('uploadForm').reset();
    
    await fetchVideos();
    if (data.video && data.video.id) {
      openPlayerModal(data.video.id);
    }
  } catch (err) {
    showAlert(alertBox, err.message, "error");
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
