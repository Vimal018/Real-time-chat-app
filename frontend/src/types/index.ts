export interface IUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: "Online" | "Offline";
}

export interface IChat {
  _id: string;
  isGroupChat: boolean;
  chatName?: string;
  users: IUser[];
  latestMessage?: IMessage;
  createdAt: string;
  updatedAt: string;
}

export interface IMessage {
  _id: string;
  chatId: string;
  senderId: string | IUser;
  text: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}
