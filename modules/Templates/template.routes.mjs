import express from 'express';
import { addTemplate, deleteTemplate, getAllTemplates, getAllTemplateUrls, getTemplateById, updateStatus, updateTemplate } from './templates.controller.mjs';
import { templateUpload } from './template.helper.mjs';
const router = express.Router();


// GET /api/templates
router.get('/', getAllTemplates);

//GET /api/templates/urls
router.get("/urls", getAllTemplateUrls);

// GET /api/templates/:id
router.get('/:id', getTemplateById);

// POST /api/template
router.post('/', templateUpload, addTemplate);

// PUT /api/template/:id
router.put('/:id', updateTemplate);

//  PATCH /api/template/:id
router.patch('/:id', updateStatus);

// DELETE /api/template/:id
router.delete('/:id', deleteTemplate);



export default router;
