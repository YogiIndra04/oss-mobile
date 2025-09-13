import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "supersecret123"

export function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" })
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    console.error("JWT verify error:", err.message)
    return null
  }
}
