import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Routes
import userRoutes from '../modules/Users/user.routes.mjs';
import templateRoutes from '../modules/Templates/template.routes.mjs';
import categoryRoutes from '../modules/Categories/category.routes.mjs';
import subCategoryRoutes from '../modules/Sub-Categories/sub-category.routes.mjs';
import subscriptionPlanRoutes from '../modules/SubscriptionPlans/subscription-plans.routes.mjs';

const app = express();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);

// MongoDB connection (serverless-safe)
let isConnected = false;

async function connectToDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(
      'mongodb+srv://codadhyay_image_edit:pfXB9Sa0o5awywl4@image-edit.vy1zqit.mongodb.net/image-edit',
      {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000
      }
    );

    isConnected = true;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Start Server
(async () => {
  try {
    await connectToDB();
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    process.exit(1);
  }
})();

export default app;

