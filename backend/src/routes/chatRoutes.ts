// src/routes/chatRoutes.ts
import express from "express";
import { protect } from "../middlewares/authMiddleware";
import { createOrGetChat } from "../controllers/chatController";

const router = express.Router();

router.post("/", protect, createOrGetChat);

export default router;