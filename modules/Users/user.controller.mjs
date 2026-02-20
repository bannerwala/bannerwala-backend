import User from './User.mjs';
import moment from "moment";
import jwt from "jsonwebtoken";
import streamifier from 'streamifier';

import twilio from 'twilio';
import otpGenerator from 'otp-generator';
import dotenv from 'dotenv';

import UserRole from "../UserRoles/UserRole.mjs";
import TemplatesActivity from '../Templates/TemplatesActivity/TemplatesActivity.mjs';
import { uploadPngStream } from '../Templates/template.helper.mjs';

dotenv.config();

// Login

export const loginUser = async (req, res) => {
  try {
    const { contact_number, otp } = req.body;

    const user = await User.findOne({ contact_number })
      .populate({ path: 'role' });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // OTP mismatch
    if (otp !== user.otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Expiry check using moment
    if (!user.otp_expires_at || moment().valueOf() > user.otp_expires_at) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    // Clear OTP after successful login
    user.otp = null;
    user.otp_expires_at = null;

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role?._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Send OTP

export const sendOtp = async (req, res) => {
  try {
    // console.log('req.body: ', req.body);
    const { contact_number } = req.body;

    if (!contact_number) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false
    });

    const otpExpiry = moment().add(5, 'minutes').valueOf(); // 5 min
    console.log('otpExpiry: ', otpExpiry);

    let user = await User.findOne({ contact_number })
      .populate({ path: 'role' });

    console.log('user: ', user);

    if (!user) {
      // 🆕 Create new user
      user = await User.create({
        contact_number,
        otp,
        otp_expires_at: otpExpiry,
        is_new_user: user ? false : true
      });
    } else {
      // ♻️ Existing user → update OTP
      user.otp = otp;
      user.otp_expires_at = otpExpiry;
      await user.save();
    }

    // // Send OTP
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // await client.messages.create({
    //   to: `+91${contact_number}`,
    //   from: '+16419343401',
    //   body: `OTP for 3_Extent is ${otp}`
    // });

    res.json({
      otp: otp,
      message: 'OTP sent successfully',
    });

  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};


export const getAllUsers = async (req, res) => {
  try {
    const { role, plan } = req.query;
    let filter = {};

    // 🔎 Filter by plan
    if (plan) {
      const existingPlans = await SubscriptionPlan.find({
        name: { $regex: plan, $options: "i" }
      });

      if (existingPlans.length > 0) {
        filter["subscription_details.plan"] = {
          $in: existingPlans.map(p => p._id)
        };
      }
    }

    // 🔎 Filter by role
    if (role) {
      const existingRole = await UserRole.findOne({ name: role });
      if (!existingRole) {
        return res.status(400).json({ message: "User role not found" });
      }
      filter.role = existingRole._id;
    }

    // 1️⃣ Get users
    const users = await User.find(filter)
      .populate("role")
      .lean(); // important

    // 2️⃣ Attach activities for each user
    for (let user of users) {
      const activities = await TemplatesActivity.find({
        user: user._id
      })
        .populate("template", "name thumbnail")
        .sort({ created_at: -1 });

      user.template_activities = activities;
    }

    res.json(users);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Get a single user
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('role')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const activities = await TemplatesActivity.find({
      user: user._id
    })
      .populate("template")
      .sort({ created_at: -1 })
      .lean();

    user.template_activities = activities;

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//  Update a single user
export const updateUser = async (req, res) => {
  // console.log('req: ', req);
  const ALLOWED_UPDATES = [
    'name',
    'email_id',
    'firm_name',
    'designation',
    'address',
    'language',
    'gender',
    'DOB',
    'subscription_details',
    'user_template_details'
  ];

  const id = req.params.id;

  try {
    const user = await User.findById(id);
    // console.log('user: ', user);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ✅ Update text fields from form-data
    for (const key of ALLOWED_UPDATES) {
      // console.log('req.body[key]: ', req.body[key]);
      if (req.body[key] !== undefined) {
        user[key] = req.body[key];
      }
    }

    console.log('req.files: ', req.files);
    // ✅ Handle profile_pic upload
    if (req.files?.profile_pic?.[0]) {
      const file = req.files.profile_pic[0];

      // Example: save base64 OR upload to cloudinary here
      // user.profile_pic = file.buffer.toString('base64');
      if (req.files?.profile_pic?.[0]) {
        const file = req.files.profile_pic[0];
        const stream = streamifier.createReadStream(file.buffer);
        const result = await uploadPngStream(
          stream,
          'users/profile_pic'
        );
        console.log('result: ', result);

        user.profile_pic = result;
      }
    }

    // ✅ Handle background_removed_pic upload
    if (req.files?.background_removed_pic?.[0]) {
      const file = req.files.background_removed_pic[0];
      // user.background_removed_pic = file.buffer.toString('base64');
      if (req.files?.background_removed_pic?.[0]) {
        const file = req.files.background_removed_pic[0];
        const stream = streamifier.createReadStream(file.buffer);
        const result = await uploadPngStream(
          stream,
          'users/background_removed'
        );
        console.log('result: ', result);

        user.background_removed_pic = result;
      }
    }

    // If new user → mark false
    if (user.is_new_user === true) {
      user.is_new_user = false;
    }

    await user.save();
    await user.populate({ path: 'role' });

    return res.json(user);

  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ error: err.message });
  }
};
