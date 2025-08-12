import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsThreeDotsVertical } from "react-icons/bs";
import { FaUser, FaEdit, FaCheck, FaTimes, FaSignOutAlt } from "react-icons/fa";
import API from "../lib/axios";
import { socket } from "../lib/socket";
import { toast } from "../hooks/use-toast";
import { getOnlineUsersAPI } from '../api/message';

interface IUser {
  _id: string;
  name: string;
  status: "Online" | "Offline";
  avatar?: string;
  bio?: string;
  email: string;
}

interface SidebarProps {
  onUserSelect: (user: IUser) => void;
  onResetUser: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onUserSelect, onResetUser }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState<IUser>({
    _id: "",
    name: "",
    status: "Online",
    avatar: "",
    bio: "",
    email: "",
  });
  const [editForm, setEditForm] = useState({ name: "", avatar: "", bio: "" });
  const [userList, setUserList] = useState<IUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get(`${API_BASE_URL}/api/users/me`);
        const user = res.data;
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("userId", user._id);
        setCurrentUser({ ...user, status: "Online" });
        setEditForm({
          name: user.name || "",
          avatar: user.avatar || "",
          bio: user.bio || "",
        });
        socket.emit("join", user._id);
        console.log(
          'Sidebar fetch user (Upstash Redis):',
          'UserId:', user._id,
          'Name:', user.name,
          'Timestamp:', new Date().toISOString()
        );
      } catch (err: any) {
        console.error("Sidebar fetch user error:", err.response?.data || err.message);
        if (err.response?.status === 401) {
          localStorage.clear();
          navigate("/login");
        }
        toast({ title: "Failed to load user", variant: "destructive" });
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await API.get(`${API_BASE_URL}/api/users`);
        setUserList(res.data);
        console.log(
          'Sidebar fetch users (Upstash Redis):',
          'Users:', res.data.map((u: IUser) => ({ id: u._id, name: u.name })),
          'Timestamp:', new Date().toISOString()
        );
      } catch (err: any) {
        console.error("Sidebar fetch users error:", err.response?.data || err.message);
        if (err.response?.status === 401) {
          localStorage.clear();
          navigate("/login");
        }
        toast({ title: "Failed to load users", variant: "destructive" });
      }
    };

    const fetchOnlineUsers = async () => {
      try {
        const onlineUsers = await getOnlineUsersAPI();
        setOnlineUsers(onlineUsers);
        console.log(
          'Sidebar initial (Upstash Redis):',
          onlineUsers,
          'Current user:', currentUser._id,
          'Timestamp:', new Date().toISOString()
        );
      } catch (err: any) {
        console.error('Sidebar fetch online users error:', err.response?.data || err.message);
        toast({ title: 'Failed to load online users', variant: 'destructive' });
      }
    };

    fetchUser();
    fetchUsers();
    fetchOnlineUsers();

    socket.on("onlineUsers", (users: string[]) => {
      setOnlineUsers(users);
      console.log(
        'Sidebar (Redis Socket.IO):',
        users,
        'Current user:', currentUser._id,
        'Timestamp:', new Date().toISOString()
      );
    });

    return () => {
      socket.off("onlineUsers");
    };
  }, [navigate, currentUser._id]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditForm({ ...editForm, avatar: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await API.put(`${API_BASE_URL}/api/users/profile`, {
        name: editForm.name,
        avatar: editForm.avatar,
        bio: editForm.bio,
      });

      const res = await API.get(`${API_BASE_URL}/api/users/me`);
      const updatedUser = res.data;

      localStorage.setItem("user", JSON.stringify(updatedUser));
      localStorage.setItem("userId", updatedUser._id);
      setCurrentUser({ ...updatedUser, status: "Online" });
      setEditForm({
        name: updatedUser.name || "",
        avatar: updatedUser.avatar || "",
        bio: updatedUser.bio || "",
      });

      setShowEditProfile(false);
      setShowDropdown(false);
      toast({ title: "Profile updated!" });
    } catch (error) {
      console.error("Sidebar update profile error:", error);
      toast({ title: "Profile update failed", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    socket.disconnect();
    navigate("/login");
  };

  const DefaultAvatar = ({ size = "w-8 h-8" }: { size?: string }) => (
    <div className={`${size} bg-gray-600 rounded-full flex items-center justify-center`}>
      <FaUser className="text-gray-400 text-sm" />
    </div>
  );

  return (
    <div className="w-[25%] border-r border-gray-700 p-4 text-white relative">
      <div className="flex items-center justify-between mb-6">
        <div
          onClick={onResetUser}
          className="flex items-center gap-2 text-2xl font-bold text-purple-400 cursor-pointer"
        >
          <img src="/favicon.svg" alt="Chat Icon" className="w-6 h-6 object-contain" />
          QuickChat
        </div>

        <div className="flex items-center gap-2">
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <DefaultAvatar />
          )}

          <div className="relative">
            <BsThreeDotsVertical
              className="text-xl cursor-pointer hover:text-purple-400"
              onClick={() => setShowDropdown(!showDropdown)}
            />
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-[#1f1e26] text-white rounded-lg shadow-lg z-10 border border-gray-600">
                <button
                  onClick={() => setShowEditProfile(true)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                >
                  <FaEdit className="text-sm" />
                  Edit Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-b-lg text-red-400 flex items-center gap-2"
                >
                  <FaSignOutAlt className="text-sm" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1f1e26] p-6 rounded-lg w-80 border border-gray-600">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Edit Profile</h2>

            <div className="text-center mb-4">
              {editForm.avatar ? (
                <img
                  src={editForm.avatar}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover mx-auto"
                />
              ) : (
                <DefaultAvatar size="w-20 h-20 mx-auto" />
              )}
              <label className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded cursor-pointer text-sm mt-2 inline-block">
                Upload Picture
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1">Username</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm mb-1">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                className="flex-1 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <FaCheck /> Save
              </button>
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded flex items-center justify-center gap-2"
              >
                <FaTimes /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {userList
          .filter((user) => user._id !== currentUser._id)
          .map((user) => (
            <div
              key={user._id}
              onClick={() => onUserSelect(user)}
              className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <DefaultAvatar size="w-10 h-10" />
              )}

              <div className="flex-1">
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-sm text-gray-400">{user.bio}</div>
              </div>

              <div
                className={`w-3 h-3 rounded-full ${
                  onlineUsers.includes(user._id) ? 'bg-green-400' : 'bg-gray-400'
                }`}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default Sidebar;