/**
 * model.builder.js
 * Contract fields + rules → Mongoose schema file as a string.
 */

// Maps contract field type to Mongoose type string
const MONGOOSE_TYPE = {
  string:  'String',
  email:   'String',
  number:  'Number',
  boolean: 'Boolean',
  date:    'Date',
  enum:    'String',
}

function buildModel(contract) {
  const { name, plural } = contract.resource
  const ModelName        = name.charAt(0).toUpperCase() + name.slice(1)
  const softDelete       = contract.rules?.delete === 'soft'

  // Build each field definition
  const fieldLines = contract.fields.map(f => {
    const parts = [`type: ${MONGOOSE_TYPE[f.type]}`]

    if (f.required) parts.push('required: true')
    if (f.unique)   parts.push('unique: true')
    if (f.min !== undefined) parts.push(`min: ${f.min}`)
    if (f.max !== undefined) parts.push(`max: ${f.max}`)

    if (f.type === 'email') {
      parts.push("match: [/^\\S+@\\S+\\.\\S+$/, 'Invalid email address']")
    }

    if (f.type === 'enum') {
      const opts = f.options.map(o => `'${o}'`).join(', ')
      parts.push(`enum: [${opts}]`)
    }

    return `    ${f.name}: { ${parts.join(', ')} },`
  })

  // Soft delete extra field
  if (softDelete) {
    fieldLines.push(`    deletedAt: { type: Date, default: null },`)
  }

  // Pre-find hook for soft delete
  const softDeleteHook = softDelete
    ? `\n// Automatically exclude soft-deleted records from every find query\n${ModelName}Schema.pre(/^find/, function () {\n  this.where({ deletedAt: null })\n})\n`
    : ''

  return `const mongoose = require('mongoose')

const ${ModelName}Schema = new mongoose.Schema(
  {
${fieldLines.join('\n')}
  },
  { timestamps: true }
)
${softDeleteHook}
module.exports = mongoose.model('${ModelName}', ${ModelName}Schema)
`
}

module.exports = { buildModel }
