import { createHash } from "node:crypto";

// Same Contract => same hash on both laptops, whatever order the keys were written in.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function contractHash(contract) {
  const json = JSON.stringify(canonicalize(contract));
  return createHash("sha256").update(json).digest("hex");
}
