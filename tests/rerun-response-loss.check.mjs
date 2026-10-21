/** Offline lifecycle seam tests only. No test here is hosted/browser acceptance
 * evidence, a real backend action, or proof of Chromium/firewall compatibility. */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { withholdSuccessfulResponseAndReload } from "./rerun-response-loss.mjs";

const url =
  "http://127.0.0.1:5174/api/v1/projects/project/copilot/rerun-intents";
const receipt = { state: "prepared", requestId: "opaque-request" };
const envelope = JSON.stringify({ code: 200, detail: receipt });

function seam(options = {}) {
  const log = [];
  const session = new EventEmitter();
  const page = new EventEmitter();
  const frame = {};
  const request = {
    url: () => url,
    method: () => "POST",
    failure: () => ({ errorText: options.pageError ?? "net::ERR_ABORTED" }),
  };
  const networkId = "network-17";
  const fetchId = "fetch-interception-99";
  const response = {
    request: () => request,
    status: () => options.headerStatus ?? 200,
  };
  const chunks = options.chunks ?? [
    { data: options.body ?? envelope, eof: true },
  ];
  let chunkIndex = 0;
  session.send = async (method, params) => {
    log.push({ method, params });
    if (options.hangMethod === method) return new Promise(() => {});
    if (options.failMethod === method)
      throw new Error("do not expose response data");
    if (method === "Fetch.takeResponseBodyAsStream")
      return { stream: "stream-1" };
    if (method === "IO.read") return chunks[chunkIndex++];
    if (method === "Fetch.disable" && options.finishDuringCleanup)
      page.emit("requestfinished", request);
    return {};
  };
  session.detach = async () => {
    log.push({ method: "session.detach" });
  };
  page.url = () => "http://127.0.0.1:5174/workspace/Copilot/chat";
  page.mainFrame = () => frame;
  page.context = () => ({ newCDPSession: async () => session });
  page.close = async () => {
    log.push({ method: "page.close" });
    if (options.failClose) throw new Error("close unavailable");
  };
  page.reload = async (params) => {
    log.push({ method: "page.reload", params });
    if (options.reloadError) throw new Error("reload failed");
    if (!options.noNavigation) page.emit("framenavigated", frame);
    if (!options.noNetworkAbort)
      session.emit("Network.loadingFailed", {
        requestId: options.abortNetworkId ?? networkId,
        errorText: options.networkError ?? "net::ERR_ABORTED",
        canceled: options.cancelled ?? true,
      });
    if (!options.noPageAbort) page.emit("requestfailed", request);
    if (options.headersOnReload) page.emit("response", response);
    if (options.finishOnReload) page.emit("requestfinished", request);
    if (options.networkFinishOnReload)
      session.emit("Network.loadingFinished", { requestId: networkId });
    if (options.retryOnReload) page.emit("request", request);
  };
  const emitRequest = () => {
    page.emit("request", request);
    session.emit("Network.requestWillBeSent", {
      requestId: networkId,
      request: { url, method: "POST" },
    });
  };
  const paused = {
    requestId: fetchId,
    networkId,
    request: { url, method: "POST" },
    responseStatusCode: 200,
    responseHeaders: [{ name: "Cache-Control", value: "private, no-store" }],
    ...options.pause,
  };
  const args = {
    page,
    url,
    deadline: Date.now() + (options.budget ?? 2000),
    click: async () => {
      log.push({ method: "click" });
      if (options.noRequest) return;
      emitRequest();
      if (options.headersBeforePause) page.emit("response", response);
      if (options.duplicateRequest) emitRequest();
      if (options.abortBeforeReload) page.emit("requestfailed", request);
      session.emit("Fetch.requestPaused", paused);
      if (options.duplicatePause) session.emit("Fetch.requestPaused", paused);
    },
    validateResponse: (value) => {
      log.push({ method: "validateResponse" });
      assert.deepEqual(value, receipt);
      if (options.invalidReceipt) throw new Error("sensitive body details");
      return options.noValidatedResult ? undefined : value;
    },
    beforeReload: (value) => {
      log.push({ method: "beforeReload" });
      assert.deepEqual(value, receipt);
      if (options.badPendingUI)
        throw new Error("UI received a private response");
    },
  };
  return { args, log, page, session, fetchId, networkId };
}

