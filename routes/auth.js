import express from "express";
import passport from "../lib/passport.js";
import {
  signup,
  loginSuccess,
  googleCallback,
  logout,
  getMe,
  switchRole,
  updatePhone,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  updateDriverStatus,
  updateVehicleInfo,
} from "../controllers/driverController.js";
import { validate } from "../lib/validate.js";
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePhoneSchema,
  switchRoleSchema,
} from "../schemas/authschemas.js";
import {
  updateDriverStatusSchema,
  vehicleInfoSchema,
} from "../schemas/rideschemas.js";

const router = express.Router();

// --- PUBLIC ROUTES ---
router.post("/signup", validate(signupSchema), signup);

router.post(
  "/login",
  validate(loginSchema),
  passport.authenticate("local", { session: false }),
  loginSuccess,
);

// --- GOOGLE OAUTH ROUTES ---
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login`,
  }),
  googleCallback,
);

// --- PROTECTED ROUTES ---
router.post("/logout", logout);
router.get("/me", requireAuth, getMe);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/resend-otp", validate(resendOtpSchema), resendOtp);
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
router.patch("/phone", requireAuth, validate(updatePhoneSchema), updatePhone);
router.post(
  "/switch-role",
  requireAuth,
  validate(switchRoleSchema),
  switchRole,
);
router.patch(
  "/online",
  requireAuth,
  requireRole("driver"),
  validate(updateDriverStatusSchema),
  updateDriverStatus,
);
router.patch(
  "/vehicle",
  requireAuth,
  requireRole("driver"),
  validate(vehicleInfoSchema),
  updateVehicleInfo,
);

export default router;
