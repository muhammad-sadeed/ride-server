# RideMVP — Server

A ride-hailing backend (MERN stack) supporting rider/driver matching, real-time-ish location tracking via polling, and a negotiable-fare model closer to InDrive than Uber's fixed algorithmic pricing.

**Frontend repo:** `ride-client` _(link once created)_

## Features

- Email + password auth, plus Google OAuth (Passport.js)
- Email verification via OTP, forgot/reset password
- Role switching — one account can act as rider or driver, no separate signup flows
- Sliding-session JWT (httpOnly cookie, extended on every authenticated request)
- Ride creation with a cost-based fare formula (fuel price ÷ mileage × distance), using real route distance via OSRM with an automatic fallback if the routing service is unavailable
- Geospatial "nearby drivers" matching (MongoDB `2dsphere` index)
- Atomic ride-acceptance — race-condition-safe, so two drivers can never both accept the same ride
- Request validation via Zod on every endpoint that accepts a body

## Tech stack

Node.js · Express · MongoDB + Mongoose · Passport.js (local + Google OAuth) · JWT · bcrypt · Zod · Nodemailer

## Setup

```bash
git clone <this repo>
cd ride-server
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

### Environment variables

See `.env.example` for the full list. You'll need:

- A MongoDB Atlas connection string
- A Google Cloud OAuth 2.0 client (for Google sign-in)
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) generated (for sending OTP/reset emails)

## Notable technical decisions

- **Fare calculation is deliberately cost-based, not an arbitrary rate**: `platform fee + distance × (fuel price ÷ average mileage)`, with fuel price and mileage averaged across vehicles (InDrive-style) rather than tracked per driver.
- **OSRM (bike profile) computes real route distance**, since straight-line distance meaningfully underestimates real trips. If OSRM is unreachable or times out, the app falls back to a haversine-based estimate rather than failing ride creation outright — an external routing dependency should degrade gracefully, not take down the core feature.
- **Ride status is a strict state machine** (`requested → accepted → arrived → in_progress → completed`, with `cancelled` only reachable from the first two states), enforced server-side so no status transition can be skipped or forced out of order.
- **Ride acceptance uses a single atomic `findOneAndUpdate`** with the current status included in the _query_, not just the update — this is what actually prevents two drivers from accepting the same ride, without needing manual locking.
- **No driver verification gate.** Any account can switch to driving instantly. This mirrors real platforms' _lack_ of this exact simplification deliberately — Uber and similar apps require document verification before driving, which is out of scope for this MVP and explicitly deferred, not overlooked.

## Known limitations (documented, not accidental)

- JWTs are not server-side revocable — logout clears the client's cookie but a copied raw token remains valid until natural expiry (no blacklist implemented).
- OSRM's public routing server is rate-limited and not intended for production use; acceptable for this MVP, would need a self-hosted instance or paid provider before real deployment.
- No payment processing — cash only, unrecorded.
- No ratings, messaging, or admin panel — deferred to keep MVP scope achievable.
