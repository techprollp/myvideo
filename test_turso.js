const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://myvideo-shareef123.aws-us-east-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODczMTE5OTYsImlkIjoiMDFhMDI0MTgtOWIwMS03NTk1LWFkZTctYzZhNDMzOWQ0OTA1Iiwia2lkIjoiY0FYMDhoMU9mc0Nyc3lra3JYOGNNUmYzWnhQOEFSa1lhNkdjb2FnQnlFVSIsInJpZCI6IjA5MTUxYTg1LTRlYWUtNGE3OS05MTFlLTViYjM5YzA0Nzg0YyJ9.TLieDAQSWLzec0Ed9UzPkMl6OXVP3PO29IFyOC0s7AFttgICwYwwm22521Ujf_Hq5DWh9wdKraodaXJZD5XRDg';

async function testConnection() {
  console.log("⚡ Testing connection to Turso Cloud Database...");
  console.log("URL:", TURSO_URL);

  try {
    const client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN
    });

    // Create tables
    await client.execute(`
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

    await client.execute(`
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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS otps (
        phone TEXT PRIMARY KEY,
        code TEXT,
        expiresAt INTEGER
      );
    `);

    console.log("✅ Tables created/verified in Turso cloud database!");

    const userCount = await client.execute("SELECT COUNT(*) as count FROM users;");
    console.log("User count in Turso cloud DB:", userCount.rows[0].count);

    const videoCount = await client.execute("SELECT COUNT(*) as count FROM videos;");
    console.log("Video count in Turso cloud DB:", videoCount.rows[0].count);

    console.log("✨ TURSO CLOUD DATABASE CONNECTED SUCCESSFULLY! ✨");
  } catch (err) {
    console.error("❌ Turso connection failed:", err);
  }
}

testConnection();
