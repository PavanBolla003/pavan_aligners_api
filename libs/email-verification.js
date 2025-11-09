import crypto from "crypto";
import bcrypt from "bcrypt"
import { transporter } from "./email-setup.js";
import db from "./database.js";


export async function sendVerificatioMail(name, email, passwordHash, phone, specialization) {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.execute("DELETE FROM email_verifications WHERE email = ?", [email]);
    await db.execute(
      `INSERT INTO email_verifications (name, email, password_hash, phone, specialization, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, passwordHash, phone, specialization, hashedToken, expiresAt]
    );

    const link = `https://a1-aligners-api.onrender.com/dental-management-system/backend/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    await transporter.sendMail({
        from: `"Dental App Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Dental App Verify Email ',
        html: `<p>Click <a href="${link}">here</a> to verify your email. Link valid for 15 minutes.</p>`
    });

    return {
        success: true,
        message: "Verification email sent successfully."
    };
}

export async function verifyLink(req, res) {
  try {
    const { email, token } = req.query;
    console.log("Email: ", email);
    console.log("Token: ", token);
    
    if (!email || !token)
      return res.status(400).json({ success: false, error: "Invalid verification link." });

    const [records] = await db.execute(
      "SELECT * FROM email_verifications WHERE email = ? LIMIT 1",
      [email]
    );
    if (records.length === 0)
      return res.status(400).json({ success: false, error: "Invalid or expired link." });

    const record = records[0];

    if (new Date(record.expires_at) < new Date())
      return res.status(400).json({ success: false, error: "Verification link expired." });

    const isMatch = await bcrypt.compare(token, record.token_hash);
    if (!isMatch)
      return res.status(400).json({ success: false, error: "Invalid verification token." });

    const [result] = await db.execute(
      "INSERT INTO doctors (name, email, password, phone, specialization) VALUES (?, ?, ?, ?, ?)",
      [record.name, record.email, record.password_hash, record.phone, record.specialization]
    );

    await db.execute("DELETE FROM email_verifications WHERE email = ?", [email]);

    return res.status(200).json({
      success: true,
      message: "Email verified and registration completed successfully!",
      doctor_id: result.insertId,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ success: false, error: "Server error." });
  }
}