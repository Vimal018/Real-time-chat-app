import express from 'express';
import { getMessages, sendMessage, uploadImage } from '../controllers/messageController';
import { protect } from '../middlewares/authMiddleware';
import multer from 'multer';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post('/', protect, sendMessage);
router.get('/:chatId', protect, getMessages);
router.post('/image', protect, upload.single('file'), uploadImage);

export default router;