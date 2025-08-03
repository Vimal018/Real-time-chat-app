// src/components/ChatContainer.tsx
import React, { useRef, useState, useEffect } from "react";
import { FiSend, FiImage, FiSmile, FiInfo } from "react-icons/fi";
import { FaUser } from "react-icons/fa";
import type { IUser, IMessage } from "../types";
import { sendMessageAPI } from "../api/message";
import { socket } from "../lib/socket";
import { toast } from "../hooks/use-toast";

interface Props {
  user: IUser;
  currentUser: IUser;
  chatId: string;
  messages: IMessage[];
  setMessages: React.Dispatch<React.SetStateAction<IMessage[]>>;
  onSendImage: (file: File) => void;
}

const ChatContainer: React.FC<Props> = ({
  user,
  currentUser,
  chatId,
  messages,
  setMessages,
  onSendImage,
}) => {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const DefaultAvatar = ({ size = "w-8 h-8" }: { size?: string }) => (
    <div className={`${size} bg-gray-600 rounded-full flex items-center justify-center`}>
      <FaUser className="text-gray-400 text-sm" />
    </div>
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (chatId) {
      socket.emit("join chat", chatId);

      socket.on("message received", (newMsg: IMessage) => {
        if (newMsg.chatId === chatId) {
          setMessages((prev) => [...prev, newMsg]);
        }
      });

      socket.on("connect_error", (err) => {
        console.error("Socket.IO connect error:", err.message);
        toast({ title: "Connection error", variant: "destructive" });
      });

      return () => {
        socket.off("message received");
        socket.off("connect_error");
      };
    }
  }, [chatId, setMessages]);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({ title: "Message cannot be empty", variant: "destructive" });
      return;
    }
    if (!chatId || !currentUser?._id) {
      toast({ title: "Chat or user not initialized", variant: "destructive" });
      return;
    }

    try {
      const newMsg = await sendMessageAPI({
        chatId,
        content: message.trim(),
        senderId: currentUser._id,
      });

      setMessages((prev) => [...prev, newMsg]);
      socket.emit("new message", newMsg);
      setMessage("");
    } catch (err: any) {
      console.error("Message send failed:", err);
      toast({ title: err.response?.data?.message || "Failed to send message", variant: "destructive" });
    }
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!chatId || !currentUser?._id) {
        toast({ title: "Chat or user not initialized", variant: "destructive" });
        return;
      }
      onSendImage(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const isFromMe = (msg: IMessage) =>
    typeof msg.senderId === "string"
      ? msg.senderId === currentUser._id
      : msg.senderId._id === currentUser._id;

  return (
    <div className="flex flex-col flex-1 text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <DefaultAvatar size="w-10 h-10" />
          )}
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-gray-400">Chat</p>
          </div>
        </div>
        <FiInfo className="text-xl cursor-pointer hover:text-purple-400" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-center">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover mx-auto"
                />
              ) : (
                <DefaultAvatar size="w-20 h-20 mx-auto" />
              )}
              <h3 className="text-lg font-semibold text-white">{user.name}</h3>
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const fromMe = isFromMe(msg);
            return (
              <div
                key={msg._id}
                className={`flex items-end gap-2 ${fromMe ? "justify-end" : "justify-start"}`}
              >
                {!fromMe && !msg.imageUrl && (
                  user.avatar ? (
                    <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <DefaultAvatar />
                  )
                )}
                <div>
                  <div
                    className={`max-w-xs p-3 rounded-xl ${
                      fromMe ? "bg-purple-600 ml-auto" : "bg-gray-700"
                    }`}
                  >
                    {msg.imageUrl ? (
                      <img src={msg.imageUrl} alt="Shared" className="rounded-lg max-w-full" />
                    ) : (
                      <p className="text-sm">{msg.text }</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
                {fromMe && (
                  currentUser.avatar ? (
                    <img src={currentUser.avatar} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <DefaultAvatar />
                  )
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-700 bg-black/40 backdrop-blur-sm">
        <FiSmile className="text-2xl cursor-pointer hover:text-purple-400" />
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          className="flex-1 px-4 py-2 rounded-full bg-[#1f1e26] text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <FiImage
          className="text-2xl cursor-pointer hover:text-purple-400"
          onClick={handleImageUploadClick}
        />
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={!message.trim() || !chatId || !currentUser?._id}
          className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSend className="text-white text-xl" />
        </button>
      </div>
    </div>
  );
};

export default ChatContainer;