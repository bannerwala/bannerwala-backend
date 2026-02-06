import express from 'express';
import { addCategory, getAllCategories, getSingleCategory, updateSingleCategory } from './category.controller.mjs';
const router = express.Router();

// GET /api/categories?name="Samsung"
router.get('/', getAllCategories);

// POST /api/category
router.post('/', addCategory);

// GET /api/category/:id 
router.get('/:id', getSingleCategory);

// PUT /api/category/:id
router.put('/:id', updateSingleCategory);
