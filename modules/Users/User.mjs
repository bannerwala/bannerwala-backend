import moment from "moment";
import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: String,
    contact_number: String,
    email_id: String,
    password: String,
    is_new_user: Boolean,
    profile_pic: String,
    background_removed_pic: String,
    firm_name: String,
    designation: String,
    address: String,

    // 🔐 OTP fields
    otp: String,
    otp_expires_at: Number,

    role: { type: mongoose.Schema.Types.ObjectId, ref: 'UserRole' },
    language: String,
    gender: String,
    DOB: { type: Number, default: moment.utc().valueOf() },
    subscription_details: [{
        plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
        used_templates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Template' }],
        start_date: { type: Number, default: moment.utc().valueOf() },
        end_date: { type: Number, default: moment.utc().valueOf() }
    }],
    user_template_details: {
        background_color: String,
        shape: String,
        date_position: String,
        pic_position: String
    },
    created_at: { type: Number, default: moment.utc().valueOf() },
    updated_at: { type: Number, default: moment.utc().valueOf() }
});

export default mongoose.model('User', userSchema);