const names = (s) => s.log.map(({ method }) => method);
const assertRemoved = (s) => {
  assert.equal(s.page.eventNames().length, 0);
  assert.equal(s.session.eventNames().length, 0);
};

test("offline seam: holds a real-response-shaped stream until reload and correlated abort", async () => {
  const s = seam();
  assert.deepEqual(await withholdSuccessfulResponseAndReload(s.args), receipt);
  assert.deepEqual(names(s), [
    "Network.enable",
    "Fetch.enable",
    "click",
    "Fetch.takeResponseBodyAsStream",
    "IO.read",
    "IO.close",
    "validateResponse",
    "beforeReload",
    "page.reload",
    "Fetch.disable",
    "session.detach",
  ]);
  assert.deepEqual(s.log[1].params, {
    patterns: [{ urlPattern: url, requestStage: "Response" }],
  });
  assert.deepEqual(s.log[3].params, { requestId: s.fetchId });
  assert.notEqual(s.fetchId, s.networkId);
  assert.deepEqual(s.log[4].params, { handle: "stream-1", size: 16 * 1024 });
  assert.ok(s.log[8].params.timeout > 0);
  assert.equal(s.log[8].params.waitUntil, "domcontentloaded");
  assertRemoved(s);
});

test("offline seam: joins sequential base64 chunks and closes only after EOF", async () => {
  const bytes = Buffer.from(envelope);
  const s = seam({
    chunks: [
      {
        data: bytes.subarray(0, 9).toString("base64"),
        base64Encoded: true,
        // A missing false flag never counts as EOF.
      },
      {
        data: bytes.subarray(9).toString("base64"),
        base64Encoded: true,
        eof: true,
      },
    ],
  });
  assert.deepEqual(await withholdSuccessfulResponseAndReload(s.args), receipt);
  assert.equal(names(s).filter((v) => v === "IO.read").length, 2);
  assert.ok(names(s).lastIndexOf("IO.read") < names(s).indexOf("IO.close"));
});

test("offline seam: a single correlated 200 header event is not body delivery", async () => {
  const s = seam({ headersBeforePause: true });
  assert.deepEqual(await withholdSuccessfulResponseAndReload(s.args), receipt);
  assert.ok(names(s).includes("page.reload"));
});

for (const [label, options] of [
  ["HTTP failure", { pause: { responseStatusCode: 500 } }],
  ["request-stage pause", { pause: { responseStatusCode: undefined } }],
  ["response network error", { pause: { responseErrorReason: "Failed" } }],
  ["redirect", { pause: { redirectedRequestId: "prior-fetch" } }],
  [
    "off-target response",
    { pause: { request: { url: `${url}/other`, method: "POST" } } },
  ],
  ["wrong method", { pause: { request: { url, method: "GET" } } }],
  ["wrong network correlation", { pause: { networkId: "another-network" } }],
  ["missing Network ID", { pause: { networkId: undefined } }],
  ["missing Fetch ID", { pause: { requestId: undefined } }],
  ["missing no-store", { pause: { responseHeaders: [] } }],
  [
    "weak no-store substring",
    {
      pause: {
        responseHeaders: [{ name: "cache-control", value: "x-no-store" }],
      },
    },
  ],
  ["duplicate page/network POST", { duplicateRequest: true }],
  ["duplicate response pause", { duplicatePause: true }],
  ["abort before reload", { abortBeforeReload: true }],
  ["non-JSON response", { body: "private body text" }],
  [
    "unsuccessful API envelope",
    { body: JSON.stringify({ code: 400, detail: receipt }) },
  ],
  ["missing detail", { body: JSON.stringify({ code: 200 }) }],
  ["invalid receipt", { invalidReceipt: true }],
  ["missing validated return value", { noValidatedResult: true }],
  ["UI already consumed response", { badPendingUI: true }],
  ["empty non-EOF stream chunk", { chunks: [{ data: "", eof: false }] }],
  [
    "oversized individual chunk",
    { chunks: [{ data: "x".repeat(16 * 1024 + 1), eof: true }] },
  ],
  [
    "oversized accumulated body",
    {
      chunks: Array.from({ length: 17 }, () => ({
        data: "x".repeat(16 * 1024),
        eof: false,
      })),
    },
  ],
  ["missing real main-frame navigation", { noNavigation: true }],
  ["wrong page abort", { pageError: "net::ERR_FAILED" }],
  ["wrong Network abort", { networkError: "net::ERR_FAILED" }],
  ["non-cancelled Network failure", { cancelled: false }],
  ["reload failure", { reloadError: true }],
  ["non-200 response header", { headersBeforePause: true, headerStatus: 500 }],
  [
    "duplicate response headers",
    { headersBeforePause: true, headersOnReload: true },
  ],
  ["finished original request", { finishOnReload: true }],
  ["finished original network request", { networkFinishOnReload: true }],
  ["retried POST on reload", { retryOnReload: true }],
  ["late completion during cleanup", { finishDuringCleanup: true }],
]) {
  test(`offline seam: rejects ${label} without any request/response fulfillment`, async () => {
    const s = seam(options);
    await assert.rejects(
      withholdSuccessfulResponseAndReload(s.args),
      (error) => {
        assert.doesNotMatch(
          error.message,
          /private body text|sensitive body details|http:\/\//,
        );
        return true;
      },
    );
    assert.ok(
      !names(s).some(
        (v) =>
          /continue|fulfill|fetch|evaluate|storage/i.test(v) &&
          !v.startsWith("Fetch."),
      ),
    );
    assert.ok(!names(s).includes("Fetch.continueRequest"));
    assert.ok(!names(s).includes("Fetch.fulfillRequest"));
    assertRemoved(s);
  });
}

