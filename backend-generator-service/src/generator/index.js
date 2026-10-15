/**
 * generator/index.js
 * Entry point. Calls all builders and assembles the final "files" object.
 */

const { buildModel }      = require('./model.builder')
const { buildRoutes }     = require('./routes.builder')
const { buildController } = require('./controller.builder')
const { buildValidation } = require('./validation.builder')
const { buildTests }      = require('./test.builder')
const {
  buildServerJs,
  buildPackageJson,
  buildEnvExample,
  buildDockerCompose,
  buildDockerfile,
} = require('./static.builder')

function generate(contract) {
  const { name, plural } = contract.resource

  const files = {
    // Static / boilerplate
    'server.js':          buildServerJs(contract),
    'package.json':       buildPackageJson(contract),
    '.env.example':       buildEnvExample(),
    'Dockerfile':         buildDockerfile(),
    'docker-compose.yml': buildDockerCompose(contract),

    // Placeholder — the Wirer drops index.html here later
    'frontend/.gitkeep':  '',

    // Generated from contract
    [`backend/models/${name}.model.js`]:          buildModel(contract),
    [`backend/routes/${name}.routes.js`]:         buildRoutes(contract),
    [`backend/controllers/${name}.controller.js`]: buildController(contract),
    [`backend/validation/${name}.validation.js`]: buildValidation(contract),

    // Tests
    'tests/api.test.js': buildTests(contract),
  }

  return files
}

module.exports = { generate }
