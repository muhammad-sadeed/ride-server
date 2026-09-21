import jwt from "jsonwebtoken";
import { issueAuthCookie } from "../lib/auth.js";

export const requireAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    issueAuthCookie(res, { userId: decoded.userId, role: decoded.role }); // sliding session

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
