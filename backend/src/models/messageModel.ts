import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  isEdited: boolean;
  readBy: mongoose.Types.ObjectId[]; // Array of user IDs who have read the message
}

const messageSchema = new Schema<IMessage>(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMessage>('Message', messageSchema);