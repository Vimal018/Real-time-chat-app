
import axios from "../lib/axios"; // use your configured axios instance

export const accessChatAPI = async (senderId: string, receiverId: string) => {
  try {
    const response = await axios.post("/chats", {
      senderId,
      receiverId,
    });
    return response.data;
  } catch (error) {
    console.error("Error accessing chat:", error);
    throw error;
  }
};

export const fetchChatsAPI = async () => {
  try {
    const response = await axios.get("/chats");
    return response.data;
  } catch (error) {
    console.error("Error fetching chats:", error);
    throw error;
  }
};
