/**
 * validate-contract.js
 * Checks the incoming contract has the right shape before we try to generate.
 * Returns an array of error strings. Empty array = valid.
 */

const VALID_TYPES   = ['string', 'email', 'number', 'boolean', 'date', 'enum']
const VALID_ACTIONS = ['list', 'create', 'update', 'delete', 'search']
const CAMEL_RE      = /^[a-z][a-zA-Z0-9]*$/

function validateContract(contract) {
  const errors = []

  if (!contract || typeof contract !== 'object') {
    return ['contract must be a JSON object']
  }

  // ── resource ─────────────────────────────────────────────────────────────
  if (!contract.resource)                            errors.push('contract.resource is required')
  else {
    if (!contract.resource.name)                     errors.push('contract.resource.name is required')
    else if (!CAMEL_RE.test(contract.resource.name)) errors.push(`contract.resource.name "${contract.resource.name}" must be camelCase`)

    if (!contract.resource.plural)                   errors.push('contract.resource.plural is required')
  }

  // ── fields ────────────────────────────────────────────────────────────────
  if (!Array.isArray(contract.fields) || contract.fields.length === 0) {
    errors.push('contract.fields must be a non-empty array')
  } else {
    const seen = new Set()
    contract.fields.forEach((f, i) => {
      const prefix = `contract.fields[${i}]`

      if (!f.name)                          errors.push(`${prefix}.name is required`)
      else if (!CAMEL_RE.test(f.name))      errors.push(`${prefix}.name "${f.name}" must be camelCase`)
      else if (seen.has(f.name))            errors.push(`${prefix}.name "${f.name}" is duplicated`)
      else                                  seen.add(f.name)

      if (!f.type)                          errors.push(`${prefix}.type is required`)
      else if (!VALID_TYPES.includes(f.type)) errors.push(`${prefix}.type "${f.type}" must be one of: ${VALID_TYPES.join(', ')}`)

      if (f.type === 'enum') {
        if (!Array.isArray(f.options) || f.options.length === 0)
          errors.push(`${prefix} is type "enum" but has no options array`)
      }
    })
  }

  // ── actions ───────────────────────────────────────────────────────────────
  if (!Array.isArray(contract.actions) || contract.actions.length === 0) {
    errors.push('contract.actions must be a non-empty array')
  } else {
    if (!contract.actions.includes('list'))
      errors.push('contract.actions must include "list"')

    contract.actions.forEach(a => {
      if (!VALID_ACTIONS.includes(a))
        errors.push(`contract.actions contains unknown action "${a}". Valid: ${VALID_ACTIONS.join(', ')}`)
    })
  }

  return errors
}

module.exports = { validateContract }
