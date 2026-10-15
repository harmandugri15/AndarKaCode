// One Screenshot-to-Code generation over its WebSocket (protocol checked against S2C commit a813977).

// Which keys S2C gets decides which model it uses; no restart needed to switch.
export function providerParams(mode, { ollamaUrl, geminiApiKey }) {
  if (mode === "local") return { openAiApiKey: "ollama", openAiBaseURL: `${ollamaUrl}/v1` };
  if (mode === "cloud") {
    if (!geminiApiKey) throw new Error("Cloud mode needs GEMINI_API_KEY in gateway/.env");
    return { geminiApiKey };
  }
  throw new Error(`Unknown mode "${mode}"`);
}

/**
 * Resolves with { html } when S2C finishes; rejects on any S2C error, early close or timeout.
 * onProgress({ status, chars }) is called as status messages and code chunks arrive.
 */
export function generateHtml({
  wsUrl,
  imageDataUrl,
  instructions,
  provider,
  stack = "html_tailwind",
  timeoutMs = 10 * 60_000,
  onProgress = () => {},
}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let html = null;
    let chars = 0;
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      if (err) reject(err);
      else resolve({ html });
    };

    const timer = setTimeout(
      () => finish(new Error(`Screenshot-to-Code timed out after ${timeoutMs / 1000} s`)),
      timeoutMs
    );

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          generationType: "create",
          inputMode: "image",
          generatedCodeConfig: stack,
          prompt: { text: instructions, images: [imageDataUrl], videos: [] },
          // Keep runs predictable: no AI image generation, no asset cropping.
          isImageGenerationEnabled: false,
          isAssetExtractionEnabled: false,
          ...provider,
        })
      );
    });

    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // not one of S2C's JSON messages
      }
      if (msg.variantIndex !== undefined && msg.variantIndex !== 0) return; // we run 1 variant

      switch (msg.type) {
        case "status":
          onProgress({ status: msg.value, chars });
          break;
        case "thinking":
        case "assistant":
          onProgress({ status: "Model is thinking...", chars });
          break;
        case "setCode":
          // Agent mode re-sends the whole page as it grows; the last one is the final page.
          html = msg.value;
          chars = html?.length ?? 0;
          onProgress({ status: "Writing the page...", chars });
          break;
        case "variantComplete":
          finish(html ? null : new Error("Screenshot-to-Code finished without any code"));
          break;
        case "variantError":
        case "error":
          finish(new Error(`Screenshot-to-Code: ${msg.value}`));
          break;
      }
    });

    ws.addEventListener("error", () =>
      finish(new Error(`Cannot reach Screenshot-to-Code at ${wsUrl}`))
    );
    ws.addEventListener("close", (event) =>
      finish(new Error(`Screenshot-to-Code closed the connection early (code ${event.code})`))
    );
  });
}
