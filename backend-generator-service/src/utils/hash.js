/**
 * hash.js
 * Produces a deterministic SHA-256 hash of a contract.
 * Same contract = same hash, regardless of key order.
 * Mirrors the logic in shared/hash.mjs in the main project.
 */

const crypto = require('crypto')

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(k => [k, canonicalize(value[k])])
    )
  }
  return value
}

function contractHash(contract) {
  const json = JSON.stringify(canonicalize(contract))
  return crypto.createHash('sha256').update(json).digest('hex')
}

module.exports = { contractHash }
