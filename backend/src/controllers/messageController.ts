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
    console.log('User connected:', { socketId: socket.id, userId });

    if (!userId) {
      socket.emit('error', { message: 'User ID missing in connection' });
      console.log('Missing userId for socket:', socket.id);
      return;
    }

    onlineUsers.add(userId);
    socket.emit('onlineUsers', Array.from(onlineUsers));
    io.emit('onlineUsers', Array.from(onlineUsers));
    console.log('Global online users:', Array.from(onlineUsers));

    socket.on('join chat', async (chatId: string) => {
      if (!mongoose.isValidObjectId(chatId)) {
        socket.emit('error', { message: 'Invalid chatId format' });
        console.log('Invalid chatId:', chatId);
        return;
      }
      socket.join(chatId);
      console.log(`User ${userId} joined chat ${chatId}`);

      // Mark messages as read using updateMany to avoid updating timestamps
      await Message.updateMany(
        { chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      // Emit 'message read' for updated messages
      const updatedMessages = await Message.find({
        chatId,
        readBy: userId,
      }).select('_id');
      for (const msg of updatedMessages) {
        io.to(chatId).emit('message read', { messageId: msg._id, readBy: userId });
      }

      // Emit 'message delivered' for messages not yet read by this user
      const messages = await Message.find({ chatId, isDeleted: false });
      for (const msg of messages) {
        if (!msg.readBy.includes(new mongoose.Types.ObjectId(userId)) && msg.senderId.toString() !== userId) {
          io.to(chatId).emit('message delivered', { messageId: msg._id });
        }
      }
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
    const { chatId, senderId } = req.body;
    const file = req.file;

    if (!file || !chatId || !senderId) {
      return res.status(400).json({ message: 'File, chatId, and senderId are required' });
    }

    if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(senderId)) {
      return res.status(400).json({ message: 'Invalid chatId or senderId format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.users.some((u) => u.toString() === req.user?._id.toString())) {
      return res.status(403).json({ message: 'Unauthorized for this chat' });
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
      readBy: [senderId], // Sender has read their own message
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
      readBy: message.readBy.map((id) => id.toString()),
    };

    io.to(chatId).emit('message received', messageData);

    // Emit 'message delivered' to other users in chat if online
    chat.users.forEach((userId) => {
      if (userId.toString() !== senderId && onlineUsers.has(userId.toString())) {
        io.to(chatId).emit('message delivered', { messageId: message._id });
      }
    });

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Upload Image Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id;

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    // Bulk update to mark messages as read without triggering timestamps
    const result = await Message.updateMany(
      { chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    // Emit 'message read' for updated messages
    const updatedMessages = await Message.find({
      chatId,
      readBy: userId,
    }).select('_id');
    for (const msg of updatedMessages) {
      io.to(chatId).emit('message read', { messageId: msg._id, readBy: userId });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark As Read Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content, senderId } = req.body;

    if (!chatId || !content || !senderId) {
      return res.status(400).json({ message: 'chatId, content, and senderId are required' });
    }

    if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(senderId)) {
      return res.status(400).json({ message: 'Invalid chatId or senderId format' });
    }

    if (senderId !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized sender' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.users.some((u) => u.toString() === senderId)) {
      return res.status(403).json({ message: 'Unauthorized for this chat' });
    }

    const message = await Message.create({
      _id: new mongoose.Types.ObjectId(),
      chatId,
      senderId,
      text: content,
      readBy: [senderId], // Sender has read their own message
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
      readBy: message.readBy.map((id) => id.toString()),
    };

    io.to(chatId).emit('message received', messageData);

    // Emit 'message delivered' to other users in chat if online
    chat.users.forEach((userId) => {
      if (userId.toString() !== senderId && onlineUsers.has(userId.toString())) {
        io.to(chatId).emit('message delivered', { messageId: message._id });
      }
    });

    res.status(201).json(messageData);
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id;

    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Invalid chatId format' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat || !chat.users.some((u) => u.toString() === userId.toString())) {
      return res.status(403).json({ message: 'Unauthorized for this chat' });
    }

    // Mark messages as read using updateMany to avoid updating timestamps
    await Message.updateMany(
      { chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    // Emit 'message read' for updated messages
    const updatedMessages = await Message.find({
      chatId,
      readBy: userId,
    }).select('_id');
    for (const msg of updatedMessages) {
      io.to(chatId).emit('message read', { messageId: msg._id, readBy: userId });
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
        readBy: msg.readBy.map((id) => id.toString()),
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

    const chats = await Chat.find({ users: userId })
      .populate('users', 'username')
      .populate('latestMessage')
      .lean()
      .exec();
    res.json(chats);
  } catch (error) {
    console.error('Get User Chats Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid messageId format' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to delete this message' });
    }

    message.isDeleted = true;
    await message.save();

    // Update latestMessage if this was the latest message
    const chat = await Chat.findById(message.chatId);
    if (chat && chat.latestMessage?.toString() === id) {
      const latestNonDeletedMessage = await Message.findOne({
        chatId: message.chatId,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .exec();
      await Chat.findByIdAndUpdate(message.chatId, {
        latestMessage: latestNonDeletedMessage?._id || null,
      });
    }

    io.to(message.chatId.toString()).emit('message deleted', { messageId: id });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete Message Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const editMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid messageId format' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user?._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized to edit this message' });
    }

    message.text = text;
    message.isEdited = true;
    message.updatedAt = new Date();
    await message.save();

    // Update chat's updatedAt if this was the latest message
    await Chat.findByIdAndUpdate(message.chatId, { updatedAt: new Date() });

    const messageData = {
      ...message.toJSON(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
      readBy: message.readBy.map((id) => id.toString()),
    };

    io.to(message.chatId.toString()).emit('message edited', messageData);
    res.status(200).json({ success: true, message: messageData });
  } catch (error) {
    console.error('Edit Message Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};