import express from 'express';
import {
  getDatasheet,
  createStudent,
  updateStudent,
  deleteStudent,
  resetPassword,
  downloadCsv,
  downloadJson
} from '../controllers/studentController.js';

import { verifyToken, requireRole } from '../middleware/authMiddleware.js';

import { updateProfile } from '../controllers/authController.js';

const router = express.Router();

router.use(verifyToken);

router.put('/me/profile', updateProfile);
router.get('/datasheet', requireRole('admin', 'superadmin', 'trainer', 'teacher'), getDatasheet);
router.post('/', requireRole('admin', 'superadmin'), createStudent);
router.put('/:id', requireRole('admin', 'superadmin'), updateStudent);
router.delete('/:id', requireRole('admin', 'superadmin'), deleteStudent);
router.post('/:id/reset-password', requireRole('admin', 'superadmin', 'trainer'), resetPassword);
router.get('/export/csv', requireRole('admin', 'superadmin'), downloadCsv);
router.get('/export/json', requireRole('admin', 'superadmin'), downloadJson);

export default router;
