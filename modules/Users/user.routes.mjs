import express from 'express';
import { getAllUsers, getUserById, updateUser, loginUser, sendOtp } from './user.controller.mjs';

const router = express.Router();

// GET /api/users
router.get('/', getAllUsers);

// GET /api/users/:id
router.get('/:id', getUserById);

// PUT /api/users
router.put('/:id', updateUser);

// POST /api/users/login
router.post('/login', loginUser);

//POST /api/users/send
router.post('/send', sendOtp);


export default router;
