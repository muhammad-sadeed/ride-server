import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.js";
import passport from "./lib/passport.js";
import rideRoutes from "./routes/rides.js";

const app = express();

// CORS configuration to allow the Vite React app to send/receive cookies
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Middleware to parse JSON bodies and cookies
app.use(express.json());
app.use(cookieParser());

app.use(passport.initialize());

app.use("/api/auth", authRoutes);

app.use("/api/rides", rideRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1); // the exit now lives in server.js, not buried inside the db helper
});
