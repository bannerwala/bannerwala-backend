import express from 'express';
import { addTemplate, deleteTemplate, getAllTemplates, updateStatus, updateTemplate } from './templates.controller.mjs';
const router = express.Router();


// GET /api/templates
router.get('/', getAllTemplates);

// POST /api/template
router.post('/', addTemplate);

// PUT /api/template/:id
router.put('/:id', updateTemplate);

//  PATCH /api/template/:id
router.patch('/:id',updateStatus);

// DELETE /api/template/:id
router.delete('/:id',deleteTemplate);


