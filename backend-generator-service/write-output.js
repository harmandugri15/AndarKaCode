/**
 * write-output.js
 * ───────────────
 * Calls POST /generate with a contract, then writes every returned file
 * to disk at the specified output directory.
 *
 * Usage:
 *   node write-output.js                        → writes to D:\employee-app
 *   node write-output.js D:\my-custom-folder    → writes there instead
 */

const fs   = require('fs')
const path = require('path')
const http = require('http')

// ── Config ────────────────────────────────────────────────────────────────────

let CONTRACT
let OUTPUT_DIR

const firstArg = process.argv[2]
const secondArg = process.argv[3]

if (firstArg && firstArg.endsWith('.json')) {
  // User provided a path to a contract JSON file
  CONTRACT = JSON.parse(fs.readFileSync(path.resolve(firstArg), 'utf8'))
  OUTPUT_DIR = secondArg ?? path.join('D:\\', `${CONTRACT.resource.plural}-app`)
} else {
  // Default fallback sample
  OUTPUT_DIR = firstArg ?? 'D:\\employee-app'
  CONTRACT = {
    version: 1,
    resource: {
      name:   'employee',
      plural: 'employees',
      label:  'Employee Management',
    },
    fields: [
      { name: 'fullName',   label: 'Full Name',   type: 'string', required: true },
      { name: 'email',      label: 'Email',       type: 'email',  required: true, unique: true },
      { name: 'department', label: 'Department',  type: 'enum',   required: true,
        options: ['HR', 'Engineering', 'Sales'] },
      { name: 'salary',     label: 'Salary',      type: 'number', required: true },
    ],
    actions: ['list', 'create', 'update', 'delete', 'search'],
    rules:   { delete: 'soft', auth: 'none' },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function post(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const options = {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }
    const req = http.request(url, options, res => {
      let data = ''
      res.on('data', chunk => (data += chunk))
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 400) reject(new Error(JSON.stringify(parsed, null, 2)))
          else resolve(parsed)
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📡  Calling POST http://localhost:4000/generate ...\n')

  let result
  try {
    result = await post('http://localhost:4000/generate', { contract: CONTRACT })
  } catch (e) {
    console.error('❌  Generate request failed:', e.message)
    process.exit(1)
  }

  const { meta, files, warnings } = result

  console.log('✅  Generator responded:')
  console.log(`    Resource:      ${meta.resource}`)
  console.log(`    Contract hash: ${meta.contractHash}`)
  console.log(`    Files:         ${meta.filesCount}`)
  if (warnings.length > 0) {
    console.log('\n⚠️   Warnings:')
    warnings.forEach(w => console.log('    •', w))
  }

  console.log(`\n📂  Writing files to: ${OUTPUT_DIR}\n`)

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(OUTPUT_DIR, relativePath)
    writeFile(fullPath, content)
    console.log(`    ✓  ${relativePath}`)
  }

  // Write a .env file so the user can fill in their MONGO_URI
  const envPath = path.join(OUTPUT_DIR, '.env')
  fs.writeFileSync(envPath, 'PORT=3000\nMONGO_URI=\n', 'utf8')
  console.log(`    ✓  .env  (fill in MONGO_URI before starting)`)

  console.log(`
────────────────────────────────────────────────────────
✅  Done!  Your generated app is at:
    ${OUTPUT_DIR}

Next steps:
  1. Open ${OUTPUT_DIR}\\.env
     Paste your MongoDB Atlas connection string as MONGO_URI
     e.g.  MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/employees

  2. In a terminal:
       cd ${OUTPUT_DIR}
       npm install
       npm start

  3. Open your browser:  http://localhost:3000/health
     If you see { "status": "ok" } — the backend is running ✅
────────────────────────────────────────────────────────
`)
}

main()
