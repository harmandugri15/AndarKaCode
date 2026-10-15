/**
 * test.builder.js
 * Contract actions + fields → Jest + Supertest test file as a string.
 */

// Build a valid request body from contract fields
function makeValidBody(fields) {
  const entries = fields.map(f => {
    let value
    switch (f.type) {
      case 'string':  value = `'Test ${f.name}'`;              break
      case 'email':   value = `'test@example.com'`;            break
      case 'number':  value = f.min !== undefined ? f.min : 1; break
      case 'boolean': value = true;                            break
      case 'date':    value = `'2026-01-01'`;                  break
      case 'enum':    value = `'${f.options[0]}'`;             break
      default:        value = `'test'`;
    }
    return `  ${f.name}: ${value}`
  })
  return `{\n${entries.join(',\n')}\n}`
}

// Pick the first required field to omit for a validation failure test
function missingRequiredField(fields) {
  return fields.find(f => f.required)?.name ?? fields[0]?.name
}

function buildTests(contract) {
  const { name, plural } = contract.resource
  const actions          = contract.actions
  const validBody        = makeValidBody(contract.fields)
  const missingField     = missingRequiredField(contract.fields)

  const blocks = []

  // ── setup / teardown ──────────────────────────────────────────────────────
  blocks.push(`const request  = require('supertest')
const mongoose = require('mongoose')
const app      = require('../server')

const validBody = ${validBody}

let createdId

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/${name}_test')
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  await new Promise(r => setTimeout(r, 200)) // allow server to close cleanly
})`)

  // ── create ────────────────────────────────────────────────────────────────
  if (actions.includes('create')) {
    blocks.push(`test('POST /api/${plural} — creates a record', async () => {
  const res = await request(app).post('/api/${plural}').send(validBody)
  expect(res.status).toBe(201)
  createdId = res.body._id
  expect(createdId).toBeDefined()
})`)

    if (missingField) {
      blocks.push(`test('POST /api/${plural} — rejects missing required field (${missingField})', async () => {
  const body = { ...validBody }
  delete body.${missingField}
  const res = await request(app).post('/api/${plural}').send(body)
  expect(res.status).toBe(422)
})`)
    }
  }

  // ── list ──────────────────────────────────────────────────────────────────
  if (actions.includes('list')) {
    blocks.push(`test('GET /api/${plural} — returns an array', async () => {
  const res = await request(app).get('/api/${plural}')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
  expect(res.body.length).toBeGreaterThan(0)
})`)
  }

  // ── search ────────────────────────────────────────────────────────────────
  if (actions.includes('search')) {
    // Use the value from the first string/email field as the search term
    const searchField  = contract.fields.find(f => f.type === 'string' || f.type === 'email')
    const searchTerm   = searchField
      ? (searchField.type === 'email' ? 'test@example.com' : `Test ${searchField.name}`)
      : 'test'

    blocks.push(`test('GET /api/${plural}/search?q= — returns matching records', async () => {
  const res = await request(app).get('/api/${plural}/search?q=${searchTerm}')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})`)
  }

  // ── update ────────────────────────────────────────────────────────────────
  if (actions.includes('update')) {
    // Pick a field safe to update
    const updateField = contract.fields.find(f => f.type === 'string') ?? contract.fields[0]
    const updateValue = updateField?.type === 'string' ? `'Updated Value'` : 99

    blocks.push(`test('PUT /api/${plural}/:id — updates a record', async () => {
  const res = await request(app)
    .put(\`/api/${plural}/\${createdId}\`)
    .send({ ${updateField?.name}: ${updateValue} })
  expect(res.status).toBe(200)
  expect(res.body.${updateField?.name}).toBe(${updateValue})
})`)

    blocks.push(`test('PUT /api/${plural}/:id — 404 for unknown id', async () => {
  const res = await request(app)
    .put('/api/${plural}/000000000000000000000000')
    .send(validBody)
  expect(res.status).toBe(404)
})`)
  }

  // ── delete ────────────────────────────────────────────────────────────────
  if (actions.includes('delete')) {
    const softDelete = contract.rules?.delete === 'soft'

    blocks.push(`test('DELETE /api/${plural}/:id — ${softDelete ? 'soft ' : ''}deletes a record', async () => {
  const res = await request(app).delete(\`/api/${plural}/\${createdId}\`)
  expect(res.status).toBe(200)
})`)

    if (softDelete) {
      blocks.push(`test('GET /api/${plural} — soft-deleted record does not appear in list', async () => {
  const res = await request(app).get('/api/${plural}')
  expect(res.status).toBe(200)
  const found = res.body.find(item => item._id === createdId)
  expect(found).toBeUndefined()
})`)
    }
  }

  // ── health ────────────────────────────────────────────────────────────────
  blocks.push(`test('GET /health — returns ok', async () => {
  const res = await request(app).get('/health')
  expect(res.status).toBe(200)
  expect(res.body.status).toBe('ok')
})`)

  return blocks.join('\n\n') + '\n'
}

module.exports = { buildTests }
