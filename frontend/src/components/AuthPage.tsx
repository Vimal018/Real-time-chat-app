
import { useEffect} from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoginForm from "./LoginForm";
import SignUpForm from "./SignUpForm";
import ChatBubbleLogo from "./ChatBubbleLogo";
import { useLocation, useNavigate } from "react-router-dom";

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === "/login";

  // Redirect to login if route is invalid (optional)
  useEffect(() => {
    if (!["/login", "/signup"].includes(location.pathname)) {
      navigate("/login");
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="w-full max-w-6xl mx-auto flex items-center justify-between relative z-10">
        {/* Left side - Logo and branding */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 pr-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <ChatBubbleLogo />
            <motion.h1 
              className="text-6xl font-bold text-white mt-8 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              QuickChat
            </motion.h1>
            <motion.p 
              className="text-xl text-gray-300 max-w-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              Connect instantly with friends and colleagues in a beautiful, modern chat experience.
            </motion.p>
          </motion.div>
        </div>

        {/* Right side - Auth forms */}
        <div className="w-full lg:w-auto lg:flex-shrink-0">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 w-full max-w-md mx-auto lg:w-96"
          >
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-block">
                <ChatBubbleLogo size="small" />
              </div>
              <h1 className="text-3xl font-bold text-white mt-4">QuickChat</h1>
            </div>

             <AnimatePresence mode="wait">
              {isLogin ? (
                <LoginForm key="login" onSwitchToSignUp={() => navigate("/signup")} />
              ) : (
                <SignUpForm key="signup" onSwitchToLogin={() => navigate("/login")} />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
