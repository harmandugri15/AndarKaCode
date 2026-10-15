// Step 7: Laptop A calls the Gateway on Laptop B over Tailscale.
// Usage (repo root):  node --env-file=builder-api/.env spikes/gateway-call/call.mjs [image.png] [auto|local|cloud]
// Needs GATEWAY_URL and GATEWAY_API_KEY (same key as gateway/.env on Laptop B).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contractHash } from "../../shared/hash.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const imagePath = path.resolve(process.argv[2] ?? path.join(root, "samples/employees.png"));
const mode = process.argv[3] ?? "local";
const { GATEWAY_URL, GATEWAY_API_KEY } = process.env;
if (!GATEWAY_URL || !GATEWAY_API_KEY) {
  console.error("Set GATEWAY_URL and GATEWAY_API_KEY in builder-api/.env");
  process.exit(1);
}

async function gateway(method, route, body) {
  const res = await fetch(`${GATEWAY_URL}${route}`, {
    method,
    headers: { "X-API-Key": GATEWAY_API_KEY, ...(body && { "Content-Type": "application/json" }) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${data.error}`);
  return data;
}

const health = await gateway("GET", "/v1/health");
console.log("Health:", JSON.stringify(health));
if (!health.s2cUp) throw new Error("Screenshot-to-Code is not running on Laptop B");

// The Contract that sits next to the screenshot (from Step 4) gives the hash and the field names.
const contractPath = imagePath.replace(/\.(png|jpe?g)$/i, ".contract.local.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const image = `data:image/png;base64,${(await readFile(imagePath)).toString("base64")}`;
const instructions = await readFile(path.join(root, "instructions/instructiontext.txt"), "utf8");

const started = Date.now();
let job = await gateway("POST", "/v1/generations", {
  image,
  instructions,
  contractHash: contractHash(contract),
  mode,
});
console.log(`Job ${job.jobId}: ${job.status}`);

let lastLine = "";
while (job.status === "queued" || job.status === "running") {
  await new Promise((r) => setTimeout(r, 2000)); // ARCHITECTURE §6: A polls B every 2 s
  job = await gateway("GET", `/v1/generations/${job.jobId}`);
  const line = `${job.status} | ${job.progress} | ${job.chars} chars`;
  if (line !== lastLine) console.log(`[${job.seconds} s] ${line}`);
  lastLine = line;
}

const total = ((Date.now() - started) / 1000).toFixed(0);
if (job.status !== "done") {
  console.error(`FAILED after ${total} s: ${job.error}`);
  process.exit(1);
}
const outPath = imagePath.replace(/\.(png|jpe?g)$/i, `.from-mac-${job.provider}.html`);
await writeFile(outPath, job.html);
console.log(`Done in ${total} s via ${job.provider}: ${job.html.length} chars -> ${outPath}`);
console.log(`contractHash matches: ${job.contractHash === contractHash(contract)}`);
