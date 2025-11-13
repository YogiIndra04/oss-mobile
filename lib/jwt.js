import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function signJwt(payload) {
  console.log("Signing with secret:", JWT_SECRET);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return null;
  }
}
