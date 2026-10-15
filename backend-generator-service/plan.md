# Backend Generator Microservice — Plan

> **What this is:** A standalone Express microservice that accepts a Contract JSON
> and returns a complete, ready-to-run Express + MongoDB app as file contents.
> No AI. No database. Pure template-based generation.
>
> **Lives at:** `D:\backend-generator-service`
> **Called by:** The Orchestrator (Builder API on Laptop A)
> **Does NOT write to disk** — it just returns text. The Orchestrator writes the files.

---

## How It Fits in the Bigger Project

```
User uploads screenshot
        │
        ▼
Contract Extractor  →  Contract JSON
        │
        ▼
Backend Generator Microservice  ◄── YOU ARE HERE
  (this service, POST /generate)
        │
        │  returns JSON with file contents
        ▼
Orchestrator writes files to disk
        │
        ▼
Wirer drops index.html into /frontend
        │
        ▼
Verifier runs tests
        │
        ▼
User gets a working app on GitHub
```

---

## Input

```
POST /generate
Content-Type: application/json

{
  "contract": {
    "version": 1,
    "resource": {
      "name": "employee",
      "plural": "employees",
      "label": "Employee Management"
    },
    "fields": [
      { "name": "fullName",   "label": "Full Name",   "type": "string", "required": true },
      { "name": "email",      "label": "Email",       "type": "email",  "required": true, "unique": true },
      { "name": "department", "label": "Department",  "type": "enum",   "options": ["HR", "Engineering"] },
      { "name": "salary",     "label": "Salary",      "type": "number", "required": true }
    ],
    "actions": ["list", "create", "update", "delete", "search"],
    "rules": { "delete": "soft", "auth": "none" }
  }
}
```

---

## Output

```
HTTP 200
{
  "meta": {
    "resource": "employee",
    "contractHash": "a3f9d2...",
    "generatedAt": "2026-10-15T17:30:00Z",
    "filesCount": 9
  },
  "files": {
    "server.js":                                    "...full file text...",
    "package.json":                                 "...full file text...",
    ".env.example":                                 "...full file text...",
    "docker-compose.yml":                           "...full file text...",
    "frontend/.gitkeep":                            "",
    "backend/models/employee.model.js":             "...full file text...",
    "backend/routes/employee.routes.js":            "...full file text...",
    "backend/controllers/employee.controller.js":   "...full file text...",
    "backend/validation/employee.validation.js":    "...full file text...",
    "tests/api.test.js":                            "...full file text..."
  },
  "warnings": []
}
```

---

## What Each Generated File Does

| File | What it contains | Driven by |
|---|---|---|
| `server.js` | Starts Express, serves `/frontend` folder, mounts API routes, `/health` endpoint | Always the same skeleton |
| `package.json` | Dependencies: express, mongoose, dotenv, express-validator | Always the same |
| `.env.example` | `PORT` and `MONGO_URI` placeholders | Always the same |
| `docker-compose.yml` | Two services: app + mongo | Always the same |
| `frontend/.gitkeep` | Empty placeholder. Wirer drops `index.html` here later | Always the same |
| `models/*.model.js` | Mongoose schema — one field per contract field, types + constraints | `contract.fields` |
| `routes/*.routes.js` | Express routes — one route per contract action | `contract.actions` |
| `controllers/*.controller.js` | Logic for list, create, update, delete, search, soft-delete | `contract.actions` + `contract.rules` |
| `validation/*.validation.js` | express-validator rules — one rule per required/typed field | `contract.fields` |
| `tests/api.test.js` | Jest + Supertest — one test block per action | `contract.actions` |

---

## How Field Types Map to Mongoose + Validation

| Contract type | Mongoose type | Validator rule |
|---|---|---|
| `string` | `String` | `notEmpty()` if required |
| `email` | `String` | `isEmail()` |
| `number` | `Number` | `isNumeric()`, `isFloat({ min: 0 })` if min set |
| `boolean` | `Boolean` | `isBoolean()` |
| `date` | `Date` | `isISO8601()` |
| `enum` | `String, enum: [options]` | `isIn([options])` |

