import mysql from "mysql2/promise";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

let sslConfig = null;

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
  sslConfig = { rejectUnauthorized: false };
}

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: sslConfig,
};

// ✅ Create a default connection immediately
const db = await mysql.createConnection(dbConfig);

console.log("✅ Connected to Aiven MySQL successfully!");

// ✅ Export as default for backward compatibility
export default db;
