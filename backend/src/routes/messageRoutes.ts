import { Router, Request } from 'express';
import { getMessages, sendMessage, uploadImage, getOnlineUsers, deleteMessage, editMessage, markAsRead } from '../controllers/messageController';
import { protect, AuthenticatedRequest } from '../middlewares/authMiddleware';
import multer from 'multer';

const router = Router();

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, 'uploads/');
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.get('/online-users', protect, getOnlineUsers);
router.post('/', protect, sendMessage);
router.get('/:chatId', protect, getMessages);
router.post('/image', protect, upload.single('file'), uploadImage);
router.delete('/:id', protect, deleteMessage); // New
router.put('/:id', protect, editMessage); // New
router.post('/mark-read/:chatId', protect, markAsRead);
export default router;