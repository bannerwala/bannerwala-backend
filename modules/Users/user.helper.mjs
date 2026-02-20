import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadUserImages = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 10MB limit
}).fields([
  { name: 'profile_pic', maxCount: 1 },
  { name: 'background_removed_pic', maxCount: 1 }
]);