import { createHash, randomUUID } from "node:crypto";
import { generateHtml, providerParams } from "./s2c-client.js";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

// Jobs live in memory: Laptop A owns the real state and resubmits if the Gateway restarts.
export function createJobQueue({ wsUrl, ollamaUrl, geminiApiKey }) {
  const jobs = new Map(); // jobId -> job
  const jobIdByKey = new Map(); // same (image, contractHash, type) -> same job
  const waiting = []; // jobIds, oldest first
  let running = null; // jobId on the GPU right now

  function submit({ image, instructions, contractHash, mode }) {
    const key = sha256(`${sha256(image)}|${contractHash}|create`);
    const existing = jobs.get(jobIdByKey.get(key));
    if (existing && existing.status !== "failed") return { job: existing, created: false };

    const job = {
      id: randomUUID(),
      status: "queued",
      progress: "Waiting for the GPU",
      chars: 0,
      mode,
      provider: null,
      contractHash,
      html: null,
      finishedEarly: false,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      input: { image, instructions }, // dropped once the job finishes
    };
    jobs.set(job.id, job);
    jobIdByKey.set(key, job.id);
    waiting.push(job.id);
    runNext();
    return { job, created: true };
  }

  async function runNext() {
    if (running || waiting.length === 0) return;
    const job = jobs.get(waiting.shift());
    running = job.id;
    job.status = "running";
    job.progress = "Starting Screenshot-to-Code";
    job.startedAt = Date.now();

    // auto = local first, then one cloud retry if a cloud key is configured.
    const providers = job.mode === "auto" ? ["local", ...(geminiApiKey ? ["cloud"] : [])] : [job.mode];
    for (const provider of providers) {
      job.provider = provider;
      try {
        const { html, early } = await generateHtml({
          wsUrl,
          imageDataUrl: job.input.image,
          instructions: job.input.instructions,
          provider: providerParams(provider, { ollamaUrl, geminiApiKey }),
          onProgress: ({ status, chars }) => {
            job.progress = status;
            job.chars = chars;
          },
        });
        job.html = html;
        job.finishedEarly = early;
        job.error = null;
        break;
      } catch (err) {
        job.error = `${provider}: ${err.message}`.slice(0, 500);
        console.error(`Job ${job.id} ${job.error}`);
      }
    }

    job.status = job.html ? "done" : "failed";
    job.progress = job.html ? "Done" : "Failed";
    job.finishedAt = Date.now();
    delete job.input;
    running = null;
    runNext();
  }

  // What callers may see: never the input image, and the HTML only once it is done.
  function view(job) {
    const end = job.finishedAt ?? Date.now();
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      chars: job.chars,
      queuePosition: job.status === "queued" ? waiting.indexOf(job.id) + 1 : 0,
      seconds: job.startedAt ? Math.round((end - job.startedAt) / 1000) : 0,
      mode: job.mode,
      provider: job.provider,
      contractHash: job.contractHash,
      ...(job.status === "done" && { finishedEarly: job.finishedEarly, html: job.html }),
      ...(job.status === "failed" && { error: job.error }),
    };
  }

  return {
    submit,
    get: (id) => jobs.get(id),
    view,
    queueLength: () => waiting.length + (running ? 1 : 0),
  };
}
