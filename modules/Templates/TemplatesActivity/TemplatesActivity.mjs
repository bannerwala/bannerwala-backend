import mongoose from "mongoose";
import moment from "moment";

const templateActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Template",
    required: true
  },
  action: {
    type: String,
    enum: ["download", "share"],
    required: true
  },
  created_at: {
    type: Number,
    default: () => moment.utc().valueOf()
  }
});

export default mongoose.model("TemplateActivity", templateActivitySchema);
