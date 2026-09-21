import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false }, // Not required (Google users lack this)
    googleId: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    roles: [{ type: String, enum: ["rider", "driver"] }],
    activeRole: { type: String, enum: ["rider", "driver"], required: true },
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number] },
    },
    isOnline: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, select: false },
    emailOtpExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ location: "2dsphere" });

export default mongoose.model("User", userSchema);
