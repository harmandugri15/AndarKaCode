# Roadmap: AI Frontend-to-Backend Builder

> **Design:** see [ARCHITECTURE.md](ARCHITECTURE.md) (v2, approved). This file is our **step-by-step to-do list**.
> **Rule:** do one step, report back, then move on. Tick the box when its "Done when" is true.

**Current step:** ▶ **Step 4: Contract Extractor experiment (Laptop A)**

---

## How we work on each step

Every step has four parts:
- **Why:** what this step proves or builds.
- **You do:** the hands-on tasks (we write any code together, in small pieces).
- **Done when:** a clear test that the step is finished.
- **Report back:** what to send, so we can check it and move on.

---

## Phase 1: Prove the risky parts first (small experiments)

*Why first:* if local models can't do the job, we want to know **now**, not after building everything else.

- [x] **Step 1: Ollama on Laptop B's GPU.** ✅ 14 Oct: runs well on the GPU; correctly identified the screenshot's columns and buttons. Install Ollama, pull `qwen3-vl:8b`, and confirm it runs **100% on the GPU**.
- [x] **Step 2: Screenshot-to-Code on Laptop B (local model).** ✅ 15 Oct: works with local `qwen3-vl:8b` (alias `gpt-5.5`), about 60–70% match, **over 5 min** per page. Run it with Ollama behind it, apply the 1-variant patch, generate one dashboard through *its own* UI, and capture the WebSocket messages in DevTools.
- [x] **Step 3: Contract instructions + backup key.** ✅ 15 Oct: local 3 min 38 s, Gemini 30 s. All `data-field` markers present in both; local missed `data-action="create"`; one output had no `SAMPLE_EMPLOYEES`. Send field names and `data-field` / `data-action` markers as text with the image, and check they appear in the HTML. Try the cloud key path once.
- [ ] **Step 4: Contract Extractor experiment (Laptop A).** A small Node script: screenshot → Ollama → valid Contract JSON. Time it.

## Phase 2: Connect the two laptops

- [ ] **Step 5: Project repo skeleton.** One Git repo for both laptops: folders for `gateway/`, `builder-api/`, `web/`, `templates/`, `spikes/`, `samples/`, plus `.gitignore` and `.env.example`.
- [ ] **Step 6: Gateway on Laptop B.** Our first real service: `POST /v1/generations`, `GET /v1/generations/:id`, `GET /v1/health`, with an API key and a queue.
- [ ] **Step 7: Tailscale + first call between the laptops.** `curl` from Laptop A → Gateway on B → HTML comes back.

## Phase 3: Orchestrator on Laptop A

- [ ] **Step 8: Builder API skeleton.** Express + MongoDB, `projects` / `jobs` / `contracts` models, upload endpoint.
- [ ] **Step 9: State machine + Sync Barrier.** Upload → Contract → both branches run → the Barrier checks `contractHash`.

## Phase 4: Generate, wire, verify

- [ ] **Step 10: Backend Generator.** Contract → Express/Mongoose code + generated API tests (from our templates).
- [ ] **Step 11: Wirer.** Babel AST: replace `SAMPLE_*` with `fetch`, connect `data-action` buttons.
- [ ] **Step 12: Verifier + repair loop.** Contract check, boot check, API tests; automatic repair with an "update" job.

## Phase 5: Ship to the user

- [ ] **Step 13: Our React UI.** Upload, live status, Contract review and edit, download.
- [ ] **Step 14: Sandbox preview.** Docker, with limits and no secrets, plus a Playwright smoke test.
- [ ] **Step 15: GitHub login + Publish.** OAuth App, encrypted token, create a repo and push one commit, CI turns green.
- [ ] **Step 16: Demo rehearsal.** Demo mode, warm cache, backup video, viva practice.

---

## Notes and decisions log

| Date | Note |
|---|---|
| 13 Oct 2026 | Laptop A: Apple M5, 16 GB, Node 26, Python 3.14, Poetry 2.5, Ollama installed (`qwen3-vl:8b` present). No Docker or MongoDB yet. |
| 14 Oct 2026 | Laptop B: RTX 4060 8 GB VRAM, 16 GB RAM. OS: _to fill in_. |
| 14 Oct 2026 | Architecture v2 approved: contract-first sync, local-first with a cloud backup key, GitHub publish. |
| 15 Oct 2026 | Laptop B OS: **Windows 11**. Screenshot-to-Code at `Desktop\screenshot-code\screenshot-to-code`; patch = 2 variant lines + 2 Windows fixes (`main.py` UTF-8, `start.py` event loop). |
| 15 Oct 2026 | Frontend style: **`html_tailwind`**. The Wirer must not depend on `SAMPLE_*` (models sometimes skip it): render rows from the first `data-field` table row. A missing `data-action` goes to the repair step. |
| 15 Oct 2026 | S2C picks Ollama over Gemini when an OpenAI key is in its `.env`, so the Gateway's cloud mode needs that key removed from `.env`. |
| 15 Oct 2026 | Contract Extractor: use **`qwen3-vl:8b-instruct`** (the thinking variant returns empty `content` with structured output). Test on Laptop B: 12 s, correct Contract. Enum options only list values visible in the screenshot, so the user should review them. |
