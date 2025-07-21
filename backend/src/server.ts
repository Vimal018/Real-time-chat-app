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


// 💬 Socket.io events
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL, // Adjust to frontend URL
    methods: ["GET", "POST"],
    credentials: true,
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
