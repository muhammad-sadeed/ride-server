import { haversineKm } from "./haversine.js";

export async function getRoute(pickupCoords, dropoffCoords) {
  const [lon1, lat1] = pickupCoords;
  const [lon2, lat2] = dropoffCoords;
  const url = `https://router.project-osrm.org/route/v1/bike/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }); // 5s timeout
    const data = await res.json();

    if (data.code !== "Ok") throw new Error("OSRM returned no route");

    const route = data.routes[0];
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      polyline: route.geometry.coordinates, // array of [lon, lat] pairs
      usedFallback: false,
    };
  } catch (err) {
    // Fallback: OSRM down, rate-limited, or timed out — never let ride creation hard-fail
    const distanceKm = haversineKm(pickupCoords, dropoffCoords) * 1.3; // road factor
    return {
      distanceKm,
      durationMin: (distanceKm / 25) * 60, // 25 km/h assumed average
      polyline: [pickupCoords, dropoffCoords], // straight line, no real route
      usedFallback: true,
    };
  }
}
