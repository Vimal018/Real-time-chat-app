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
  const { data } = await axios.get<IMessage[]>(`/messages/${chatId}`);
  return data;
};
