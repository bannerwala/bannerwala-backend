import moment from "moment";
import mongoose from "mongoose";

const CanvasSchema = new mongoose.Schema(
  {
    width: Number,
    height: Number
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema({

  /* ===== PSD Layout ===== */
  layout: {
    canvas: CanvasSchema,
    layers: [mongoose.Schema.Types.Mixed]
  },
  

  // /* ===== Thumbnail ===== */
  // thumbnail: {
  //   type: String,
  //   required: true
  // },

  url: String,

  plans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  sub_categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' }],

  status: {
    type: String,
    default: 'active'
  },

  font_family: String,
  font_size: Number,
  font_color: String,
  font_style: String,
  font_weight: String,

  has_multiple_images: {
    type: Boolean,
    default: false
  },

  created_at: {
    type: Number,
    default: () => moment.utc().valueOf()
  },

  updated_at: {
    type: Number,
    default: () => moment.utc().valueOf()
  }

});

/* ===== Indexes ===== */
templateSchema.index({ plans: 1 });
templateSchema.index({ categories: 1 });
templateSchema.index({ sub_categories: 1 });

export default mongoose.model('Template', templateSchema);
