import { z } from "zod";

const PAKISTANI_PHONE_REGEX = /^(?:\+92|0)3\d{9}$/;
const roleEnum = z.enum(["rider", "driver"], {
  errorMap: () => ({ message: "Role must be rider or driver" }),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: roleEnum,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const updatePhoneSchema = z.object({
  phone: z
    .string()
    .regex(
      PAKISTANI_PHONE_REGEX,
      "Enter a valid Pakistani phone number (e.g. 03001234567)",
    ),
});

export const switchRoleSchema = z.object({ role: roleEnum });
