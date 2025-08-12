import { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import fs from 'fs';
import { promisify } from 'util';
import Message from '../models/messageModel';
import Chat from '../models/Chat';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { Server, Socket } from 'socket.io';
import redisClient from '../config/redis';

const unlinkAsync = promisify(fs.unlink);

let io: Server;
const onlineUsers = new Set<string>();
const cacheTTL = 3600; // 1 hour in seconds

export const initSocket = (socketIo: Server) => {
  io = socketIo;

  // Pub/Sub client
  const pubsubClient = redisClient.duplicate();
  (async () => {
    await pubsubClient.connect();
    await pubsubClient.subscribe('user_status', (message) => {
      const { userId, status } = JSON.parse(message);
      console.log(`Redis Pub/Sub: User ${userId} ${status}`, new Date().toISOString());
      io.emit('onlineUsers', Array.from(onlineUsers));
    });
  })();

  io.on('connection', async (socket: Socket) => {
    let userId = socket.handshake.query.userId as string | undefined;
    if (!userId && socket.handshake.auth.userId) {
      userId = socket.handshake.auth.userId;
    }
    console.log('User connected:', { socketId: socket.id, userId }, new Date().toISOString());

    if (!userId) {
      socket.emit('error', { message: 'User ID missing in connection' });
      console.log('Missing userId for socket:', socket.id);
      return;
    }

    const multi = redisClient.multi();
    multi.sAdd('online_users', userId);
    multi.publish('user_status', JSON.stringify({ userId, status: 'online' }));
    await multi.exec();
    onlineUsers.add(userId);
    const users = await redisClient.sMembers('online_users');
    socket.emit('onlineUsers', users);
    io.emit('onlineUsers', users);
    console.log('Global online users:', users, new Date().toISOString());

    socket.on('join chat', async (chatId: string) => {
      if (!mongoose.isValidObjectId(chatId)) {
        socket.emit('error', { message: 'Invalid chatId format' });
        console.log('Invalid chatId:', chatId);
        return;
      }
      socket.join(chatId);
      console.log(`User ${userId} joined chat ${chatId}`);

      await Message.updateMany(
        { chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      const updatedMessages = await Message.find({
        chatId,
        readBy: userId,
      }).select('_id');
      for (const msg of updatedMessages) {
        io.to(chatId).emit('message read', { messageId: msg._id, readBy: userId });
      }

      const messages = await Message.find({ chatId, isDeleted: false });
      for (const msg of messages) {
        if (!msg.readBy.includes(new mongoose.Types.ObjectId(userId)) && msg.senderId.toString() !== userId) {
          io.to(chatId).emit('message delivered', { messageId: msg._id });
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', { socketId: socket.id, userId }, new Date().toISOString());
      const multi = redisClient.multi();
      multi.sRem('online_users', userId!);
      multi.publish('user_status', JSON.stringify({ userId, status: 'offline' }));
      await multi.exec();
      onlineUsers.delete(userId!);
      const users = await redisClient.sMembers('online_users');
      io.emit('onlineUsers', users);
      console.log('Global online users:', users, new Date().toISOString());
    });

    socket.on('getOnlineUsers', async () => {
      const users = await redisClient.sMembers('online_users');
      socket.emit('onlineUsers', users);
      console.log('Sent onlineUsers to socket:', socket.id, users, new Date().toISOString());
    });
  });
};

export const getOnlineUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const onlineUsers = await redisClient.sMembers('online_users');
    res.json({ onlineUsers });
    console.log('GET /api/messages/online-users:', onlineUsers, new Date().toISOString());
  } catch (error) {
    console.error('Get Online Users Error:', error);
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

    const cacheKey = `messages:${chatId}`;
    const cachedMessages = await redisClient.lRange(cacheKey, 0, -1);

    if (cachedMessages.length > 0) {
      console.log(`Cache hit for ${cacheKey}`, new Date().toISOString());
      const messages = cachedMessages.map((msg: string) => JSON.parse(msg));
      return res.json(messages);
    }

    console.log(`Cache miss for ${cacheKey}`, new Date().toISOString());
    await Message.updateMany(
      { chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

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

    if (messages.length > 0) {
      const messageStrings = messages.map((msg) => ({
        ...msg,
        _id: msg._id.toString(),
        senderId: msg.senderId.toString(),
        chatId: msg.chatId.toString(),
        readBy: msg.readBy.map((id) => id.toString()),
      }));
      await redisClient.rPush(cacheKey, messageStrings.map((msg) => JSON.stringify(msg)));
      await redisClient.expire(cacheKey, cacheTTL);
      console.log(`Cached ${messages.length} messages for ${cacheKey}`, new Date().toISOString());
    }

    res.json(messages.map((msg) => ({
      ...msg,
      _id: msg._id.toString(),
      senderId: msg.senderId.toString(),
      chatId: msg.chatId.toString(),
      readBy: msg.readBy.map((id) => id.toString()),
    })));
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content, senderId, tempId } = req.body;

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
      readBy: [senderId],
      createdAt: new Date(),
      isEdited: false,
      isDeleted: false,
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    const messageData = {
      ...message.toJSON(),
      _id: (message._id as mongoose.Types.ObjectId).toString(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
      readBy: message.readBy.map((id) => id.toString()),
      tempId,
    };

    const cacheKey = `messages:${chatId}`;
    await redisClient.rPush(cacheKey, JSON.stringify(messageData));
    await redisClient.expire(cacheKey, cacheTTL);
    console.log(`Cached new message for ${cacheKey}`, new Date().toISOString());

    io.to(chatId).emit('message received', messageData);

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

export const uploadImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, senderId, tempId } = req.body;
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
      readBy: [senderId],
      createdAt: new Date(),
      isEdited: false,
      isDeleted: false,
    });

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });

    const messageData = {
      ...message.toJSON(),
      _id: (message._id as mongoose.Types.ObjectId).toString(),
      senderId: message.senderId.toString(),
      chatId: message.chatId.toString(),
      readBy: message.readBy.map((id) => id.toString()),
      tempId,
    };

    const cacheKey = `messages:${chatId}`;
    await redisClient.rPush(cacheKey, JSON.stringify(messageData));
    await redisClient.expire(cacheKey, cacheTTL);
    console.log(`Cached new image message for ${cacheKey}`, new Date().toISOString());

    io.to(chatId).emit('message received', messageData);

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

    const cacheKey = `messages:${chatId}`;
    const cachedMessages = await redisClient.lRange(cacheKey, 0, -1);

    const result = await Message.updateMany(
      { chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    const updatedMessages = await Message.find({
      chatId,
      readBy: userId,
    }).select('_id readBy');

    for (const msgDoc of updatedMessages) {
      const msg = msgDoc as { _id: mongoose.Types.ObjectId; readBy: mongoose.Types.ObjectId[] };
      io.to(chatId).emit('message read', { messageId: msg._id, readBy: userId });

      if (cachedMessages.length > 0) {
        const updatedCache = cachedMessages.map((cachedMsg: string) => {
          const parsed = JSON.parse(cachedMsg);
          if (parsed._id === msg._id.toString() && !parsed.readBy.includes(userId.toString())) {
            return JSON.stringify({
              ...parsed,
              readBy: [...parsed.readBy, userId.toString()],
            });
          }
          return cachedMsg;
        });
        await redisClient.del(cacheKey);
        await redisClient.rPush(cacheKey, updatedCache);
        await redisClient.expire(cacheKey, cacheTTL);
        console.log(`Updated cached message ${msg._id} readBy for ${cacheKey}`, new Date().toISOString());
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark As Read Error:', error);
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

    const cacheKey = `messages:${message.chatId}`;
    const cachedMessages = await redisClient.lRange(cacheKey, 0, -1);
    if (cachedMessages.length > 0) {
      const updatedCache = cachedMessages.map((cachedMsg: string) => {
        const parsed = JSON.parse(cachedMsg);
        if (parsed._id === id) {
          return JSON.stringify({ ...parsed, isDeleted: true });
        }
        return cachedMsg;
      });
      await redisClient.del(cacheKey);
      await redisClient.rPush(cacheKey, updatedCache);
      await redisClient.expire(cacheKey, cacheTTL);
      console.log(`Updated cached message ${id} isDeleted for ${cacheKey}`, new Date().toISOString());
    }

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

    const cacheKey = `messages:${message.chatId}`;
    const cachedMessages = await redisClient.lRange(cacheKey, 0, -1);
    if (cachedMessages.length > 0) {
      const updatedCache = cachedMessages.map((cachedMsg: string) => {
        const parsed = JSON.parse(cachedMsg);
        if (parsed._id === id) {
          return JSON.stringify({
            ...parsed,
            text,
            isEdited: true,
            updatedAt: message.updatedAt.toISOString(),
          });
        }
        return cachedMsg;
      });
      await redisClient.del(cacheKey);
      await redisClient.rPush(cacheKey, updatedCache);
      await redisClient.expire(cacheKey, cacheTTL);
      console.log(`Updated cached message ${id} for ${cacheKey}`, new Date().toISOString());
    }

    await Chat.findByIdAndUpdate(message.chatId, { updatedAt: new Date() });

    const messageData = {
      ...message.toJSON(),
      _id: (message._id as mongoose.Types.ObjectId).toString(),
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