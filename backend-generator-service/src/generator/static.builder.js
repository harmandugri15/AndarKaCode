/**
 * static.builder.js
 * Generates the files that are always the same (or near-same) regardless of contract:
 * server.js, package.json, .env.example, docker-compose.yml, frontend/.gitkeep
 */

function buildServerJs(contract) {
  const { name, plural } = contract.resource

  return `const express  = require('express')
const mongoose = require('mongoose')
const path     = require('path')
require('dotenv').config()

const app = express()
app.use(express.json())

// Serve the wired frontend (index.html placed here by the Wirer step)
app.use(express.static(path.join(__dirname, 'frontend')))

// API routes
app.use('/api/${plural}', require('./backend/routes/${name}.routes'))

// Health check — used by the Verifier
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// SPA fallback — any other GET returns index.html
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'))
)

const port = process.env.PORT || 3000

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err.message))
} else {
  console.log('Notice: MONGO_URI not set. Running in database-offline mode.')
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(\`Server running on :\${port}\`))
}

module.exports = app // exported for Supertest
`
}

function buildPackageJson(contract) {
  const { plural } = contract.resource

  return JSON.stringify({
    name:    `${plural}-app`,
    version: '1.0.0',
    description: `Generated app for ${contract.resource.label || plural}`,
    main:    'server.js',
    scripts: {
      start: 'node server.js',
      test:  'jest --forceExit --runInBand'
    },
    dependencies: {
      dotenv:             '^16.0.0',
      express:            '^4.18.0',
      'express-validator': '^7.0.0',
      mongoose:           '^8.0.0'
    },
    devDependencies: {
      jest:        '^29.0.0',
      supertest:   '^6.0.0'
    },
    jest: {
      testEnvironment: 'node'
    }
  }, null, 2) + '\n'
}

function buildEnvExample() {
  return `PORT=3000
MONGO_URI=mongodb://localhost:27017/myapp
`
}

function buildDockerCompose(contract) {
  const { plural } = contract.resource

  return `services:
  app:
    build: .
    ports:
      - "\${PORT:-3000}:3000"
    env_file: .env
    depends_on:
      - mongo
    environment:
      MONGO_URI: mongodb://mongo:27017/${plural}_app

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
`
}

function buildDockerfile() {
  return `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
`
}

module.exports = {
  buildServerJs,
  buildPackageJson,
  buildEnvExample,
  buildDockerCompose,
  buildDockerfile,
}
