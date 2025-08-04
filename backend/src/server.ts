import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import cookieParser from 'cookie-parser';
import messageRoutes from './routes/messageRoutes';
import chatRoutes from './routes/chatRoutes';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User';
import { initSocket } from './controllers/messageController';
import mongoose from 'mongoose';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || ['http://localhost:5173', 'http://192.168.x.x:5173'];
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'supersecretkey';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/status', (req, res) => {
  res.status(200).json({ status: 'Server is running' });
});
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/chats', chatRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Track online users, typing, and processed messages
const onlineUsers = new Map<string, { socketId: string; name: string }>(); // userId -> { socketId, name }
const typingUsers = new Map<string, number>(); // userId:chatId -> lastTypingTimestamp
const processedMessages = new Set<string>(); // Track processed message IDs

// Socket.IO Authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token'));
  }
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Initialize Socket.IO in messageController
initSocket(io);

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`⚡ User connected: ${socket.data.user._id}`);

  // Add user to online users
  onlineUsers.set(socket.data.user._id.toString(), {
    socketId: socket.id,
    name: socket.data.user.name,
  });
  io.emit('onlineUsers', Array.from(onlineUsers.entries()).map(([userId, data]) => ({
    userId,
    name: data.name,
  })));

  // Join chat room
  socket.on('join chat', (chatId: string) => {
    if (mongoose.isValidObjectId(chatId)) {
      socket.join(chatId);
      console.log(`✅ User ${socket.data.user._id} joined chat: ${chatId}`);
    } else {
      console.log(`❌ Invalid chatId: ${chatId}`);
    }
  });

  // Handle new message
  socket.on('new message', (message: { _id: string; chatId: string; senderId: string; text: string; imageUrl?: string; tempId?: string }) => {
    if (!processedMessages.has(message._id)) {
      processedMessages.add(message._id);
      socket.to(message.chatId).emit('message received', {
        ...message,
        senderId: message.senderId.toString(),
        createdAt: new Date(),
      });
      console.log(`📩 New message emitted to chat: ${message.chatId}`);
      if (processedMessages.size > 10000) {
        processedMessages.clear();
      }
    }
  });

  // Handle typing indicator with rate-limiting
  socket.on('typing', (data: { chatId: string; userId: string; name: string }) => {
    const key = `${data.userId}:${data.chatId}`;
    const lastTypingTime = typingUsers.get(key) || 0;
    const now = Date.now();
    if (now - lastTypingTime > 500) {
      typingUsers.set(key, now);
      socket.to(data.chatId).emit('typing', { userId: data.userId, name: data.name });
      console.log(`✍️ User ${data.userId} (${data.name}) is typing in chat: ${data.chatId}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.data.user._id}`);
    onlineUsers.delete(socket.data.user._id.toString());
    io.emit('onlineUsers', Array.from(onlineUsers.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
    })));
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});