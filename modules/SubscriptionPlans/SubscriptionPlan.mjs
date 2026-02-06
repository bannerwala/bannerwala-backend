import moment from "moment";
import mongoose from "mongoose";


const subscriptionPlanSchema = new mongoose.Schema({
  name: String,
  price: String,
  duration: String,
  description: String,
  status: String,
  created_at: { type: Number, default: moment.utc().valueOf() },
  updated_at: { type: Number, default: moment.utc().valueOf() }
});


export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
