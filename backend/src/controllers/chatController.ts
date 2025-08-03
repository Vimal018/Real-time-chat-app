// src/controllers/chatController.ts
import { Request, Response } from "express";
import Chat from "../models/Chat";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import mongoose from "mongoose";

export const createOrGetChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ message: "At least two user IDs are required" });
    }

    // Validate userIds
    const validUserIds = userIds.filter((id) => mongoose.isValidObjectId(id));
    if (validUserIds.length !== userIds.length) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    // Sort userIds to ensure consistent lookup
    const sortedUserIds = validUserIds.sort();
    const chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: sortedUserIds, $size: sortedUserIds.length },
    });

    if (chat) {
      return res.status(200).json(chat);
    }

    const newChat = await Chat.create({
      isGroupChat: false,
      users: sortedUserIds,
    });

    res.status(201).json(newChat);
  } catch (error) {
    console.error("Chat creation error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};