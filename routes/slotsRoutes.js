import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { bookSlot, getAvailableSlots } from "../controllers/slotsController.js";

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAvailableSlots);
router.post('/', bookSlot);

export default router;