import React from 'react';
import { FaUser } from 'react-icons/fa';
import type { IUser } from '../types';

interface RightSidebarProps {
  user: IUser;
  mediaImages?: string[];
}

const RightSidebar: React.FC<RightSidebarProps> = ({ user, mediaImages = [] }) => {
  const DefaultAvatar = ({ size = 'w-24 h-24' }: { size?: string }) => (
    <div className={`${size} bg-gray-600 rounded-full flex items-center justify-center mx-auto`}>
      <FaUser className="text-gray-400 text-2xl" />
    </div>
  );

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
          <p className="text-sm text-gray-400">
            {user.bio || 'No bio available'}
          </p>
          <div className="mt-2">
            <span
              className={`inline-block w-3 h-3 rounded-full mr-2 ${
                user.status === 'Online' ? 'bg-green-400' : 'bg-gray-500'
              }`}
            />
            <span
              className={`text-sm ${
                user.status === 'Online' ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              {user.status}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="text-md font-semibold mb-3 text-purple-400">Shared Media</h3>
        <div className="grid grid-cols-2 gap-2">
          {mediaImages.map((src, i) => (
            <div key={i} className="aspect-square">
              <img
                src={src}
                className="w-full h-full rounded-lg object-cover hover:opacity-80 cursor-pointer transition-opacity"
                alt={`media-${i}`}
              />
            </div>
          ))}
        </div>
        {mediaImages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No shared media yet</p>
        )}
      </div>
    </div>
  );
};

export default RightSidebar;