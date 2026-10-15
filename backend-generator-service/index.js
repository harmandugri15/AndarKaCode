require('dotenv').config()
const express = require('express')
const app     = express()

app.use(express.json())

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backend-generator' }))

// Routes
app.use('/generate', require('./src/routes/generate.route'))
app.use('/build',    require('./src/routes/build.route'))

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`backend-generator-service running on :${PORT}`))

module.exports = app
