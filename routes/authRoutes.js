import express from 'express';
import { 
    a1Login, a1ResetPassword, a1ResetPasswordRequestOTP, 
    a1ResetPasswordVerifyOTP, approveDoctor, declineDoctor, 
    doctorLogin, doctorRegister, doctorResetPassword, 
    doctorResetPasswordRequestOTP, doctorResetPasswordVerifyOTP, 
    getPendingDoctors 
} from '../controllers/authController.js';
import resetMiddleware from '../middlewares/resetMiddleware.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Helper function to run a controller after a middleware successfully executes.
 * This cleans up the repetitive wrapper logic in the switch statement.
 * @param {function} middleware - The middleware function (e.g., verifyResetToken).
 * @param {function} controller - The final controller function to run on success.
 */
const applyMiddleware = (middleware, controller) => (req, res, next) => {
    middleware(req, res, () => controller(req, res));
};


router.post('/', (req, res, next) => {
    const action = req.body.action;

    const publicActions = [
        'doctor_login', 'a1_login', 'doctor_register', 
        'doctor_reset_password_request_otp', 'doctor_reset_password_verify_otp',
        'a1_reset_password_request_otp', 'a1_reset_password_verify_otp',
        'get_pending_doctors', 'approve_doctor', 'decline_doctor'
    ];

    const resetTokenRequiredActions = [
        'doctor_reset_password', 
        'a1_reset_password'
    ];

    const mainTokenRequiredActions = [
        'get_pending_doctors', 
        'approve_doctor', 
        'decline_doctor'
    ];

    if (publicActions.includes(action)) {
        switch (action) {
            case 'doctor_login': return doctorLogin(req, res);
            case 'a1_login': return a1Login(req, res);
            case 'doctor_register': return doctorRegister(req, res);
            case 'doctor_reset_password_request_otp': return doctorResetPasswordRequestOTP(req, res);
            case 'doctor_reset_password_verify_otp': return doctorResetPasswordVerifyOTP(req, res);
            case 'a1_reset_password_request_otp': return a1ResetPasswordRequestOTP(req, res);
            case 'a1_reset_password_verify_otp': return a1ResetPasswordVerifyOTP(req, res);
            case 'get_pending_doctors': return getPendingDoctors(req, res);
            case 'approve_doctor': return approveDoctor(req, res);
            case 'decline_doctor': return declineDoctor(req, res);
        }
    } 
    
    if (resetTokenRequiredActions.includes(action)) {
        return applyMiddleware(resetMiddleware, (req, res) => {
            switch (action) {
                case 'doctor_reset_password': return doctorResetPassword(req, res);
                case 'a1_reset_password': return a1ResetPassword(req, res);
            }
        })(req, res, next);
    }
    
    return res.status(400).json({ error: 'Invalid action' });
});

export default router;
