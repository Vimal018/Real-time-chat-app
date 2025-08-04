// src/lib/socket.ts
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: localStorage.getItem("token"),
  },

  withCredentials: true,
  autoConnect: false,
});

socket.on("connect_error", async (err) => {
  if (err.message === "Authentication error: Invalid token") {
    try {
      const res = await fetch("http://localhost:5000/api/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        socket.auth = { token: data.token };
        socket.connect();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Socket.IO token refresh failed:", error);
      window.location.href = "/login";
    }
  }
});
export const updateSocketToken = (token: string) => {
  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
};

socket.connect();

export { socket };