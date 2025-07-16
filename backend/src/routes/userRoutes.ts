import express from 'express';
import {
  registerUser,
  loginUser,
  updateUserProfile
} from '../controllers/userController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/profile', protect, updateUserProfile); // Only for logged-in users

export default router;
