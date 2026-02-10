import User from './User.mjs';
import moment from "moment";
import jwt from "jsonwebtoken";

import twilio from 'twilio';
import otpGenerator from 'otp-generator';
import dotenv from 'dotenv';

dotenv.config();

// Login

export const loginUser = async (req, res) => {
  try {
    const { contact_number, otp, is_new, name } = req.body;

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

    if (is_new) {
      user.name = name;
    }

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
    let is_new = false;

    if (!user) {
      // 🆕 Create new user
      user = await User.create({
        contact_number,
        otp,
        otp_expires_at: otpExpiry
      });
      is_new = true;
    } else {
      // ♻️ Existing user → update OTP
      user.otp = otp;
      user.otp_expires_at = otpExpiry;
      await user.save();
    }

    // Send OTP
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      to: `+91${contact_number}`,
      from: '+16419343401',
      body: `OTP for 3_Extent is ${otp}`
    });

    res.json({
      message: 'OTP sent successfully',
      is_new
    });

  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};


// All User
export const getAllUsers = async (req, res) => {
  try {
    const { role, plan } = req.query;

    let filter = {};

    if (plan) {
      const existing_plan = await SubscriptionPlan.find({ name: { $regex: plan, $options: 'i' } });
      filter.plans = existing_plan._id;
    }

    if (role) filter.role = role;

    const users = await User.find(filter)
      .populate({ path: 'role' })

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get a single user
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate({ path: 'role' });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

//  Update a single user
export const updateUser = async (req, res) => {
  const ALLOWED_UPDATES = [
    'name',
    'email_id',
    'profile_pic',
    'background_removed_pic',
    'firm_name',
    'desi,gnation',
    'address',
    'language',
    'gender',
    'DOB',
    'subscription_details',
    'user_template_details'
  ];
  const updates = req.body;
  const id = req.params.id;

  // Sanitize / filter only allowed fields
  const updateData = {};
  for (const key of ALLOWED_UPDATES) {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    // Nothing to update
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate({ path: 'role' });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ error: err.message });
  }
}