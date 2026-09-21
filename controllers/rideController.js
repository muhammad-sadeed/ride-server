import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { getRoute } from "../lib/osrm.js";

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
