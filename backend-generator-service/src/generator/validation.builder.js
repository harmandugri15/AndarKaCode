/**
 * validation.builder.js
 * Contract fields → express-validator rules file as a string.
 */

function buildValidation(contract) {
  const { name } = contract.resource

  const rules = contract.fields.map(f => {
    const chains = [`  body('${f.name}')`]

    if (f.required) {
      chains.push(`    .notEmpty().withMessage('${f.name} is required')`)
    } else {
      chains.push(`    .optional()`)
    }

    switch (f.type) {
      case 'email':
        chains.push(`    .isEmail().withMessage('${f.name} must be a valid email address')`)
        break
      case 'number':
        chains.push(`    .isNumeric().withMessage('${f.name} must be a number')`)
        if (f.min !== undefined)
          chains.push(`    .isFloat({ min: ${f.min} }).withMessage('${f.name} must be >= ${f.min}')`)
        if (f.max !== undefined)
          chains.push(`    .isFloat({ max: ${f.max} }).withMessage('${f.name} must be <= ${f.max}')`)
        break
      case 'boolean':
        chains.push(`    .isBoolean().withMessage('${f.name} must be true or false')`)
        break
      case 'date':
        chains.push(`    .isISO8601().withMessage('${f.name} must be a valid date (ISO 8601)')`)
        break
      case 'enum': {
        const opts = f.options.map(o => `'${o}'`).join(', ')
        chains.push(`    .isIn([${opts}]).withMessage('${f.name} must be one of: ${f.options.join(', ')}')`)
        break
      }
    }

    return chains.join('\n') + ','
  })

  return `const { body, validationResult } = require('express-validator')

const rules = [
${rules.join('\n')}
]

function validate(req, res, next) {
  // Run every rule synchronously then collect results
  Promise.all(rules.map(rule => rule.run(req))).then(() => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() })
    }
    next()
  })
}

module.exports = { validate }
`
}

module.exports = { buildValidation }
