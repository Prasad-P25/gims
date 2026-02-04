import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { asyncHandler } from '../middlewares/error.middleware';

const router = Router();

// Get current user profile
router.get('/', asyncHandler(profileController.getProfile.bind(profileController)));

// Update profile (name, phone, email)
router.put('/', asyncHandler(profileController.updateProfile.bind(profileController)));

// Change password
router.put('/password', asyncHandler(profileController.changePassword.bind(profileController)));

// Generate Telegram link instructions
router.post('/telegram/link', asyncHandler(profileController.generateTelegramLinkCode.bind(profileController)));

// Unlink Telegram account
router.delete('/telegram', asyncHandler(profileController.unlinkTelegram.bind(profileController)));

export default router;
