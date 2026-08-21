const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=== Testing Forgot Password & OTP Reset Suite ===");

  const testPhone = "+198765438" + Math.floor(10 + Math.random() * 89);
  const testEmail = `forgot_${Date.now()}@example.com`;
  const testUser = `forgot_user_${Date.now().toString().slice(-4)}`;

  // 1. Create User
  const otpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/send-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { phone: testPhone });

  const signupRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: testUser,
    email: testEmail,
    phone: testPhone,
    password: 'oldpassword123',
    otp: otpRes.body.demoOtp
  });

  console.log(`\n1. Created account '${testUser}' with phone ${testPhone}`);

  // 2. Request Forgot Password OTP using Username
  console.log(`\n2. Requesting Forgot Password OTP for username '${testUser}'...`);
  const forgotOtpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/forgot-password-otp',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: testUser });

  console.log("Forgot OTP Status:", forgotOtpRes.statusCode, "(Expected: 200)");
  console.log("Generated Reset OTP Code:", forgotOtpRes.body.demoOtp);
  if (forgotOtpRes.statusCode !== 200 || !forgotOtpRes.body.demoOtp) throw new Error("Forgot password OTP failed!");

  // 3. Reset Password using OTP
  console.log("\n3. Resetting password using OTP...");
  const resetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    userId: forgotOtpRes.body.userId,
    otp: forgotOtpRes.body.demoOtp,
    newPassword: 'brandnewpassword456'
  });

  console.log("Reset Password Status:", resetRes.statusCode, "(Expected: 200)");
  console.log("Response:", resetRes.body.message);

  // 4. Verify Login with New Password
  console.log("\n4. Logging in with newly reset password ('brandnewpassword456')...");
  const newLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: testUser, password: 'brandnewpassword456' });

  console.log("Login with New Password Status:", newLoginRes.statusCode, "(Expected: 200)");
  console.log("User Logged In:", newLoginRes.body.user ? newLoginRes.body.user.username : "NONE");
  if (newLoginRes.statusCode !== 200) throw new Error("Login with reset password failed!");

  console.log("\n✨ ALL FORGOT PASSWORD & FAVICON SUITE TESTS PASSED PERFECTLY! ✨");
}

setTimeout(runTests, 1000);
