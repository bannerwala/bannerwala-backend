import moment from "moment";
import mongoose from "mongoose";


const templateSchema = new mongoose.Schema({
  url: String,
  plans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  sub_categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' }],
  status: String,
  font_family: String,
  font_size: String,
  font_color: String,
  font_style: String,
  font_weight: String,
  has_multiple_images: Boolean,
  created_at: { type: Number, default: moment.utc().valueOf() },
  updated_at: { type: Number, default: moment.utc().valueOf() }
});

export default mongoose.model('Template', templateSchema);
