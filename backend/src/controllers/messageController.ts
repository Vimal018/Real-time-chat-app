// src/controllers/messageController.ts
import { Request, Response } from "express";
import Message from "../models/messageModel";
import Chat from "../models/Chat";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content, senderId } = req.body;

    if (!chatId || !content || !senderId) {
      return res.status(400).json({ message: "chatId, content, and senderId are required" });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chatId format" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const message = await Message.create({
      chatId,
      senderId,
      text: content, // Map content to text
    });

    res.status(201).json({
      ...message.toJSON(),
      senderId: message.senderId.toString(),
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ message: "chatId is required" });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chatId format" });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    res.json(
      messages.map((msg) => ({
        ...msg,
        senderId: msg.senderId.toString(),
        text: msg.text, // Handle text or content
      }))
    );
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const uploadImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, senderId } = req.body;
    const file = (req as any).file;
    if (!file || !chatId || !senderId) {
      return res.status(400).json({ message: "File, chatId, and senderId are required" });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chatId format" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "chat_images",
    });
    const message = await Message.create({
      chatId,
      senderId,
      text: result.secure_url, // Use secure_url as text for consistency
      imageUrl: result.secure_url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json({
      ...message.toJSON(),
      senderId: message.senderId.toString(),
    });
  } catch (error) {
    console.error("Upload Image Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};