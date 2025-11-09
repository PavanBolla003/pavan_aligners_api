import express from "express";
import authRoutes from "./authRoutes.js";
import patientsRoutes from "./patientsRoutes.js";
import slotRoutes from "./slotsRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import verifyEmailRoutes from "./verifyEmailRoutes.js";

const router = express.Router();

router.use("/auth.php", authRoutes);
router.use("/patients.php", patientsRoutes);
router.use("/slots.php", slotRoutes);
router.use("/uploads.php", uploadRoutes);
router.use("/verify-email", verifyEmailRoutes);

export default router;