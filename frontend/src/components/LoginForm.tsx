
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../hooks/use-toast";
import { useAuth } from "../context/AuthContext"; // adjust the path if needed


interface LoginFormProps {
  onSwitchToSignUp: () => void;
}

const LoginForm = ({ onSwitchToSignUp }: LoginFormProps) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

// LoginForm.tsx
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    // Clear previous tokens
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // Save new token
    localStorage.setItem("token", data.token);

    // Fetch user profile
    const profileRes = await fetch(`${API_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${data.token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    const fullUser = await profileRes.json();
    if (!profileRes.ok) {
      throw new Error(fullUser.message || "Failed to fetch user profile");
    }

    localStorage.setItem("user", JSON.stringify(fullUser));
    toast({ title: "Login successful" });
    login(data.token, fullUser);
    navigate("/");
  } catch (err: any) {
    console.error("Login error:", err.message);
    toast({ title: err.message, variant: "destructive" });
  }
};


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Login</h2>
        <p className="text-gray-300">Welcome back to QuickChat</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white text-sm font-medium">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={formData.rememberMe}
              onCheckedChange={(checked) => setFormData({ ...formData, rememberMe: checked === true })}
              className="border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
            />
            <Label htmlFor="remember" className="text-sm text-gray-300 cursor-pointer">
              Remember me
            </Label>
          </div>
          <button
            type="button"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
        >
          Login Now
        </Button>

        <div className="text-center">
          <span className="text-gray-400">Create an account? </span>
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Click here
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default LoginForm;
