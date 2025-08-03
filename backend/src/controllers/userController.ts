// src/controllers/userController.ts
import { Request, Response } from "express";
import User from "../models/User";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import cloudinary from "../libs/cloudinary";

// PUT /api/users/profile
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id).select("-password"); // exclude password
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, bio, avatar } = req.body;

    // ✅ Upload avatar if it's a new base64 image
    if (avatar && avatar.startsWith("data:image")) {
      try {
        const uploadRes = await cloudinary.uploader.upload(avatar, {
          folder: "quickchat_avatars",
          width: 300,
          crop: "scale",
        });
        user.avatar = uploadRes.secure_url;
      } catch (uploadErr) {
        console.error("Cloudinary upload failed", uploadErr);
        return res.status(500).json({ message: "Avatar upload failed" });
      }
    }

    // ✅ Update fields only if provided
    if (name) user.name = name;
    if (bio) user.bio = bio;

    const updatedUser = await user.save();

    return res.status(200).json({
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      bio: updatedUser.bio,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// userController.ts
export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id).select("-password"); // exclude sensitive fields
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get profile" });
  }
};


// GET /api/users - Get all users except the current logged-in user
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({ _id: { $ne: req.user?._id } }).select("-password");
    return res.status(200).json(users);
  } catch (err) {
    console.error("Fetching all users failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
