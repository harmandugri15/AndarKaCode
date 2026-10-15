import { createHash, timingSafeEqual } from "node:crypto";

// Hash both sides so the comparison is constant-time even when the lengths differ.
const sha256 = (text) => createHash("sha256").update(text).digest();

export function requireApiKey(expectedKey) {
  const expected = sha256(expectedKey);
  return (req, res, next) => {
    const given = req.get("X-API-Key") ?? "";
    if (timingSafeEqual(sha256(given), expected)) return next();
    res.status(401).json({ error: "Missing or wrong X-API-Key" });
  };
}
