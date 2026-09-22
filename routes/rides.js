import express from "express";
import { createRide } from "../controllers/rideController.js";
import { getNearbyRides, acceptRide } from "../controllers/driverController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../lib/validate.js";
import { createRideSchema } from "../schemas/rideschemas.js";
import {
  arriveRide,
  startRide,
  completeRide,
  cancelRide,
  getRideById,
} from "../controllers/rideController.js";
import { rideIdParamSchema } from "../schemas/rideschemas.js";
import { validateParams } from "../lib/validate.js";

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

router.patch(
  "/:id/arrive",
  requireAuth,
  requireRole("driver"),
  validateParams(rideIdParamSchema),
  arriveRide,
);
router.patch(
  "/:id/start",
  requireAuth,
  requireRole("driver"),
  validateParams(rideIdParamSchema),
  startRide,
);
router.patch(
  "/:id/complete",
  requireAuth,
  requireRole("driver"),
  validateParams(rideIdParamSchema),
  completeRide,
);
router.patch(
  "/:id/cancel",
  requireAuth,
  validateParams(rideIdParamSchema),
  cancelRide,
);
router.get("/nearby", requireAuth, requireRole("driver"), getNearbyRides);
router.get("/:id", requireAuth, validateParams(rideIdParamSchema), getRideById);

export default router;
