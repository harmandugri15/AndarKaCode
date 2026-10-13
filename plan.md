# Plan: AI Frontend-to-Backend Builder (MVP)

**Guiding principle:** Screenshot-to-Code generates the frontend; our product turns it into a real, working application.

**Status:** Plan approved. Currently on **Checkpoint 1**.

> These facts were checked against the Screenshot-to-Code source at commit `a813977` (9 Oct 2026). Re-check them if we upgrade to a newer version.
>
> 1. **It has no REST API for code generation.** It has one WebSocket endpoint, `/generate-code`. Its own React app is the client.
> 2. **Its "React + Tailwind" output is not a React project.** It is one `index.html` file. Inside it, React is loaded from a CDN, the JSX sits in a `<script type="text/babel">` block that the browser compiles, and the sample data is hard-coded.

---

## Q1. How do we run it separately and call it from our code?

**Running it:** start it as its own service (Docker or Poetry). It needs at least one AI key: OpenAI, Anthropic or Gemini. Keep it on `localhost` only, never open to the internet, because its CORS setting allows every origin.

**Calling it:** our Express backend acts as a **WebSocket client**, playing the same role as Screenshot-to-Code's own frontend.

- **What we send:** one JSON message. It includes `generatedCodeConfig: "react_tailwind"`, `inputMode: "image"`, `generationType: "create"`, and `prompt: { images: [<screenshot as a data URL>] }`.
- **What it sends back:** a stream of messages shaped `{ type, variantIndex, value }`. The types are `status`, `chunk` (code arriving piece by piece), `setCode` (the full code), `variantComplete`, `variantError` and `error`.

All protocol code lives in **one file: `s2cAdapter.js`**. The rest of our app only calls `generateUI(screenshot)`, which returns the HTML. When Screenshot-to-Code changes its protocol, we only fix that one file (the *Adapter pattern*).

Notes:
- This WebSocket is **internal, not a public API**, so it may change. Pin the exact commit we run.
- One generation creates **4 variants** by default (`NUM_VARIANTS = 4`), which means about 4× the AI cost. We take variant 0, or let the user choose.

## Q2. What output and metadata do we store?

| Store | Why |
|---|---|
| Final `index.html` from `setCode` | This is the input to everything after it |
| Variant index, stack, model used | So a result can be reproduced and debugged |
| Original screenshot (file path, not stored inside MongoDB) | Lets us show "before and after" |
| Screenshot-to-Code commit hash | Its output format can change between versions |
| Status, timestamps, error messages | For job tracking |

We don't need `/api/export`, which zips the HTML and images, for the MVP.

## Q3. How do we analyse the generated React code?

Two layers. Code reads the facts first, then AI interprets them.

1. **Extract:** pull the JSX out of the `<script type="text/babel">` tag.
2. **Parse with no AI:** `@babel/parser` turns the JSX into a tree (an AST), and we walk the tree to find:
   - table headers (`<th>`) → likely field names
   - `<input>` / `<select>` with name, type and placeholder → fields and their types
   - `<button>` text such as "Add", "Edit", "Delete" or "Search" → the CRUD actions needed
   - **hard-coded arrays** such as `const employees = [{ name, email, salary }]` → the best clue for the data model

   The result is a structured **UI inventory** in JSON. This step is predictable, free and testable.
3. **Interpret with AI:** send the inventory (not the screenshot) to an LLM. It proposes the resource name, field types, required fields and routes. It also returns a list of **open questions** for the developer, such as "Who may delete?", "Is email unique?" or "Hard or soft delete?". We check the LLM's JSON against a schema so a bad response is caught instead of crashing the app.

Routes and navigation: generated pages are usually a single page with tabs, so the MVP ignores routes.

## Q4. Generate everything automatically, or plan first and then approve?

**Plan first, then approve.** When we generate, **build the backend from templates, not free-form AI code.**

- A screenshot can't reveal business rules, so the developer must confirm them.
- CRUD backends follow a known shape: model, routes, controller, validation. Filling templates from the approved plan gives the same code every time, code that runs, and code we can explain line by line.
- So the AI handles the fuzzy part (understanding the UI), and plain code handles the precise part (writing the backend).
- Connecting the frontend is the one step where AI edits code: hard-coded arrays become `fetch` calls. Worth trying Screenshot-to-Code's own `generationType: "update"` mode for this. Either way, we parse the result again with Babel to confirm it's still valid.

