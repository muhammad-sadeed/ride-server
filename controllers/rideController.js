import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { getRoute } from "../lib/osrm.js";
import { isValidTransition } from "../lib/rideStateMachine.js";

const PLATFORM_FEE = 50;
const FUEL_PRICE_PER_LITER = 280; // update manually as real prices change
const AVG_MILEAGE_KM_PER_LITER = 35; // averaged across vehicles
const FARE_FLOOR = 150;

export const createRide = async (req, res) => {
  try {
    const rider = await User.findById(req.user.userId);
    if (!rider) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!rider.phone) {
      return res
        .status(400)
        .json({ error: "Add a phone number before requesting a ride" });
    }

    // Shape/range validation now handled by createRideSchema + validate() middleware
    const { pickup, dropoff } = req.body;

    const { distanceKm, usedFallback } = await getRoute(
      pickup.coordinates,
      dropoff.coordinates,
    );

    const fuelCostPerKm = FUEL_PRICE_PER_LITER / AVG_MILEAGE_KM_PER_LITER;
    const rawFare = PLATFORM_FEE + distanceKm * fuelCostPerKm;
    const baseFare = Math.max(FARE_FLOOR, Math.round(rawFare));

    const ride = await Ride.create({
      riderId: req.user.userId,
      pickup: {
        type: "Point",
        coordinates: pickup.coordinates,
        address: pickup.address,
      },
      dropoff: {
        type: "Point",
        coordinates: dropoff.coordinates,
        address: dropoff.address,
      },
      distanceKm,
      baseFare,
      offeredFare: baseFare,
      status: "requested",
    });

    res.status(201).json({ ride, usedFallback }); // usedFallback flagged for debugging visibility, not shown to rider
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
async function transitionRide(
  req,
  res,
  { to, requiredCurrentField, actorField },
) {
  const { id } = req.params;
  const ride = await Ride.findById(id);

  if (!ride) return res.status(404).json({ error: "Ride not found" });
  if (ride[actorField]?.toString() !== req.user.userId) {
    return res.status(403).json({ error: "Not authorized for this ride" });
  }
  if (!isValidTransition(ride.status, to)) {
    return res
      .status(409)
      .json({ error: `Cannot move ride from ${ride.status} to ${to}` });
  }

  ride.status = to;
  await ride.save();
  res.status(200).json({ ride });
}

export const arriveRide = (req, res) =>
  transitionRide(req, res, { to: "arrived", actorField: "driverId" }).catch(
    (err) => res.status(500).json({ error: err.message }),
  );

export const startRide = (req, res) =>
  transitionRide(req, res, { to: "in_progress", actorField: "driverId" }).catch(
    (err) => res.status(500).json({ error: err.message }),
  );

export const completeRide = (req, res) =>
  transitionRide(req, res, { to: "completed", actorField: "driverId" }).catch(
    (err) => res.status(500).json({ error: err.message }),
  );

export const cancelRide = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id);

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const isRider = ride.riderId.toString() === req.user.userId;
    const isDriver = ride.driverId?.toString() === req.user.userId;
    if (!isRider && !isDriver) {
      return res.status(403).json({ error: "Not authorized for this ride" });
    }
    if (!isValidTransition(ride.status, "cancelled")) {
      return res
        .status(409)
        .json({ error: `Cannot cancel a ride that is ${ride.status}` });
    }

    ride.status = "cancelled";
    await ride.save();
    res.status(200).json({ ride });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRideById = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id)
      .populate("riderId", "name phone")
      .populate("driverId", "name vehicleModel vehicleNumber vehicleColor");

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const userId = req.user.userId;
    const isRider = ride.riderId?._id.toString() === userId;
    const isDriver = ride.driverId?._id.toString() === userId;

    if (!isRider && !isDriver) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const rideObj = ride.toObject();

    // Phone privacy: rider's phone is visible to the driver only
    // while the ride is active — stripped otherwise, server-side.
    const ACTIVE_STATUSES = ["accepted", "arrived", "in_progress"];
    if (!isDriver || !ACTIVE_STATUSES.includes(ride.status)) {
      if (rideObj.riderId) delete rideObj.riderId.phone;
    }

    res.status(200).json({ ride: rideObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
