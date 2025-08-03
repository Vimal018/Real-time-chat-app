import express from "express";
import { protect } from "../middlewares/authMiddleware";
import { getAllUsers, getCurrentUser, updateUserProfile } from "../controllers/userController";

const router = express.Router();

router.get("/", protect, getAllUsers); // 🆕 Get all users except self
router.get("/me", protect, getCurrentUser); // Get self
router.put("/profile", protect, updateUserProfile);

export default router;
