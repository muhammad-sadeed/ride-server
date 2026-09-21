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
