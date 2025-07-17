import express from "express";
import { updateUserProfile,getCurrentUser } from "../controllers/userController";
import { protect } from "../middlewares/authMiddleware";
import User from "../models/User";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  userId?: string;
}



const router = express.Router();

// Only authenticated users can update profile
router.put("/profile", protect, updateUserProfile);
router.get("/me", protect, getCurrentUser);

router.get("/", protect, async (req: AuthenticatedRequest, res) => {
  const users = await User.find({ _id: { $ne: req.userId } }).select("-password");
  res.json(users);
});


export default router;
