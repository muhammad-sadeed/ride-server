import { z } from "zod";

const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const pointSchema = z.object({
  coordinates: coordinatesSchema,
  address: z.string().optional(),
});

export const createRideSchema = z.object({
  pickup: pointSchema,
  dropoff: pointSchema,
});

export const updateDriverStatusSchema = z.object({
  isOnline: z.boolean(),
  coordinates: coordinatesSchema.optional(),
});

export const rideIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ride ID"),
});

export const vehicleInfoSchema = z.object({
  vehicleModel: z.string().trim().min(1, "Vehicle model is required"),
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
  vehicleColor: z.string().trim().min(1, "Vehicle color is required"),
});
