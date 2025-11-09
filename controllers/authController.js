import db from "../libs/database.js";
import { comparePassword, createJWT, createResetJWT, generateOtp, hashPassword } from "../libs/index.js";
import { transporter } from "../libs/email-setup.js";
import domainVerify from "../libs/domain-verification.js";
import { sendVerificatioMail } from "../libs/email-verification.js";

export const doctorLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400)
            .json({ error: "Email and password are required." });
    }

    try {
        const [rows] = await db.execute(
            "SELECT * FROM doctors WHERE email = ?",
            [email]
        );
        if (rows.length === 0) {
            return res.status(401)
                .json({ error: "Invalid credentials." })
        } else {
            const doctor = rows[0];
            if (doctor.is_approved === 0) {
                return res.status(403)
                    .json({ error: "Your account is not verified yet. Please wait for approval." })
            }

            const isMatch = await comparePassword(password, doctor.password);

            if (!isMatch) {
                return res.status(401)
                    .json({ error: "Invaled Email or Password! Please try again." });
            }
            return res.status(200)
                .json({
                    success: true,
                    user: doctor,
                    token: createJWT(doctor.id, doctor.email),
                    userType: 'doctor'
                });
        }
    } catch (error) {
        console.log("Error during doctor login: ", error);
        res.status(500).json({ error });
    }
}

export const a1Login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400)
            .json({ error: "Email and password are required." });
    }

    try {
        const [rows] = await db.execute(
            "SELECT * FROM a1_users WHERE email = ? AND password = MD5(?)",
            [email, password]
        );
        console.log(rows);


        if (rows.length === 0) {
            return res.status(401)
                .json({ error: "Invalid Credentials.143" });
        } else {
            const a1User = rows[0];
            return res.status(200)
                .json({
                    success: true,
                    user: a1User,
                    token: createJWT(a1User.id, a1User.email),
                    userType: 'a1_user'
                });
        }
    } catch (error) {
        console.log("Error during A1 user login: ", error);
        res.status(500).json({ error });
    }
}

export const doctorRegister = async (req, res) => {
    // console.log("Body: ", req.body);

    const data = req.body || {};
    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    const password = data.password || '';
    const phone = data.phone || '';
    const specialization = (data.specialization || '').trim();

    if (!name || name.length === 0 || !(/^[A-Za-z]+$/.test(name))) {
        return res.status(400)
            .json({ error: "Name is required and should consist of only english alphabets." });
    } else if (!email || email.length === 0) {

        return res.status(400)
            .json({ error: "Email is required." });
    } else if (!password || password.length === 0) {
        return res.status(400)
            .json({ error: "Password is required." });
    } else if (!phone) {
        return res.status(400)
            .json({ error: "Phone number is required." });
    }

    const isDomainVerified = await domainVerify(email.split('@')[1]);
    if (!isDomainVerified) {
        return res.status(400)
            .json({ error: "Please enter a valid email address." })
    }

    try {

        const [existingDoctor] = await db.execute(
            "SELECT * FROM doctors WHERE email = ?",
            [email]
        );
        if (existingDoctor.length > 0) {
            return res.status(409)
                .json({ error: "Email is already registered. Please use a different email or try to login." });
        }

        const hashedPassword = await hashPassword(password);
        // const [rows] = await db.execute(
        //     "INSERT INTO doctors (name, email, password, phone, specialization) VALUES (?, ?, ?, ?, ?)",
        //     [name, email, hashedPassword, phone, specialization]
        // );

        const response = await sendVerificatioMail(name, email, hashedPassword, phone, specialization);
        if (response.success == true) {
            return res.status(200).json({
                success: true,
                message: "Verification email sent. Please check your inbox to complete registration.",
            });
        }

        // return res.status(201)
        //     .json({
        //         success: true,
        //         message: "Doctor registered successfully. Please wait for admin approval before logging in.",
        //         doctor_id: rows.insertId
        //     });
    } catch (error) {
        console.log("Error during doctor registration: ", error);
        return res.status(500).json({ error });

    }
}

export const doctorResetPasswordRequestOTP = async (req, res) => {
    const data = req.body;
    const email = data.email.trim();

    if (!email || email.length === 0) {
        return res.status(400)
            .json({ error: "Email is required." });
    }

    const otp = generateOtp();
    const expiresIn = new Date(Date.now() + 5 * 60000);

    try {
        await db.execute(
            "INSERT INTO reset_password_otps (email, otp, expires_at) VALUES (?, ?, ?)",
            [email, otp, expiresIn]
        )

        await transporter.sendMail({
            from: `"Dental App Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Dental App OTP Code ',
            text: `Your OTP for Dental App Doctor Reset Password is: ${otp}`,
        });


        res.status(200).json({ success: true, message: "OTP has been sent to your email address." });
    } catch (error) {
        console.log("Error sending OTP: ", error);
        res.status(500).json({ error });

    }


}

export const doctorResetPasswordVerifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const result = await db.execute(
            `SELECT * FROM reset_password_otps WHERE email = ? AND otp = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email, otp]
        );

        if (result.rows?.length === 0) {
            return res.status(400).send({ message: 'Invalid or expired OTP' });
        }

        const [userRows] = await db.execute(`SELECT id, email FROM doctors WHERE email = ?`, [email]);

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found after OTP verification.' });
        }

        const user = userRows[0];

        const resetToken = createResetJWT(user);

        res.status(200).json({
            success: true,
            message: "OTP verified. Proceed to password change.",
            resetToken: resetToken
        });

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Verification failed' });
    }
}

