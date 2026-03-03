import express from 'express';
import { templateAction } from './template-activity.controller.mjs';
const router = express.Router();

// POST /api/template-activity
router.post('/', templateAction);


export default router;
