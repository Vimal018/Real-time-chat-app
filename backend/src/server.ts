import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes"; // 👈 Make sure to import this
import cookieParser from "cookie-parser";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// 🔐 Use env for frontend origin
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new SocketServer(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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

// 💬 Socket.io events
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("join-chat", (roomId) => {
    socket.join(roomId);
  });

  socket.on("send-message", (data) => {
    io.to(data.chatId).emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    console.log("🚫 User disconnected:", socket.id);
  });
});

// 🚀 Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
