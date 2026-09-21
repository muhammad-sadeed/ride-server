import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pickup: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
      address: String,
    },
    dropoff: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
      address: String,
    },
    distanceKm: { type: Number, required: true },
    baseFare: { type: Number, required: true },
    offeredFare: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "requested",
        "accepted",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "requested",
    },
  },
  { timestamps: true },
);

// Crucial for the driver's "nearby" query
rideSchema.index({ pickup: "2dsphere" });

export default mongoose.model("Ride", rideSchema);
