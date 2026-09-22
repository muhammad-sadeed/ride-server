/**
 * test-api.js
 *
 * Standalone smoke-test suite for ride-server.
 * No test framework — plain Node + built-in fetch, run directly against a
 * live server instance. Requires Node 18+.
 *
 * Usage:
 *   1. Start the server:  node server.js   (or npm run dev)
 *   2. In another terminal: node test-api.js
 *
 * Optional: set API_URL to point at a different host, e.g.
 *   API_URL=http://localhost:5000/api node test-api.js
 *
 * Each run uses fresh, timestamp-derived emails/phone numbers so it can be
 * run repeatedly against the same database without unique-index collisions.
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000/api";

// ---------------------------------------------------------------------------
// Unique test data helpers
// ---------------------------------------------------------------------------

const RUN_ID = Date.now();
let seq = 0;
const nextSeq = () => seq++;

const email = (prefix) => `${prefix}_${RUN_ID}_${nextSeq()}@test.dev`;

let phoneSeq = 100000000; // 9-digit base, incremented per call
function nextPhone() {
  phoneSeq++;
  return "03" + String(phoneSeq).slice(-9); // matches /^(?:\+92|0)3\d{9}$/
}

// Two points a few km apart in Lahore, used for pickup/dropoff and driver location
const PICKUP = [74.3587, 31.5204];
const DROPOFF = [74.404, 31.47];

// ---------------------------------------------------------------------------
// Tiny fetch wrapper + cookie handling (manual — no cookie jar library)
// ---------------------------------------------------------------------------

async function api(method, path, { body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON or empty body — leave json as null
  }

  const setCookie = res.headers.get("set-cookie");
  const newCookie = setCookie ? setCookie.split(";")[0] : null;

  return { status: res.status, json, cookie: newCookie };
}

// ---------------------------------------------------------------------------
// Minimal test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.log(`  \x1b[31m✗ ${name}\x1b[0m`);
    console.log(`    ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertStatus(res, expected, label) {
  assert(
    res.status === expected,
    `expected ${expected}, got ${res.status} for ${label} — ${JSON.stringify(res.json)}`,
  );
}

async function checkServerUp() {
  try {
    await fetch(`${BASE_URL}/auth/me`);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared state across tests
// ---------------------------------------------------------------------------

const state = {
  rider1: {
    email: email("rider1"),
    password: "password123",
    phone: nextPhone(),
  },
  rider3NoPhone: { email: email("rider3"), password: "password123" },
  driver1: { email: email("driver1"), password: "password123" },
  driver2: { email: email("driver2"), password: "password123" },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Running against ${BASE_URL}\n`);

  if (!(await checkServerUp())) {
    console.error(
      `\n❌ Could not reach ${BASE_URL} — is the server running? (node server.js)\n`,
    );
    process.exit(1);
  }

  // ===================== AUTH: SIGNUP + LOGIN =====================
  section("AUTH — signup & login");

  await test("signup rider1", async () => {
    const res = await api("POST", "/auth/signup", {
      body: {
        name: "Test Rider",
        email: state.rider1.email,
        password: state.rider1.password,
        role: "rider",
      },
    });
    assertStatus(res, 201, "signup rider1");
  });

  await test("signup rejects duplicate email", async () => {
    const res = await api("POST", "/auth/signup", {
      body: {
        name: "Test Rider",
        email: state.rider1.email,
        password: state.rider1.password,
        role: "rider",
      },
    });
    assertStatus(res, 400, "duplicate signup");
  });

  await test("signup rider3 (no phone, used later)", async () => {
    const res = await api("POST", "/auth/signup", {
      body: {
        name: "No Phone Rider",
        email: state.rider3NoPhone.email,
        password: state.rider3NoPhone.password,
        role: "rider",
      },
    });
    assertStatus(res, 201, "signup rider3");
  });

  await test("signup driver1", async () => {
    const res = await api("POST", "/auth/signup", {
      body: {
        name: "Test Driver",
        email: state.driver1.email,
        password: state.driver1.password,
        role: "driver",
      },
    });
    assertStatus(res, 201, "signup driver1");
  });

  await test("signup driver2", async () => {
    const res = await api("POST", "/auth/signup", {
      body: {
        name: "Second Driver",
        email: state.driver2.email,
        password: state.driver2.password,
        role: "driver",
      },
    });
    assertStatus(res, 201, "signup driver2");
  });

  await test("login rejects wrong password", async () => {
    const res = await api("POST", "/auth/login", {
      body: { email: state.rider1.email, password: "wrongpassword" },
    });
    // Note: passport.authenticate("local", { session: false }) has no custom
    // failure callback in routes/auth.js, so on failure it sends a bare 401
    // with no JSON body — only the status code is safe to assert on here.
    assertStatus(res, 401, "wrong password login");
  });

  await test("login rider1", async () => {
    const res = await api("POST", "/auth/login", {
      body: { email: state.rider1.email, password: state.rider1.password },
    });
    assertStatus(res, 200, "login rider1");
    assert(res.cookie, "expected a session cookie to be set");
    state.rider1.cookie = res.cookie;
  });

  await test("login rider3", async () => {
    const res = await api("POST", "/auth/login", {
      body: {
        email: state.rider3NoPhone.email,
        password: state.rider3NoPhone.password,
      },
    });
    assertStatus(res, 200, "login rider3");
    state.rider3NoPhone.cookie = res.cookie;
  });

  await test("login driver1", async () => {
    const res = await api("POST", "/auth/login", {
      body: { email: state.driver1.email, password: state.driver1.password },
    });
    assertStatus(res, 200, "login driver1");
    state.driver1.cookie = res.cookie;
  });

  await test("login driver2", async () => {
    const res = await api("POST", "/auth/login", {
      body: { email: state.driver2.email, password: state.driver2.password },
    });
    assertStatus(res, 200, "login driver2");
    state.driver2.cookie = res.cookie;
  });

  await test("GET /auth/me requires auth", async () => {
    const res = await api("GET", "/auth/me");
    assertStatus(res, 401, "unauthenticated /me");
  });

  await test("GET /auth/me returns rider1's profile shape", async () => {
    const res = await api("GET", "/auth/me", { cookie: state.rider1.cookie });
    assertStatus(res, 200, "GET /auth/me rider1");
    assert(res.json.user.activeRole === "rider", "expected activeRole 'rider'");
    assert(
      Array.isArray(res.json.user.roles),
      "expected roles array on /me response",
    );
  });

  // ===================== AUTH: PHONE =====================
  section("AUTH — phone");

  await test("PATCH /auth/phone rejects bad format", async () => {
    const res = await api("PATCH", "/auth/phone", {
      cookie: state.rider1.cookie,
      body: { phone: "12345" },
    });
    assertStatus(res, 400, "bad phone format");
  });

  await test("PATCH /auth/phone sets rider1's phone", async () => {
    const res = await api("PATCH", "/auth/phone", {
      cookie: state.rider1.cookie,
      body: { phone: state.rider1.phone },
    });
    assertStatus(res, 200, "set rider1 phone");
    assert(
      res.json.user.phone === state.rider1.phone,
      "phone not reflected in response",
    );
  });

  await test("PATCH /auth/phone rejects a phone already in use", async () => {
    const res = await api("PATCH", "/auth/phone", {
      cookie: state.driver1.cookie,
      body: { phone: state.rider1.phone },
    });
    assertStatus(res, 400, "duplicate phone");
  });

  // ===================== VEHICLE INFO =====================
  section("VEHICLE INFO");

  await test("PATCH /auth/vehicle rejected for a rider (role-gated)", async () => {
    const res = await api("PATCH", "/auth/vehicle", {
      cookie: state.rider1.cookie,
      body: {
        vehicleModel: "Honda CD70",
        vehicleNumber: "LEA-1234",
        vehicleColor: "Red",
      },
    });
    assertStatus(res, 403, "rider hitting driver-only vehicle route");
  });

  await test("PATCH /auth/online blocked before vehicle info is set", async () => {
    const res = await api("PATCH", "/auth/online", {
      cookie: state.driver1.cookie,
      body: { isOnline: true, coordinates: PICKUP },
    });
    assertStatus(res, 400, "go online with no vehicle info");
  });

  await test("PATCH /auth/vehicle rejects missing fields", async () => {
    const res = await api("PATCH", "/auth/vehicle", {
      cookie: state.driver1.cookie,
      body: { vehicleModel: "Honda CD70" }, // missing number/color
    });
    assertStatus(res, 400, "incomplete vehicle info");
  });

  await test("PATCH /auth/vehicle sets driver1's vehicle info", async () => {
    const res = await api("PATCH", "/auth/vehicle", {
      cookie: state.driver1.cookie,
      body: {
        vehicleModel: "Honda CD70",
        vehicleNumber: "LEA-1234",
        vehicleColor: "Red",
      },
    });
    assertStatus(res, 200, "set driver1 vehicle info");
    assert(
      res.json.vehicleNumber === "LEA-1234",
      "vehicleNumber not reflected in response",
    );
    state.driver1.vehicle = res.json;
  });

  await test("GET /auth/me reflects driver1's vehicle info", async () => {
    const res = await api("GET", "/auth/me", { cookie: state.driver1.cookie });
    assertStatus(res, 200, "GET /auth/me driver1");
    assert(
      res.json.user.vehicleModel === "Honda CD70",
      "vehicleModel missing from /me",
    );
    assert(
      res.json.user.vehicleColor === "Red",
      "vehicleColor missing from /me",
    );
  });

  await test("PATCH /auth/online succeeds once vehicle info is set", async () => {
    const res = await api("PATCH", "/auth/online", {
      cookie: state.driver1.cookie,
      body: { isOnline: true, coordinates: PICKUP },
    });
    assertStatus(res, 200, "go online driver1");
    assert(res.json.isOnline === true, "expected isOnline true");
  });

  await test("driver2 still blocked from going online (no vehicle info yet)", async () => {
    const res = await api("PATCH", "/auth/online", {
      cookie: state.driver2.cookie,
      body: { isOnline: true, coordinates: PICKUP },
    });
    assertStatus(res, 400, "driver2 go online without vehicle info");
  });

  await test("set driver2's vehicle info and bring them online", async () => {
    const vehicleRes = await api("PATCH", "/auth/vehicle", {
      cookie: state.driver2.cookie,
      body: {
        vehicleModel: "Yamaha YBR125",
        vehicleNumber: "LEB-5678",
        vehicleColor: "Black",
      },
    });
    assertStatus(vehicleRes, 200, "set driver2 vehicle info");

    const onlineRes = await api("PATCH", "/auth/online", {
      cookie: state.driver2.cookie,
      body: { isOnline: true, coordinates: PICKUP },
    });
    assertStatus(onlineRes, 200, "go online driver2");
  });

  // ===================== ROLE SWITCHING =====================
  section("ROLE SWITCHING");

  await test("switch-role: rider1 becomes a driver, then switches back", async () => {
    const toDriver = await api("POST", "/auth/switch-role", {
      cookie: state.rider1.cookie,
      body: { role: "driver" },
    });
    assertStatus(toDriver, 200, "switch rider1 to driver");
    assert(
      toDriver.json.user.activeRole === "driver",
      "activeRole did not change to driver",
    );
    assert(toDriver.cookie, "expected a reissued cookie after role switch");

    const backToRider = await api("POST", "/auth/switch-role", {
      cookie: toDriver.cookie,
      body: { role: "rider" },
    });
    assertStatus(backToRider, 200, "switch rider1 back to rider");
    assert(
      backToRider.json.user.activeRole === "rider",
      "activeRole did not switch back",
    );

    // Keep using the freshest cookie going forward — role is baked into the JWT.
    state.rider1.cookie = backToRider.cookie;
  });

  // ===================== RIDES: CREATE =====================
  section("RIDES — create & validation");

  await test("POST /api/rides requires auth", async () => {
    const res = await api("POST", "/rides", {
      body: {
        pickup: { coordinates: PICKUP },
        dropoff: { coordinates: DROPOFF },
      },
    });
    assertStatus(res, 401, "unauthenticated ride creation");
  });

  await test("POST /api/rides rejects a rider with no phone on file", async () => {
    const res = await api("POST", "/rides", {
      cookie: state.rider3NoPhone.cookie,
      body: {
        pickup: { coordinates: PICKUP },
        dropoff: { coordinates: DROPOFF },
      },
    });
    assertStatus(res, 400, "ride creation without phone");
  });

  await test("POST /api/rides rejects out-of-range coordinates", async () => {
    const res = await api("POST", "/rides", {
      cookie: state.rider1.cookie,
      body: {
        pickup: { coordinates: [999, 999] },
        dropoff: { coordinates: DROPOFF },
      },
    });
    assertStatus(res, 400, "invalid coordinates");
  });

  await test("POST /api/rides rejected for a driver (role-gated)", async () => {
    const res = await api("POST", "/rides", {
      cookie: state.driver1.cookie,
      body: {
        pickup: { coordinates: PICKUP },
        dropoff: { coordinates: DROPOFF },
      },
    });
    assertStatus(res, 403, "driver creating a ride");
  });

  await test("POST /api/rides creates ride1 for rider1", async () => {
    const res = await api("POST", "/rides", {
      cookie: state.rider1.cookie,
      body: {
        pickup: { coordinates: PICKUP, address: "Test Pickup" },
        dropoff: { coordinates: DROPOFF, address: "Test Dropoff" },
      },
    });
    assertStatus(res, 201, "create ride1");
    assert(
      res.json.ride.status === "requested",
      "new ride should start as requested",
    );
    assert(
      typeof res.json.ride.baseFare === "number",
      "expected a numeric baseFare",
    );
    state.ride1Id = res.json.ride._id;
  });

  // ===================== RIDES: NEARBY =====================
  section("RIDES — nearby");

  await test("GET /rides/nearby rejected for a rider (role-gated)", async () => {
    const res = await api("GET", "/rides/nearby", {
      cookie: state.rider1.cookie,
    });
    assertStatus(res, 403, "rider hitting driver-only nearby route");
  });

  await test("GET /rides/nearby returns ride1 for an online nearby driver", async () => {
    const res = await api("GET", "/rides/nearby", {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "GET /rides/nearby");
    const found = res.json.rides.some((r) => r._id === state.ride1Id);
    assert(found, "expected ride1 to appear in driver1's nearby list");
  });

  // ===================== RIDES: GET BY ID (pre-accept) =====================
  section("RIDES — get by id (ownership + not-yet-matched)");

  await test("GET /rides/:id malformed id returns 400", async () => {
    const res = await api("GET", "/rides/not-a-valid-id", {
      cookie: state.rider1.cookie,
    });
    assertStatus(res, 400, "malformed ride id");
  });

  await test("GET /rides/:id returns 404 for a non-party driver before acceptance", async () => {
    const res = await api("GET", `/rides/${state.ride1Id}`, {
      cookie: state.driver2.cookie,
    });
    assertStatus(res, 404, "non-party GET before accept");
  });

  // ===================== RIDES: ACCEPT / CONFLICT =====================
  section("RIDES — accept & race condition");

  await test("driver1 accepts ride1", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/accept`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "driver1 accept ride1");
    assert(res.json.ride.status === "accepted", "expected status accepted");
  });

  await test("driver2 loses the race — 409 on the same ride", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/accept`, {
      cookie: state.driver2.cookie,
    });
    assertStatus(res, 409, "driver2 accept after driver1 already accepted");
  });

  await test("driver2 cannot progress a ride they don't own", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/arrive`, {
      cookie: state.driver2.cookie,
    });
    assertStatus(res, 403, "driver2 progressing driver1's ride");
  });

  // ===================== RIDES: PHONE VISIBILITY =====================
  section("RIDES — phone visibility & vehicle info on GET /rides/:id");

  await test("driver1 sees rider's phone while ride is accepted", async () => {
    const res = await api("GET", `/rides/${state.ride1Id}`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "driver1 GET ride1 (accepted)");
    assert(
      res.json.ride.riderId.phone === state.rider1.phone,
      "expected driver to see rider's phone during an active ride",
    );
  });

  await test("rider1 sees driver1's vehicle info (but never a phone field)", async () => {
    const res = await api("GET", `/rides/${state.ride1Id}`, {
      cookie: state.rider1.cookie,
    });
    assertStatus(res, 200, "rider1 GET ride1");
    assert(
      res.json.ride.driverId.vehicleNumber === "LEA-1234",
      "expected rider to see the matched driver's vehicle number",
    );
    assert(
      res.json.ride.driverId.phone === undefined,
      "driver's phone should never be returned to the rider",
    );
  });

  await test("driver1 marks ride1 as arrived", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/arrive`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "arrive ride1");
    assert(res.json.ride.status === "arrived", "expected status arrived");
  });

  await test("arriving twice is an invalid transition (409)", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/arrive`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 409, "double arrive");
  });

  await test("phone still visible to driver while arrived", async () => {
    const res = await api("GET", `/rides/${state.ride1Id}`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "driver1 GET ride1 (arrived)");
    assert(
      res.json.ride.riderId.phone === state.rider1.phone,
      "phone should still be visible",
    );
  });

  await test("driver1 starts ride1", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/start`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "start ride1");
    assert(
      res.json.ride.status === "in_progress",
      "expected status in_progress",
    );
  });

  await test("driver1 completes ride1", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/complete`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "complete ride1");
    assert(res.json.ride.status === "completed", "expected status completed");
  });

  await test("rider's phone is stripped from the response after completion", async () => {
    const res = await api("GET", `/rides/${state.ride1Id}`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 200, "driver1 GET ride1 (completed)");
    assert(
      res.json.ride.riderId.phone === undefined,
      "phone should be stripped server-side once the ride is completed",
    );
  });

  await test("cancel is rejected on a completed ride (409)", async () => {
    const res = await api("PATCH", `/rides/${state.ride1Id}/cancel`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 409, "cancel a completed ride");
  });

  // ===================== RIDES: RIDER CANCELLATION =====================
  section("RIDES — rider cancellation");

  await test("rider1 creates and cancels ride2", async () => {
    const createRes = await api("POST", "/rides", {
      cookie: state.rider1.cookie,
      body: {
        pickup: { coordinates: PICKUP },
        dropoff: { coordinates: DROPOFF },
      },
    });
    assertStatus(createRes, 201, "create ride2");
    state.ride2Id = createRes.json.ride._id;

    const cancelRes = await api("PATCH", `/rides/${state.ride2Id}/cancel`, {
      cookie: state.rider1.cookie,
    });
    assertStatus(cancelRes, 200, "cancel ride2");
    assert(
      cancelRes.json.ride.status === "cancelled",
      "expected status cancelled",
    );
  });

  await test("a cancelled ride can no longer be accepted", async () => {
    const res = await api("PATCH", `/rides/${state.ride2Id}/accept`, {
      cookie: state.driver1.cookie,
    });
    assertStatus(res, 409, "accept a cancelled ride");
  });

  await test("a non-party still gets 404 on a cancelled, never-accepted ride", async () => {
    const res = await api("GET", `/rides/${state.ride2Id}`, {
      cookie: state.driver2.cookie,
    });
    assertStatus(res, 404, "non-party GET on cancelled ride");
  });

  // ===================== FORGOT / RESET PASSWORD (no email inbox access) =====================
  section(
    "AUTH — forgot/reset password (generic responses only — no inbox access here)",
  );

  await test("forgot-password never reveals whether the email exists", async () => {
    const res = await api("POST", "/auth/forgot-password", {
      body: { email: "definitely-not-a-real-account@test.dev" },
    });
    assertStatus(res, 200, "forgot-password unknown email");
  });

  await test("reset-password rejects a bogus token", async () => {
    const res = await api("POST", "/auth/reset-password", {
      body: {
        email: state.rider1.email,
        token: "not-a-real-token",
        newPassword: "newpassword123",
      },
    });
    assertStatus(res, 400, "reset-password bogus token");
  });

  await test("verify-email rejects an incorrect OTP", async () => {
    const res = await api("POST", "/auth/verify-email", {
      body: { email: state.rider1.email, otp: "000000" },
    });
    assertStatus(res, 400, "verify-email wrong otp");
  });

  // ===================== SUMMARY =====================
  console.log(`\n${"-".repeat(40)}`);
  console.log(`${passed}/${passed + failed} passing`);
  if (failed > 0) {
    console.log(`\nFailed:`);
    failures.forEach((name) => console.log(`  - ${name}`));
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nTest run crashed:", err);
  process.exit(1);
});
