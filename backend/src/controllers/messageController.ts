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
const onlineUsers = new Set<string>();

export const initSocket = (socketIo: Server) => {
  io = socketIo;

  io.on('connection', (socket) => {
    let userId = socket.handshake.query.userId as string | undefined;
    if (!userId && socket.handshake.auth.userId) {
      userId = socket.handshake.auth.userId;
    }
    console.log('User connected:', { socketId: socket.id, userId: userId });

    if (!userId) {
      socket.emit('error', { message: 'User ID missing in connection' });
      console.log('Missing userId for socket:', socket.id);
      return;
    }

    onlineUsers.add(userId);
    io.emit('onlineUsers', Array.from(onlineUsers));
    console.log('Global online users:', Array.from(onlineUsers));

    socket.on('join chat', (chatId: string) => {
      if (!mongoose.isValidObjectId(chatId)) {
        socket.emit('error', { message: 'Invalid chatId format' });
        console.log('Invalid chatId:', chatId);
        return;
      }
      socket.join(chatId);
      console.log(`User ${userId} joined chat ${chatId}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', { socketId: socket.id, userId });
      onlineUsers.delete(userId!);
      io.emit('onlineUsers', Array.from(onlineUsers));
      console.log('Global online users:', Array.from(onlineUsers));
    });
  });
};

export const getOnlineUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ onlineUsers: Array.from(onlineUsers) });
  } catch (error) {
    console.error('Get Online Users Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
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
      text: 'Image',
      imageUrl: result.secure_url,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
    };

    io.to(chatId).emit('message received', messageData);
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
      chatId: message.chatId.toString(),
    };

    io.to(chatId).emit('message received', messageData);
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
        chatId: msg.chatId.toString(),
      }))
    );
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getUserChats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const chats = await Chat.find({ userIds: userId })
      .lean()
      .exec();
    res.json(chats);
  } catch (error) {
    console.error('Get User Chats Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};