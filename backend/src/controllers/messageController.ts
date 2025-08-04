import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import fs from 'fs';
import { promisify } from 'util';
import Message from '../models/messageModel';
import Chat from '../models/Chat';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { Server } from 'socket.io';

const unlinkAsync = promisify(fs.unlink);

let io: Server;

export const initSocket = (socketIo: Server) => {
  io = socketIo;
};

export const uploadImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    const { chatId, senderId } = req.body;
    const file = req.file;

    if (!file || !chatId || !senderId) {
      return res.status(400).json({ message: 'File, chatId, and senderId are required' });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'chat_images',
    });

    await unlinkAsync(file.path);

    const message = await Message.create({
      _id: new mongoose.Types.ObjectId(),
      chatId,
      senderId,
      text: result.secure_url,
      imageUrl: result.secure_url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
    };

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Upload Image Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content, senderId } = req.body;

    if (!chatId || !content || !senderId) {
      return res.status(400).json({ message: 'chatId, content, and senderId are required' });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const message = await Message.create({
      _id: new mongoose.Types.ObjectId(),
      chatId,
      senderId,
      text: content,
    });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
    };

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    res.json(
      messages.map((msg) => ({
        ...msg,
        senderId: msg.senderId.toString(),
        text: msg.text,
      }))
    );
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};