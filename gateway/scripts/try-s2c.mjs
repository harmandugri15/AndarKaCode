// Piece 2 test: screenshot -> Screenshot-to-Code -> HTML file, without the REST layer.
// Usage (from gateway/):  node --env-file=.env scripts/try-s2c.mjs [image.png] [local|cloud]
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateHtml, providerParams } from "../src/s2c-client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const imagePath = path.resolve(process.argv[2] ?? path.join(root, "samples/employees.png"));
const mode = process.argv[3] ?? "local";

const imageDataUrl = `data:image/png;base64,${(await readFile(imagePath)).toString("base64")}`;
const instructions = await readFile(path.join(root, "instructions/instructiontext.txt"), "utf8");

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)} s`;
let lastLog = 0;

const { html } = await generateHtml({
  wsUrl: process.env.S2C_WS_URL ?? "ws://127.0.0.1:7001/generate-code",
  imageDataUrl,
  instructions,
  provider: providerParams(mode, {
    ollamaUrl: process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    geminiApiKey: process.env.GEMINI_API_KEY,
  }),
  onProgress: ({ status, chars }) => {
    if (Date.now() - lastLog < 5000) return; // one line every 5 s
    lastLog = Date.now();
    console.log(`[${elapsed()}] ${status} ${chars} chars`);
  },
}).catch((err) => {
  console.error(`FAILED after ${elapsed()}: ${err.message.slice(0, 300)}`);
  process.exit(1);
});

const outPath = imagePath.replace(/\.(png|jpe?g)$/i, `.gateway-${mode}.html`);
await writeFile(outPath, html);

const count = (re) => (html.match(re) ?? []).length;
console.log(`Done in ${elapsed()}: ${html.length} chars -> ${outPath}`);
console.log(`Markers: ${count(/data-field=/g)} data-field, ${count(/data-action=/g)} data-action`);
for (const action of ["create", "update", "delete", "search"]) {
  if (!html.includes(`data-action="${action}"`)) console.log(`  missing data-action="${action}"`);
}
