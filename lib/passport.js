import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

// --- LOCAL STRATEGY (Email & Password) ---
passport.use(
  new LocalStrategy(
    {
      usernameField: "email", // We tell Passport to look for 'email' instead of 'username'
      session: false, // We are using JWT cookies, not server sessions
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select("+password");
        if (!user || !user.password) {
          return done(null, false, {
            message: "Invalid credentials or use Google Login",
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid credentials" });
        }

        // Authentication successful - pass the user to the controller
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// --- GOOGLE STRATEGY (OAuth 2.0) ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        // If user exists but hasn't linked Google, link it now
        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        }

        // If completely new user, create them
        user = await User.create({
          name: profile.displayName,
          email: email,
          googleId: profile.id,
          roles: ["rider"],
          activeRole: "rider",
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

export default passport;