## Q5. Smallest useful end-to-end MVP

> **Upload an employee-dashboard screenshot → review and approve a plan → download a zip containing an Express + MongoDB backend and a connected `index.html` → run it locally → add, list, edit and delete employees, with changes stored in MongoDB.**

Deliberately left out of the MVP: logins inside the generated app, multiple resources, routing, deployment, and running generated code on our server.

- **Safety:** the developer runs the generated app on their own machine, so our server never executes generated code. A Docker sandbox for a "Test" button comes later.
- **Two separate databases:**
  - `builder_db` is our product's own data: projects, jobs and plans.
  - `employee_app` is the *generated* app's data. Its connection string lives in the generated `.env`.

---

## Architecture (MVP)

```
[Our React/Vite UI] --REST + polling--> [Our Express API] --Mongoose--> builder_db
                                              |
                       +----------------------+----------------------+
                       v                      v                      v
               s2cAdapter.js           analyzer (Babel         generator (templates
             (WebSocket client)        AST + LLM plan)          -> zip download)
                       |
                       v
     [Screenshot-to-Code: separate FastAPI service, localhost only]
```

**Jobs:** a `Job` document in MongoDB with a status of `queued`, `running`, `done` or `failed`, plus progress text. The frontend checks `GET /api/jobs/:id` every 2 seconds. No Redis or job queue yet, because nothing at our scale needs one.

---

## Stages (each ends with a checkpoint we report back on)

| # | Stage | Done when | Size |
|---|---|---|---|
| **1** | **Screenshot-to-Code spike** | A Node script sends a screenshot and saves `index.html`, and we can explain every message type | S |
| 2 | Express + Mongo skeleton | `POST /api/projects`, `GET /api/projects/:id`, and the `Job` model work | S |
| 3 | Generation job | `POST /api/projects/:id/generations` runs the adapter in the background, and the job status updates | M |
| 4 | Analyzer, parse layer | 3 different generated dashboards produce sensible UI-inventory JSON, with unit tests | M |
| 5 | Plan layer (LLM + questions) | The plan JSON passes schema checks, and the UI shows the plan plus open questions for approval | M |
| 6 | Template generator | An approved plan produces a zip whose backend passes CRUD tests against a test DB | M |
| 7 | Frontend wiring | The generated `index.html` calls the API, handles loading and error states, and the demo works end to end | M–L |
| 8 | Product features | Login for *our* product, project history, a generated-file viewer | M |
| later | Search, more resources, Docker test sandbox, MCP server reusing the same services | | |

**Suggested team split after Stage 1:** A: adapter and jobs · B: analyzer · C: templates and generator · D: our React UI.

## Risks

| Risk | Level | What we do |
|---|---|---|
| The Screenshot-to-Code WebSocket changes | High | Pin the commit and keep all protocol code in one adapter file |
| Generated HTML varies between runs | High | Write the parser to tolerate missing pieces, and test it on several real outputs |
| AI cost (4 variants per run) | Medium | Save sample outputs and reuse them during development, so the AI isn't called for every test |
| Frontend wiring breaks the JSX | Medium | Re-parse after editing, and fall back to showing the developer the diff |
| Missing sample data in the output | Low | Fall back to table headers and form inputs |
| Licensing | Low | Keep Screenshot-to-Code's MIT notice. We call it as a service rather than copy its code |

---

## Checkpoint 1 (current)

1. Run Screenshot-to-Code and generate an employee dashboard through **its own UI**.
2. In Chrome DevTools, open **Network → WS → Messages** and screenshot the exact JSON it sends and receives. This confirms the protocol instead of guessing.
3. Write a ~40-line `s2c-client.js` that does the same thing from Node and saves `index.html`.
4. Report back with: the JSON you saw, the saved `index.html`, and the problems you hit.

**Environment notes (lead's machine, 13 Oct 2026):** Node 26, npm 11, Git, Python 3.14 and Poetry 2.5 are installed. Docker and MongoDB are **not** installed, so we run Screenshot-to-Code with Poetry (no Docker). Still to check: whether its Python version requirement accepts 3.14
