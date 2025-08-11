import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatContainer from '../components/ChatContainer';
import RightSidebar from '../components/RightSidebar';
import { socket } from '../lib/socket';
import type { IUser, IMessage } from '../types';
import API from '../lib/axios';
import { toast } from '../hooks/use-toast';

const HomePage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [chatId, setChatId] = useState<string>('');
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [messageCache, setMessageCache] = useState<{ [chatId: string]: IMessage[] }>({});
  const [userChatIds, setUserChatIds] = useState<string[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser: IUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        console.log('Current user:', parsedUser);
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error);
        toast({ title: 'Session error', variant: 'destructive' });
        window.location.href = '/login';
      }
    } else {
      toast({ title: 'Please log in', variant: 'destructive' });
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const fetchUserChats = async () => {
        try {
          const res = await API.get('/api/chats');
          const chatIds = res.data.map((chat: any) => chat._id);
          setUserChatIds(chatIds);
          console.log('User chat IDs:', chatIds);

          chatIds.forEach((id: string) => socket.emit('join chat', id));

          const newCache: { [chatId: string]: IMessage[] } = {};
          for (const id of chatIds) {
            const messagesRes = await API.get(`/api/messages/${id}`);
            newCache[id] = messagesRes.data;
          }
          setMessageCache(newCache);
          console.log('Initial message cache:', newCache);
        } catch (error: any) {
          console.error('Failed to fetch user chats:', error);
          toast({ title: 'Failed to load chats', variant: 'destructive' });
        }
      };
      fetchUserChats();
    }
  }, [currentUser]);

  useEffect(() => {
    socket.on('message received', (message: IMessage) => {
      if (userChatIds.includes(message.chatId)) {
        console.log('Received message:', message);
        setMessageCache((prev) => {
          const chatMessages = prev[message.chatId] || [];
          if (chatMessages.some((msg) => msg._id === message._id)) {
            console.log('Duplicate message filtered:', message._id);
            return prev;
          }
          const updatedMessages = chatMessages
            .map((msg) =>
              msg.tempId === message._id ? { ...message, tempId: undefined } : msg
            )
            .concat(message.tempId ? [] : [message]);
          const newCache = { ...prev, [message.chatId]: updatedMessages };
          console.log('Updated message cache:', newCache);
          return newCache;
        });
        if (message.chatId === chatId) {
          setMessages((prev) => {
            if (prev.some((msg) => msg._id === message._id)) {
              return prev;
            }
            return prev
              .map((msg) =>
                msg.tempId === message._id ? { ...message, tempId: undefined } : msg
              )
              .concat(message.tempId ? [] : [message]);
          });
        }
      }
    });

    socket.on('message deleted', (data: { messageId: string }) => {
      setMessageCache((prev) => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach((chatId) => {
          newCache[chatId] = newCache[chatId].map((msg) =>
            msg._id === data.messageId ? { ...msg, isDeleted: true } : msg
          );
        });
        console.log('Updated message cache (delete):', newCache);
        return newCache;
      });
      if (messages.some((msg) => msg._id === data.messageId)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId ? { ...msg, isDeleted: true } : msg
          )
        );
      }
    });

    socket.on('message edited', (newMessage: IMessage) => {
      setMessageCache((prev) => {
        const newCache = { ...prev };
        if (newCache[newMessage.chatId]) {
          newCache[newMessage.chatId] = newCache[newMessage.chatId].map((msg) =>
            msg._id === newMessage._id
              ? { ...newMessage, senderId: newMessage.senderId.toString() }
              : msg
          );
        }
        console.log('Updated message cache (edit):', newCache);
        return newCache;
      });
      if (newMessage.chatId === chatId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === newMessage._id
              ? { ...newMessage, senderId: newMessage.senderId.toString() }
              : msg
          )
        );
      }
    });

    socket.on('message delivered', (data: { messageId: string }) => {
      setMessageCache((prev) => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach((chatId) => {
          newCache[chatId] = newCache[chatId].map((msg) =>
            msg._id === data.messageId && !msg.readBy.includes(selectedUser?._id || '')
              ? { ...msg, readBy: [...msg.readBy, selectedUser?._id || ''] }
              : msg
          );
        });
        return newCache;
      });
      if (messages.some((msg) => msg._id === data.messageId)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId && !msg.readBy.includes(selectedUser?._id || '')
              ? { ...msg, readBy: [...msg.readBy, selectedUser?._id || ''] }
              : msg
          )
        );
      }
    });

    socket.on('message read', (data: { messageId: string; readBy: string }) => {
      setMessageCache((prev) => {
        const newCache = { ...prev };
        Object.keys(newCache).forEach((chatId) => {
          newCache[chatId] = newCache[chatId].map((msg) =>
            msg._id === data.messageId
              ? { ...msg, readBy: [...msg.readBy, data.readBy] }
              : msg
          );
        });
        return newCache;
      });
      if (messages.some((msg) => msg._id === data.messageId)) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId
              ? { ...msg, readBy: [...msg.readBy, data.readBy] }
              : msg
          )
        );
      }
    });

    return () => {
      socket.off('message received');
      socket.off('message deleted');
      socket.off('message edited');
      socket.off('message delivered');
      socket.off('message read');
    };
  }, [chatId, userChatIds, selectedUser?._id]);

  useEffect(() => {
    if (selectedUser && currentUser) {
      const fetchOrCreateChat = async () => {
        try {
          const res = await API.post('/api/chats', {
            userIds: [currentUser._id, selectedUser._id],
          });
          const newChatId = res.data._id;
          if (!newChatId) {
            throw new Error('Chat ID not returned from server');
          }
          setChatId(newChatId);
          console.log('Chat ID:', newChatId);

          if (!userChatIds.includes(newChatId)) {
            setUserChatIds((prev) => [...prev, newChatId]);
            socket.emit('join chat', newChatId);
          }

          if (messageCache[newChatId]) {
            setMessages(messageCache[newChatId]);
            console.log('Loaded messages from cache:', messageCache[newChatId]);
          } else {
            const messagesRes = await API.get(`/api/messages/${newChatId}`);
            setMessages(messagesRes.data);
            setMessageCache((prev) => ({ ...prev, [newChatId]: messagesRes.data }));
            console.log('Fetched messages:', messagesRes.data);
          }
        } catch (error: any) {
          console.error('Failed to fetch or create chat:', error);
          toast({
            title: error.response?.data?.message || 'Failed to load chat',
            variant: 'destructive',
          });
        }
      };

      fetchOrCreateChat();
    } else {
      setMessages([]);
      setChatId('');
    }
  }, [selectedUser, currentUser, userChatIds, messageCache]);

  const handleSendImage = async (file: File) => {
    if (!chatId || !currentUser?._id) {
      toast({ title: 'Chat or user not initialized', variant: 'destructive' });
      return;
    }

    const tempId = crypto.randomUUID();
    const optimisticMsg: IMessage = {
      _id: tempId,
      chatId,
      senderId: currentUser._id,
      text: 'Uploading image...',
      imageUrl: undefined,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isEdited: false,
      readBy: [currentUser._id],
      tempId,
    };

    try {
      setMessages((prev) => [...prev, optimisticMsg]);
      setMessageCache((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []), optimisticMsg],
      }));
      console.log('Optimistic message added:', optimisticMsg);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);
      formData.append('senderId', currentUser._id);

      const res = await API.post('/api/messages/image', formData);
      const newMessage = res.data;
      console.log('Server response message:', newMessage);
      socket.emit('new message', { ...newMessage, tempId });
    } catch (error) {
      console.error('Error uploading image:', error);
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
      setMessageCache((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || []).filter((msg) => msg._id !== tempId),
      }));
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    }
  };

  const mediaImages = selectedUser
    ? messages
        .filter((msg) => {
          const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId._id;
          const matches = senderId === selectedUser._id && msg.imageUrl && !msg.isDeleted;
          console.log(
            'Filter message:',
            { _id: msg._id, senderId, imageUrl: msg.imageUrl, isDeleted: msg.isDeleted },
            'SelectedUserId:',
            selectedUser._id,
            'Matches:',
            matches
          );
          return matches;
        })
        .map((msg) => msg.imageUrl!)
    : [];
  console.log('mediaImages:', mediaImages, 'SelectedUser:', selectedUser?._id);

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="flex w-[90%] h-[90%] bg-black/60 backdrop-blur-md rounded-xl overflow-hidden border border-white/20 shadow-2xl">
        <Sidebar
          onUserSelect={(user) => {
            setSelectedUser(user);
            console.log('Selected user:', user);
          }}
          onResetUser={() => {
            setSelectedUser(null);
            setShowRightSidebar(false);
            console.log('Reset user');
          }}
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
              onUserClick={() => setShowRightSidebar((prev) => !prev)}
              showRightSidebar={showRightSidebar}
            />
            {showRightSidebar && (
              <RightSidebar user={selectedUser} mediaImages={mediaImages} />
            )}
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