---

## How Actions Map to Routes

| Contract action | HTTP method | Route | Controller method |
|---|---|---|---|
| `list` | `GET` | `/api/:resource` | `list()` |
| `create` | `POST` | `/api/:resource` | `create()` |
| `update` | `PUT` | `/api/:resource/:id` | `update()` |
| `delete` | `DELETE` | `/api/:resource/:id` | `remove()` — soft if `rules.delete: soft` |
| `search` | `GET` | `/api/:resource/search?q=` | `search()` — queries all string/email fields |

---

## How the Soft Delete Rule Works

If `contract.rules.delete === "soft"`:
- Model gets an extra `deletedAt: { type: Date, default: null }` field
- Model gets a pre-find hook that always filters `{ deletedAt: null }`
- DELETE controller sets `deletedAt = new Date()` instead of removing the document
- All other queries automatically exclude soft-deleted records

If `contract.rules.delete` is anything else (or not set):
- DELETE controller calls `findByIdAndDelete()`
- No extra field, no hook

---

## This Microservice's Own Folder Structure

```
D:\backend-generator-service\
├── plan.md                        ← this file
├── package.json                   ← express, dotenv
├── .env.example
├── index.js                       ← starts the server
├── src/
│   ├── routes/
│   │   └── generate.route.js      ← POST /generate
│   ├── generator/
│   │   ├── index.js               ← entry point, calls all builders, returns files object
│   │   ├── server.builder.js      ← builds server.js content
│   │   ├── model.builder.js       ← builds models/*.model.js content
│   │   ├── routes.builder.js      ← builds routes/*.routes.js content
│   │   ├── controller.builder.js  ← builds controllers/*.controller.js content
│   │   ├── validation.builder.js  ← builds validation/*.validation.js content
│   │   ├── test.builder.js        ← builds tests/api.test.js content
│   │   └── static.builder.js      ← builds package.json, docker-compose, .env.example
│   └── utils/
│       ├── hash.js                ← SHA-256 of the contract (same logic as shared/hash.mjs)
│       └── validate-contract.js   ← checks contract shape before generating
```

---

## Build Steps (Do One, Report Back)

- [ ] **Step 1: Scaffold** — `npm init`, install dependencies, create folder structure, `index.js` boots and `GET /health` returns `{ status: "ok" }`.

- [ ] **Step 2: Contract validator** — `validate-contract.js` checks the incoming contract has `resource`, `fields`, `actions`. Returns clear errors if malformed.

- [ ] **Step 3: Model builder** — `model.builder.js` generates the Mongoose schema file as a string from `contract.fields` and `contract.rules`.

- [ ] **Step 4: Routes + Controller builders** — generate routes and controller from `contract.actions`.

- [ ] **Step 5: Validation builder** — generate express-validator rules from `contract.fields`.

- [ ] **Step 6: Test builder** — generate Jest + Supertest file from `contract.actions` and `contract.fields`.

- [ ] **Step 7: Static builders** — generate `server.js`, `package.json`, `.env.example`, `docker-compose.yml`.

- [ ] **Step 8: Wire it all together** — `generator/index.js` calls all builders, assembles the `files` object, hashes the contract, returns the full response from `POST /generate`.

- [ ] **Step 9: End-to-end test** — send the employees contract to `POST /generate`, write the returned files to a temp folder, run `npm install` + `npm test` inside it, confirm all tests pass.

---

## Notes and Decisions

| Date | Note |
|---|---|
| 15 Oct 2026 | Service lives at `D:\backend-generator-service`, separate from the main project repo. |
| 15 Oct 2026 | Output format: JSON with file contents as strings. Orchestrator writes files to disk. |
| 15 Oct 2026 | Frontend merging strategy: Option 1 (same origin). `server.js` serves `frontend/` as static. Wirer drops `index.html` there later. No CORS needed. |
| 15 Oct 2026 | Soft delete if `contract.rules.delete === "soft"`. Hard delete otherwise. |
| 15 Oct 2026 | No AI anywhere in this service. Pure deterministic template generation. |
