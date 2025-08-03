// src/models/chatModel.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  isGroupChat: boolean;
  chatName?: string;
  users: mongoose.Types.ObjectId[];
  latestMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    isGroupChat: { type: Boolean, default: false },
    chatName: { type: String },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    latestMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

export default mongoose.model<IChat>("Chat", chatSchema);