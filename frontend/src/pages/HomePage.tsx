// src/pages/HomePage.tsx
import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import RightSidebar from "../components/RightSidebar";
import { socket } from "../lib/socket";
import type { IUser, IMessage } from "../types";
import API from "../lib/axios";
import { toast } from "../hooks/use-toast";

const HomePage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [chatId, setChatId] = useState<string>("");
  const [messages, setMessages] = useState<IMessage[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser: IUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        toast({ title: "Session error", variant: "destructive" });
        window.location.href = "/login";
      }
    } else {
      toast({ title: "Please log in", variant: "destructive" });
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    if (selectedUser && currentUser) {
      const fetchOrCreateChat = async () => {
        try {
          // Fetch or create a chat with the two users
          const res = await API.post("/chats", {
            userIds: [currentUser._id, selectedUser._id],
          });
          const newChatId = res.data._id;
          if (!newChatId) {
            throw new Error("Chat ID not returned from server");
          }
          setChatId(newChatId);

          // Fetch messages for the chat
          const messagesRes = await API.get(`/messages/${newChatId}`);
          setMessages(messagesRes.data);

          // Join Socket.IO room
          socket.emit("join chat", newChatId);

          socket.on("message received", (message: IMessage) => {
            if (message.chatId === newChatId) {
              setMessages((prev) => [...prev, message]);
            }
          });

          return () => {
            socket.off("message received");
          };
        } catch (error: any) {
          console.error("Failed to fetch or create chat:", error);
          toast({
            title: error.response?.data?.message || "Failed to load chat",
            variant: "destructive",
          });
        }
      };

      fetchOrCreateChat();
    }
  }, [selectedUser, currentUser]);

  const handleSendImage = async (file: File) => {
    if (!chatId || !currentUser?._id) {
      toast({ title: "Chat or user not initialized", variant: "destructive" });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chatId", chatId);
      formData.append("senderId", currentUser._id);

      const res = await API.post("/messages/image", formData);
      const newMessage = res.data;
      setMessages((prev) => [...prev, newMessage]);
      socket.emit("new message", newMessage);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Failed to upload image", variant: "destructive" });
    }
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="flex w-[90%] h-[90%] bg-black/60 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 shadow-2xl">
        <Sidebar
          onUserSelect={setSelectedUser}
          onResetUser={() => setSelectedUser(null)}
        />
        {selectedUser ? (
          <>
            <ChatContainer
              user={selectedUser}
              currentUser={currentUser}
              chatId={chatId}
              messages={messages}
              setMessages={setMessages}
              onSendImage={handleSendImage}
            />
            <RightSidebar user={selectedUser} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold">Welcome to QuickChat</h2>
              <p className="text-gray-400">Select a user to start chatting</p>
              <div className="text-sm text-gray-500 mt-4">
                <p>💬 Chat anytime, anywhere</p>
                <p>🚀 Fast and secure messaging</p>
                <p>📸 Share photos and media</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;