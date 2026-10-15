/**
 * build.route.js
 * POST /build — accepts a Contract JSON, generates all code,
 * and writes the files directly into a folder on disk ready to run!
 */

const fs                   = require('fs')
const path                 = require('path')
const router               = require('express').Router()
const { validateContract } = require('../utils/validate-contract')
const { contractHash }     = require('../utils/hash')
const { generate }         = require('../generator')

router.post('/', (req, res) => {
  // Extract contract (supports either top-level or under contract key)
  const contract = req.body?.contract || (req.body?.resource ? req.body : null)

  if (!contract) {
    return res.status(400).json({
      error: 'Request body must contain the contract (either directly or in a "contract" field).'
    })
  }

  // Validate the contract
  const errors = validateContract(contract)
  if (errors.length > 0) {
    return res.status(422).json({ errors })
  }

  // Determine output folder
  const resourcePlural = contract.resource.plural || 'app'
  const targetFolder = req.body.outputPath
    ? path.resolve(req.body.outputPath)
    : path.join('D:\\', `${resourcePlural}-app`)

  try {
    // Generate all files
    const files = generate(contract)

    // Ensure output directory exists (without wiping existing node_modules)
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }

    // Write all files
    const writtenFiles = []
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(targetFolder, relativePath)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, content, 'utf8')
      writtenFiles.push(relativePath)
    }

    // Ensure a .env file exists if not already present
    const envPath = path.join(targetFolder, '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, 'PORT=3000\nMONGO_URI=\n', 'utf8')
      writtenFiles.push('.env')
    }

    res.json({
      status: 'success',
      message: `Backend app for '${contract.resource.name}' built successfully!`,
      folder: targetFolder,
      meta: {
        resource: contract.resource.name,
        contractHash: contractHash(contract),
        filesCount: writtenFiles.length
      },
      files: writtenFiles,
      howToRun: [
        `cd "${targetFolder}"`,
        'npm install',
        'npm start'
      ]
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to write files to disk: ' + err.message })
  }
})

module.exports = router
