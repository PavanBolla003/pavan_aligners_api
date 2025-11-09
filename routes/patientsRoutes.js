import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { createPatient, getPatients, updatePatient } from "../controllers/patientsController.js";

const router = express.Router();

router.use(authMiddleware);

router.get('/', getPatients);
router.post('/', createPatient);
router.put('/', updatePatient);

export default router;