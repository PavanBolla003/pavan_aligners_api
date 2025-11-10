import mysql from 'mysql2';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(process.env.CA_CERT_PATH) // <-- read from file
    }
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error connecting to Aiven MySQL:', err.code, err);
    } else {
        console.log('✅ Successfully connected to Aiven MySQL service.');
        connection.release();
    }
});

export default pool.promise();