export const doctorResetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const { userId, userEmail } = req.reset_user;

    try {
        const hashedPassword = await hashPassword(newPassword);

        await db.execute(
            "UPDATE doctors SET password = ? WHERE id = ? AND email = ?",
            [hashedPassword, userId, userEmail]
        );

        res.status(200).json(
            {
                success: true,
                message: "Password has been reset successfully. You can now log in with your new password."
            }
        )
    } catch (error) {
        console.log("Error during password reset: ".error);
        res.status(500).json({ error });
    }
}

export const a1ResetPasswordRequestOTP = async (req, res) => {
    const data = req.body;
    const email = data.email.trim();

    if (!email || email.length === 0) {
        return res.status(400)
            .json({ error: "Email is required." });
    }

    const otp = generateOtp();
    const expiresIn = new Date(Date.now() + 5 * 60000);

    try {
        await db.execute(
            "INSERT INTO reset_password_otps (email, otp, expires_at) VALUES (?, ?, ?)",
            [email, otp, expiresIn]
        )

        await transporter.sendMail({
            from: `"Dental App Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Dental App OTP Code ',
            text: `Your OTP for Dental App A1User Reset Password is: ${otp}`,
        });


        res.status(200).json({ success: true, message: "OTP has been sent to your email address." });
    } catch (error) {
        console.log("Error sending OTP: ", error);
        res.status(500).json({ error });

    }


}

export const a1ResetPasswordVerifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const result = await db.execute(
            `SELECT * FROM reset_password_otps WHERE email = ? AND otp = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
            [email, otp]
        );

        if (result.rows.length === 0) {
            return res.status(400).send({ message: 'Invalid or expired OTP' });
        }

        const [userRows] = await db.execute(`SELECT id, email FROM a1_users WHERE email = ?`, [email]);

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'User not found after OTP verification.' });
        }

        const user = userRows[0];

        const resetToken = createResetJWT(user);

        res.status(200).json({
            success: true,
            message: "OTP verified. Proceed to password change.",
            resetToken: resetToken
        });

    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Verification failed' });
    }
}

export const a1ResetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const { userId, userEmail } = req.reset_user;

    try {
        const hashedPassword = await hashPassword(newPassword);

        await db.execute(
            "UPDATE a1_users SET password = ? WHERE id = ? AND email = ?",
            [hashedPassword, userId, userEmail]
        );

        res.status(200).json(
            {
                success: true,
                message: "Password has been reset successfully. You can now log in with your new password."
            }
        )
    } catch (error) {
        console.log("Error during password reset: ".error);
        res.status(500).json({ error });
    }
}

export const getPendingDoctors = async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT * FROM doctors WHERE is_approved = 0"
        );

        return res.status(200).json({
            success: true,
            doctors: rows
        });
    } catch (error) {
        console.log("Error fetching pending doctors: ", error);
        res.status(500).json({ error });

    }
}

export const approveDoctor = async (req, res) => {
    const { doctor_id } = req.body;

    try {
        await db.execute(
            "UPDATE doctors SET is_approved = 1 WHERE id = ?",
            [doctor_id]
        )

        const [rows] = await db.execute(
            "SELECT email FROM doctors WHERE id = ?",
            [doctor_id]
        );

        const email = rows[0].email;

        await transporter.sendMail({
            from: `"Dental App Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Dental App Doctor Approval ',
            text: `Your identity has been approved as a doctor. You can login and continue to use Dental App!`,
        });

        return res.status(200).json({
            success: true,
            message: "Doctor approved successfully."
        });
    } catch (error) {
        console.log("Error approving doctor: ", error);
        return res.status(500).json({ error });

    }
}

export const declineDoctor = async (req, res) => {
    const { doctor_id } = req.body;

    try {

        const [rows] = await db.execute(
            "SELECT email FROM doctors WHERE id = ?",
            [doctor_id]
        );

        await db.execute(
            "DELETE FROM doctors WHERE id = ?",
            [doctor_id]
        )

        const email = rows[0].email;

        await transporter.sendMail({
            from: `"Dental App Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Dental App Doctor Approval ',
            text: `Your identity as a doctor has been declined. Please contact support for more details.`,
        });

        return res.status(200).json({
            success: true,
            message: "Doctor declined and removed successfully."
        });
    } catch (error) {
        console.log("Error declining doctor: ", error);

        return res.status(500).json({ error });
    }
}