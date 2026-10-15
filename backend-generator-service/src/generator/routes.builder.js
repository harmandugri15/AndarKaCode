/**
 * routes.builder.js
 * Contract actions → Express router file as a string.
 */

function buildRoutes(contract) {
  const { name, plural } = contract.resource
  const ModelName        = name.charAt(0).toUpperCase() + name.slice(1)
  const actions          = contract.actions

  const lines = []

  if (actions.includes('search')) {
    // search must come before /:id so Express doesn't treat "search" as an id
    lines.push(`router.get('/search', ctrl.search)`)
  }
  if (actions.includes('list'))   lines.push(`router.get('/',     ctrl.list)`)
  if (actions.includes('create')) lines.push(`router.post('/',    validate, ctrl.create)`)
  if (actions.includes('update')) lines.push(`router.put('/:id',  validate, ctrl.update)`)
  if (actions.includes('delete')) lines.push(`router.delete('/:id', ctrl.remove)`)

  return `const router = require('express').Router()
const ctrl   = require('../controllers/${name}.controller')
const { validate } = require('../validation/${name}.validation')

${lines.join('\n')}

module.exports = router
`
}

module.exports = { buildRoutes }
