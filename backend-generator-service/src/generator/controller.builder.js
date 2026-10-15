/**
 * controller.builder.js
 * Contract actions + rules → Express controller file as a string.
 */

function buildController(contract) {
  const { name, plural } = contract.resource
  const ModelName        = name.charAt(0).toUpperCase() + name.slice(1)
  const actions          = contract.actions
  const softDelete       = contract.rules?.delete === 'soft'

  // Identify which fields are string/email (searchable)
  const searchableFields = contract.fields
    .filter(f => f.type === 'string' || f.type === 'email' || f.type === 'enum')
    .map(f => `{ ${f.name}: { $regex: q, $options: 'i' } }`)

  const methods = []

  // ── list ──────────────────────────────────────────────────────────────────
  if (actions.includes('list')) {
    methods.push(`// GET /api/${plural}
exports.list = async (req, res) => {
  try {
    const items = await ${ModelName}.find()
    res.json(items)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}`)
  }

  // ── search ────────────────────────────────────────────────────────────────
  if (actions.includes('search')) {
    const orClause = searchableFields.length > 0
      ? `{ $or: [\n        ${searchableFields.join(',\n        ')}\n      ] }`
      : '{}'

    methods.push(`// GET /api/${plural}/search?q=
exports.search = async (req, res) => {
  try {
    const q     = req.query.q ?? ''
    const items = await ${ModelName}.find(${orClause})
    res.json(items)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}`)
  }

  // ── create ────────────────────────────────────────────────────────────────
  if (actions.includes('create')) {
    const uniqueField = contract.fields.find(f => f.unique)
    const dupError    = uniqueField
      ? `\n    if (e.code === 11000) return res.status(409).json({ error: '${uniqueField.name} already exists' })`
      : ''

    methods.push(`// POST /api/${plural}
exports.create = async (req, res) => {
  try {
    const item = await ${ModelName}.create(req.body)
    res.status(201).json(item)
  } catch (e) {${dupError}
    res.status(500).json({ error: e.message })
  }
}`)
  }

  // ── update ────────────────────────────────────────────────────────────────
  if (actions.includes('update')) {
    methods.push(`// PUT /api/${plural}/:id
exports.update = async (req, res) => {
  try {
    const item = await ${ModelName}.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json(item)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}`)
  }

  // ── delete (soft or hard) ─────────────────────────────────────────────────
  if (actions.includes('delete')) {
    if (softDelete) {
      methods.push(`// DELETE /api/${plural}/:id  (soft delete)
exports.remove = async (req, res) => {
  try {
    const item = await ${ModelName}.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    )
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted', id: req.params.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}`)
    } else {
      methods.push(`// DELETE /api/${plural}/:id  (hard delete)
exports.remove = async (req, res) => {
  try {
    const item = await ${ModelName}.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted', id: req.params.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}`)
    }
  }

  return `const ${ModelName} = require('../models/${name}.model')

${methods.join('\n\n')}
`
}

module.exports = { buildController }
