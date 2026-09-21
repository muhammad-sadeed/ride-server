import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: `"RideMVP" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
