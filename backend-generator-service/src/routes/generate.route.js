/**
 * generate.route.js
 * POST /generate — validates the contract and runs the generator.
 */

const router                 = require('express').Router()
const { validateContract }   = require('../utils/validate-contract')
const { contractHash }       = require('../utils/hash')
const { generate }           = require('../generator')

router.post('/', (req, res) => {
  // Accept either { contract: { ... } } or { resource: { ... }, fields: [...] } directly
  const contract = req.body?.contract || (req.body?.resource ? req.body : null)

  // 1. Check the contract is present
  if (!contract) {
    return res.status(400).json({ error: 'Request body must contain the contract object (either directly or under a "contract" key).' })
  }

  // 2. Validate the contract shape
  const errors = validateContract(contract)
  if (errors.length > 0) {
    return res.status(422).json({ errors })
  }

  // 3. Generate all files
  const files = generate(contract)

  // 4. Build warnings (non-fatal observations)
  const warnings = []
  contract.fields
    .filter(f => f.type === 'enum' && f.options.length < 3)
    .forEach(f =>
      warnings.push(`Field "${f.name}" only has ${f.options.length} enum option(s). Consider reviewing if more values exist.`)
    )

  // 5. Return result
  res.json({
    meta: {
      resource:      contract.resource.name,
      contractHash:  contractHash(contract),
      generatedAt:   new Date().toISOString(),
      filesCount:    Object.keys(files).length,
    },
    files,
    warnings,
  })
})

module.exports = router
