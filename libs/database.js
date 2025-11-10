import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

let sslConfig = null;

// ✅ Check if Render provides SSL or a certificate path
if (process.env.DB_SSL_CERT) {
  try {
    sslConfig = {
      ca: fs.readFileSync(process.env.DB_SSL_CERT),
    };
  } catch (error) {
    console.warn("⚠️ Could not read SSL certificate, using default SSL config:", error.message);
    sslConfig = { rejectUnauthorized: false };
  }
} else if (process.env.RENDER === "true") {
  // ✅ If running on Render but no cert file, still enable SSL without strict validation
  sslConfig = { rejectUnauthorized: false };
}

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: sslConfig,
};

export const connectDB = async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to Aiven MySQL successfully!");
    return connection;
  } catch (err) {
    console.error("❌ Error connecting to Aiven MySQL:", err.message);
    process.exit(1);
  }
};
