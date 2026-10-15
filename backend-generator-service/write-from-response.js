/**
 * write-from-response.js
 * ─────────────────────
 * Takes a JSON response containing { "files": { ... } } and writes
 * all the files to a folder on disk.
 *
 * Usage:
 *   node write-from-response.js <path-to-response.json> [output-folder]
 *
 * Example:
 *   node write-from-response.js D:\postman-response.json D:\my-app
 */

const fs   = require('fs')
const path = require('path')

const responseFile = process.argv[2]
const outputDir    = process.argv[3] || 'D:\\generated-app'

if (!responseFile) {
  console.log('Usage: node write-from-response.js <response.json> [output-directory]')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(path.resolve(responseFile), 'utf8'))
const files = data.files || data

if (!files || typeof files !== 'object') {
  console.error('Error: No "files" object found in the provided JSON.')
  process.exit(1)
}

console.log(`Writing files to: ${outputDir}\n`)

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(outputDir, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content, 'utf8')
  console.log(`  ✓ ${relativePath}`)
}

console.log(`\nDone! All files created successfully in: ${outputDir}`)
