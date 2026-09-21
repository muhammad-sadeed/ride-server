import express from "express";
import { createRide } from "../controllers/rideController.js";
import { getNearbyRides, acceptRide } from "../controllers/driverController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../lib/validate.js";
import { createRideSchema } from "../schemas/rideschemas.js";

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireRole("rider"),
  validate(createRideSchema),
  createRide,
);
router.get("/nearby", requireAuth, requireRole("driver"), getNearbyRides);
router.patch("/:id/accept", requireAuth, requireRole("driver"), acceptRide);

export default router;
