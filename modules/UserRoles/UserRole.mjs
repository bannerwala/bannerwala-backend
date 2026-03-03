import moment from "moment";
import mongoose from "mongoose";

const userRoleSchema = new mongoose.Schema({
  name: String,
  created_at: { type: Number, default: moment.utc().valueOf() },
  updated_at: { type: Number, default: moment.utc().valueOf() }
});

export default mongoose.models.UserRole ||
  mongoose.model('UserRole', userRoleSchema);