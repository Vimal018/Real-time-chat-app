import React, { useState, useEffect } from 'react';
import { FaUser, FaDownload } from 'react-icons/fa';
import { socket } from '../lib/socket';
import { getOnlineUsersAPI } from '../api/message';
import { toast } from '../hooks/use-toast';
import type { IUser } from '../types';

interface RightSidebarProps {
  user: IUser;
  mediaImages?: string[];
}

const RightSidebar: React.FC<RightSidebarProps> = ({ user, mediaImages = [] }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const DefaultAvatar = ({ size = 'w-24 h-24' }: { size?: string }) => (
    <div className={`${size} bg-gray-600 rounded-full flex items-center justify-center mx-auto`}>
      <FaUser className="text-gray-400 text-2xl" />
    </div>
  );

  useEffect(() => {
    if (!user?._id) return;

    const fetchOnlineUsers = async () => {
      try {
        const onlineUsers = await getOnlineUsersAPI();
        const online = onlineUsers.includes(user._id);
        setIsOnline(online);
        console.log(
          `RightSidebar initial (Upstash Redis): User ${user._id} is ${online ? 'Online' : 'Offline'}`,
          'Online users:', onlineUsers,
          'Timestamp:', new Date().toISOString()
        );
      } catch (err: any) {
        console.error('RightSidebar fetch online users error:', err.response?.data || err.message);
        toast({ title: 'Failed to load online users', variant: 'destructive' });
      }
    };

    fetchOnlineUsers();

    const handleOnlineUsers = (onlineUsers: string[]) => {
      const online = onlineUsers.includes(user._id);
      setIsOnline(online);
      console.log(
        `RightSidebar (Redis Socket.IO): User ${user._id} is ${online ? 'Online' : 'Offline'}`,
        'Online users:', onlineUsers,
        'Timestamp:', new Date().toISOString()
      );
    };

    socket.off('onlineUsers', handleOnlineUsers);
    socket.on('onlineUsers', handleOnlineUsers);

    socket.emit('join', user._id);

    return () => {
      socket.off('onlineUsers', handleOnlineUsers);
    };
  }, [user?._id]);

  const handleDownload = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop() || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageClick = (src: string) => {
    setSelectedImage(src);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  return (
    <div className="w-[25%] border-l border-gray-700 p-4 text-white hidden sm:block bg-black/70 backdrop-blur-md rounded-r-xl">
      <div className="text-center space-y-3">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt="Profile"
            className="w-24 h-24 rounded-full mx-auto object-cover"
          />
        ) : (
          <DefaultAvatar />
        )}
        <div>
          <h2 className="text-lg font-bold">{user.name}</h2>
          <p className="text-sm text-gray-400">{user.bio || 'No bio available'}</p>
          <div className="mt-2">
            <span
              className={`inline-block w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`}
            />
            <span className={`text-sm ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="text-md font-semibold mb-3 text-purple-400">Shared Media</h3>
        <div className="grid grid-cols-2 gap-2">
          {mediaImages.map((src, i) => (
            <div key={i} className="aspect-square relative group">
              <img
                src={src}
                className="w-full h-full rounded-lg object-cover hover:opacity-80 cursor-pointer transition-opacity"
                alt={`media-${i}`}
                onClick={() => handleImageClick(src)}
              />
              <button
                onClick={() => handleDownload(src)}
                className="absolute bottom-2 right-2 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
                title="Download"
              >
                <FaDownload className="text-white text-sm" />
              </button>
            </div>
          ))}
        </div>
        {mediaImages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No shared media yet</p>
        )}
      </div>
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="relative max-w-3xl w-full">
            <img src={selectedImage} alt="Full view" className="w-full h-auto rounded-lg" />
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 p-2 bg-gray-800 rounded-full hover:bg-gray-700"
            >
              <span className="text-white text-lg">×</span>
            </button>
            <button
              onClick={() => handleDownload(selectedImage)}
              className="absolute bottom-2 right-2 p-2 bg-purple-600 rounded-full hover:bg-purple-700"
              title="Download"
            >
              <FaDownload className="text-white text-lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSidebar;