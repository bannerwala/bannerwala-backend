import express from 'express';
import {  addSubscriptionPlan, deleteSubscriptionPlan, getAllSubscriptionPlans, getSingleSubscriptionPlan, updateSubscriptionPlan } from './subscription-plans.controller.mjs';
const router = express.Router();


// GET /subscriptionPlans?name=free
router.get('/', getAllSubscriptionPlans);

// POST /api/subscriptionPlans 
router.post('/', addSubscriptionPlan);

// GET /api/subscriptionPlans/:id
router.get('/:id', getSingleSubscriptionPlan);

// PUT /api/subscriptionPlans/:id
router.put('/:id', updateSubscriptionPlan);

// DELETE /api/subscriptionPlans/:id
router.delete('/:id', deleteSubscriptionPlan);
export default router;