for (const options of [
  { noRequest: true },
  { noPageAbort: true },
  { noNetworkAbort: true },
  { abortNetworkId: "wrong-network" },
  { hangMethod: "IO.read" },
]) {
  test(`offline seam: missing evidence consumes only inherited deadline ${JSON.stringify(options)}`, async () => {
    const s = seam({ ...options, budget: 80 });
    const started = Date.now();
    await assert.rejects(
      withholdSuccessfulResponseAndReload(s.args),
      /inherited deadline/,
    );
    assert.ok(Date.now() - started < 500);
    assert.ok(names(s).includes("page.close"));
    assertRemoved(s);
  });
}

test("offline seam: failed page destruction never disables or detaches interception", async () => {
  const s = seam({ invalidReceipt: true, failClose: true });
  await assert.rejects(withholdSuccessfulResponseAndReload(s.args));
  assert.ok(names(s).includes("page.close"));
  assert.ok(!names(s).includes("Fetch.disable"));
  assert.ok(!names(s).includes("session.detach"));
  assertRemoved(s);
});

test("offline seam: cleanup is inside original deadline and failure cannot produce success", async () => {
  const s = seam({ hangMethod: "Fetch.disable", budget: 80 });
  const started = Date.now();
  await assert.rejects(
    withholdSuccessfulResponseAndReload(s.args),
    /inherited deadline/,
  );
  assert.ok(Date.now() - started < 500);
  assertRemoved(s);
});

for (const invalidURL of [
  "not-a-url",
  "https://outside.example/api/v1/projects/project/copilot/rerun-intents",
  `${url}?query=value`,
  `${url}#fragment`,
  `${url}*`,
  "http://127.0.0.1:5174/api/v1/unrelated",
  "http://user:password@127.0.0.1:5174/api/v1/projects/project/copilot/rerun-intents",
]) {
  test("offline seam: rejects non-exact/nonlocal endpoint before attaching", async () => {
    const s = seam();
    await assert.rejects(
      withholdSuccessfulResponseAndReload({ ...s.args, url: invalidURL }),
    );
    assert.deepEqual(s.log, []);
  });
}

test("offline seam: an expired deadline cannot perform a click or attach", async () => {
  const s = seam();
  await assert.rejects(
    withholdSuccessfulResponseAndReload({
      ...s.args,
      deadline: Date.now() - 1,
    }),
  );
  assert.deepEqual(s.log, []);
});
