
import { motion } from "framer-motion";

interface ChatBubbleLogoProps {
  size?: "small" | "large";
}

const ChatBubbleLogo = ({ size = "large" }: ChatBubbleLogoProps) => {
  const logoSize = size === "small" ? "w-16 h-16" : "w-32 h-32";
  const dotSize = size === "small" ? "w-2 h-2" : "w-4 h-4";

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 1, type: "spring", bounce: 0.5 }}
      className={`${logoSize} bg-gradient-to-br from-purple-400 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden`}
    >
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      />
      
      {/* Chat dots */}
      <div className="flex space-x-2">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`${dotSize} bg-white rounded-full`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              delay: 0.5 + index * 0.1, 
              duration: 0.5,
              type: "spring",
              bounce: 0.6 
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default ChatBubbleLogo;
