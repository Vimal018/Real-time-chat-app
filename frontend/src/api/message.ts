import axios from "../lib/axios";
import API from "../lib/axios";
import type { IMessage } from "../types";


interface MessagePayload {
  chatId: string;
  content: string;
  senderId: string;
}

export const sendMessageAPI = async (payload: MessagePayload): Promise<IMessage> => {
  const res = await API.post("/api/messages", {
    ...payload,
    text: payload.content, // Map content to text
  });
  return res.data;
};

export const getMessages = async (chatId: string): Promise<IMessage[]> => {
  const { data } = await axios.get<IMessage[]>(`/api/messages/${chatId}`);
  return data;
};

export const editMessageAPI = async (messageId: string, text: string): Promise<IMessage> => {
  const response = await API.put(`/api/messages/${messageId}`, { text });
  return response.data.message;
};

export const deleteMessageAPI = async (messageId: string): Promise<void> => {
  await API.delete(`/api/messages/${messageId}`);
};

export const getOnlineUsersAPI = async (): Promise<string[]> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  const response = await API.get('/api/messages/online-users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.onlineUsers;
};