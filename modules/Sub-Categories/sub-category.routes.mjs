import express from 'express';
import { addSubCategory, getAllSubcategories, getSingleSubCategory, UpdateSingleSubcategory } from './sub-category.controller.mjs';
const router = express.Router();

// GET /subcategories?subCategoryName=Iphone&categoryName=Samsung
router.get('/', getAllSubcategories);

// POST /api/subcategories
router.post('/', addSubCategory);

// GET /api/sub-categories/:id 
router.get('/:id', getSingleSubCategory);

// PUT /api/sub-categories/:id
router.put('/:id', UpdateSingleSubcategory);


