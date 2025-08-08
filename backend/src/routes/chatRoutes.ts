import express from "express";
import { protect } from "../middlewares/authMiddleware";
import { createOrGetChat } from "../controllers/chatController";
import { getUserChats } from "../controllers/messageController";

const router = express.Router();

router.post("/", protect, createOrGetChat);
router.get("/", protect, getUserChats);

export default router;