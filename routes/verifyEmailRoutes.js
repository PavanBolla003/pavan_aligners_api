import express from "express";
import { verifyLink } from "../libs/email-verification.js";

const router = express.Router();

router.get("/", verifyLink);

export default router;