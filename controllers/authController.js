import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail } from "../lib/mailer.js";
import { issueAuthCookie } from "../lib/auth.js";

const issueCookie = (res, user) =>
  issueAuthCookie(res, { userId: user._id, role: user.activeRole });

export const updatePhone = async (req, res) => {
  try {
    const { phone } = req.body;

    const existing = await User.findOne({ phone });
    if (existing && existing._id.toString() !== req.user.userId) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { phone },
      { new: true },
    );
    res
      .status(200)
      .json({ user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- MANUAL SIGNUP ---
// (We still handle signup manually to hash the password before saving)
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body; // signupSchema requires role, no default needed

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = crypto.randomInt(100000, 999999).toString();

    await User.create({
      name,
      email,
      password: hashedPassword,
      roles: [role],
      activeRole: role,
      emailOtp: otp,
      emailOtpExpires: Date.now() + 10 * 60 * 1000,
    });

    await sendEmail({
      to: email,
      subject: "Verify your RideMVP account",
      html: `<p>Your verification code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    });

    res.status(201).json({
      message: "Account created. Check your email for a verification code.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- PASSPORT SUCCESS HANDLERS ---

export const loginSuccess = (req, res) => {
  issueCookie(res, req.user);
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      activeRole: req.user.activeRole,
    },
  });
};

export const googleCallback = (req, res) => {
  issueCookie(res, req.user);
  res.redirect(`${process.env.CLIENT_URL}/`);
};

// --- STANDARD PROTECTED ROUTES ---

export const logout = (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        activeRole: user.activeRole,
        roles: user.roles,
        phone: user.phone,
        vehicleModel: user.vehicleModel,
        vehicleNumber: user.vehicleNumber,
        vehicleColor: user.vehicleColor,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const switchRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.roles.includes(role)) {
      user.roles.push(role);
    }

    user.activeRole = role;
    await user.save();

    issueCookie(res, user);
    res.status(200).json({
      user: { id: user._id, name: user.name, activeRole: user.activeRole },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body; // shape/presence already guaranteed by verifyEmailSchema

    const user = await User.findOne({ email }).select(
      "+emailOtp +emailOtpExpires",
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }
    if (
      !user.emailOtp ||
      user.emailOtp !== otp ||
      user.emailOtpExpires < Date.now()
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified)
      return res.status(400).json({ error: "Email already verified" });

    const otp = crypto.randomInt(100000, 999999).toString();
    user.emailOtp = otp;
    user.emailOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail({
      to: email,
      subject: "Your new RideMVP verification code",
      html: `<p>Your new code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    });

    res.status(200).json({ message: "New code sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(200)
        .json({ message: "If that email exists, a reset link has been sent" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}&email=${email}`;
    await sendEmail({
      to: email,
      subject: "Reset your RideMVP password",
      html: `<p>Click to reset your password (expires in 15 minutes): <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    res
      .status(200)
      .json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body; // shape/presence already guaranteed by resetPasswordSchema

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ email }).select(
      "+passwordResetToken +passwordResetExpires",
    );

    if (
      !user ||
      user.passwordResetToken !== hashedToken ||
      user.passwordResetExpires < Date.now()
    ) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
