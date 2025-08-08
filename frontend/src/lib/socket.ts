import { io } from "socket.io-client";
import { jwtDecode } from "jwt-decode"; // Install: npm install jwt-decode

// Retrieve token and userId
const token = localStorage.getItem("token");
let userId = localStorage.getItem("userId");
if (token && !userId) {
  try {
    const decoded: { id: string } = jwtDecode(token); // Adjust based on token payload
    userId = decoded.id; // Match server.ts JWT payload
    localStorage.setItem("userId", userId);
  } catch (error) {
    console.error("Failed to decode token:", error);
  }
}

const socket = io("http://localhost:5000", {
  auth: {
    token,
    userId, // Include userId in auth
  },
  query: {
    userId, // Include userId in query
  },
  withCredentials: true,
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("Socket.IO connected");
});

socket.on("connect_error", async (err) => {
  console.error("Socket.IO connect error:", err.message);
  if (err.message === "Authentication error: Invalid token" || err.message === "Authentication error: No token") {
    try {
      const res = await fetch("http://localhost:5000/api/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        const decoded: { id: string } = jwtDecode(data.token);
        localStorage.setItem("userId", decoded.id);
        socket.auth = { token: data.token, userId: decoded.id };
        socket.io.opts.query = { userId: decoded.id };
        socket.connect();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Socket.IO token refresh failed:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      window.location.href = "/login";
    }
  } else if (err.message === "User ID missing in connection") {
    console.error("User ID missing, redirecting to login");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.href = "/login";
  }
});

export const updateSocketToken = (token: string, userId: string) => {
  socket.auth = { token, userId };
  socket.io.opts.query = { userId };
  socket.connect();
};

if (token && userId) {
  socket.connect();
}

export { socket };