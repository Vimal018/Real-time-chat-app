import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes"; // 👈 Make sure to import this
import cookieParser from "cookie-parser";
import messageRoutes from "./routes/messageRoutes";
import { Server } from "socket.io";
import Message from "./models/messageModel";
import chatroutes from "./routes/chatRoutes"; // 👈 Import chat routes
import jwt from "jsonwebtoken";
import User from "./models/User";




// Load environment variables
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ||  'supersecretkey';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// 🔐 Use env for frontend origin
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";


// 🔧 Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// 🔗 Routes
app.use("/api/status", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes); // 👈 Mount the auth routes
app.use("/api/messages", messageRoutes);
app.use("/api/chats", chatroutes); // 👈 Mount chat routes

// 💬 Socket.io events
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL, // Adjust to frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  }
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token"));
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as jwt.JwtPayload;
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return next(new Error("Authentication error: User not found"));

    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});


io.on("connection", (socket) => {
  console.log("⚡ User connected", socket.id);

  socket.on("join chat", (roomId) => {
    socket.join(roomId);
    console.log(`✅ Joined room: ${roomId}`);
  });

  socket.on("new message", (message) => {
    const roomId = message.chatId;
    socket.to(roomId).emit("message received", message); // emits to all except sender
    console.log("📩 New message emitted to room:", roomId);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected", socket.id);
  });
});


// 🚀 Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
