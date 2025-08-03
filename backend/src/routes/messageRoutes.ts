import express from "express";
import { getMessages, sendMessage } from "../controllers/messageController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:chatId", protect, getMessages);

export default router;
