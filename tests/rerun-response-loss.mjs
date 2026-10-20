import assert from "node:assert/strict";

const maxBodyBytes = 256 * 1024;
const chunkBytes = 16 * 1024;
const rerunPath =
  /^\/api\/v1\/projects\/[A-Za-z0-9_-]{1,128}\/copilot\/rerun-intents(?:\/[A-Za-z0-9_-]{1,128}\/confirm)?$/;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // Event failures may precede the next explicit await.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

/** Transport fault only: withhold one real successful POST response, then destroy
 * its document by a real reload. No routes, requests, responses, auth, storage,
 * or UI state are synthesized. The caller still proves persisted recovery.
 *
 * deadline is the caller's original absolute Date.now() deadline, not a duration.
 * The official Chromium hosted journey, not the offline seam tests, must prove
 * this CDP session coexists with the unchanged Playwright request firewall.
 */
export async function withholdSuccessfulResponseAndReload({
  page,
  url,
  deadline,
  click,
  validateResponse,
  beforeReload,
}) {
  let target;
  let documentURL;
  try {
    target = new URL(url);
    documentURL = new URL(page.url());
  } catch {
    throw new Error("Response loss requires valid exact URLs");
  }
  assert.ok(
    ["http:", "https:"].includes(target.protocol) &&
      ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) &&
      target.origin === documentURL.origin &&
      !target.username &&
      !target.password &&
      !target.search &&
      !target.hash &&
      rerunPath.test(target.pathname),
    "Response loss requires one exact same-origin loopback rerun endpoint",
  );
  assert.ok(
    Number.isSafeInteger(deadline) && deadline > Date.now(),
    "Response loss requires an unexpired inherited absolute deadline",
  );
  for (const callback of [click, validateResponse, beforeReload])
    assert.equal(typeof callback, "function");

  // Reserve cleanup time inside, never in addition to, the inherited deadline.
  const cleanupReserve = Math.min(
    1000,
    Math.max(1, Math.floor((deadline - Date.now()) / 4)),
  );
  const operationDeadline = deadline - cleanupReserve;
  const fatal = deferred();
  const paused = deferred();
  const aborted = deferred();
  let fatalError;
  let session;
  let stream;
  let armed = false;
  let disposed = false;
  let targetRequest;
  let requestCount = 0;
  let networkRequestCount = 0;
  let pauseCount = 0;
  let responseHeaderCount = 0;
  let networkId;
  let fetchId;
  let reloadStarted = false;
  let navigationObserved = false;
  let pageAbortObserved = false;
  let networkAbortObserved = false;
  let result;
  let failure;
  let success = false;

  const fail = (message) => {
    if (disposed || fatalError) return;
    fatalError = new Error(message);
    fatal.reject(fatalError);
  };
  const check = (condition, message) => {
    if (!condition) fail(message);
    return condition;
  };
  const exact = (request) => request.url() === target.href;
  const completeAbort = () => {
    if (pageAbortObserved && networkAbortObserved) aborted.resolve();
  };
  async function bounded(operation, label, cleanup = false) {
    const end = cleanup ? deadline : operationDeadline;
    const remaining = end - Date.now();
    if (remaining <= 0)
      throw new Error(`${label} exceeded the inherited deadline`);
    let timer;
    try {
      return await Promise.race([
        Promise.resolve()
          .then(operation)
          .catch(() => {
            throw new Error(`${label} failed`);
          }),
        ...(cleanup ? [] : [fatal.promise]),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} exceeded the inherited deadline`)),
            remaining,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  const onRequest = (request) => {
    if (!exact(request)) return;
    requestCount++;
    if (
      !check(
        request.method() === "POST" && requestCount === 1,
        "Response loss observed an unexpected or duplicate target request",
      )
    )
      return;
    targetRequest = request;
  };
  const onResponse = (response) => {
    if (!exact(response.request())) return;
    // Playwright response means headers, not completion or renderer consumption.
    // Chromium does not promise it follows a response-stage Fetch pause. The
    // consumed, unreleased stream plus unfinished request and pending UI prove
    // body loss; do not mistake a header notification for body delivery.
    responseHeaderCount++;
    check(
      response.request() === targetRequest &&
        response.status() === 200 &&
        responseHeaderCount === 1,
      "Unexpected or duplicate headers for the withheld response",
    );
  };
  const onFinished = (request) => {
    if (exact(request))
      fail("The withheld request completed instead of aborting");
  };
  const onFailed = (request) => {
    if (!exact(request)) return;
    if (
      check(
        request === targetRequest &&
          request.method() === "POST" &&
          request.failure()?.errorText === "net::ERR_ABORTED" &&
          reloadStarted &&
          !pageAbortObserved,
        "The withheld request did not abort exactly once because of reload",
      )
    ) {
      pageAbortObserved = true;
      completeAbort();
    }
  };
  const onNavigation = (frame) => {
    if (reloadStarted && frame === page.mainFrame()) navigationObserved = true;
  };
  const onNetworkRequest = (event) => {
    if (event.request.url !== target.href) return;
    networkRequestCount++;
    if (
      check(
        event.request.method === "POST" &&
          typeof event.requestId === "string" &&
          event.requestId.length > 0 &&
          networkRequestCount === 1 &&
          !event.redirectResponse,
        "Response loss observed an unexpected or duplicate network request",
      )
    )
      networkId = event.requestId;
  };
  const onPaused = (event) => {
    pauseCount++;
    if (
      !check(
        pauseCount === 1 &&
          event.request.url === target.href &&
          event.request.method === "POST" &&
          event.responseStatusCode === 200 &&
          !event.responseErrorReason &&
          !event.redirectedRequestId &&
          typeof event.requestId === "string" &&
          event.requestId.length > 0 &&
          typeof networkId === "string" &&
          event.networkId === networkId,
        "Response loss requires one correlated successful response-stage pause",
      )
    )
      return;
    // Fetch interception IDs and Network request IDs have distinct namespaces.
    // Only the Fetch ID may be sent to Fetch.takeResponseBodyAsStream.
    fetchId = event.requestId;
    paused.resolve(event);
  };
  const onNetworkFailed = (event) => {
    if (event.requestId !== networkId) return;
    if (
      check(
        event.errorText === "net::ERR_ABORTED" &&
          event.canceled === true &&
          reloadStarted &&
          !networkAbortObserved,
        "The correlated network request was not cancelled by reload",
      )
    ) {
      networkAbortObserved = true;
      completeAbort();
    }
  };
  const onNetworkFinished = (event) => {
    if (event.requestId === networkId)
      fail("The withheld network request completed instead of aborting");
  };
  const pageListeners = [
    ["request", onRequest],
    ["response", onResponse],
    ["requestfinished", onFinished],
    ["requestfailed", onFailed],
    ["framenavigated", onNavigation],
  ];
  const sessionListeners = [
    ["Network.requestWillBeSent", onNetworkRequest],
    ["Fetch.requestPaused", onPaused],
    ["Network.loadingFailed", onNetworkFailed],
    ["Network.loadingFinished", onNetworkFinished],
  ];
  try {
    session = await bounded(
      () => page.context().newCDPSession(page),
      "Response-loss CDP session creation",
    );
    for (const [name, listener] of pageListeners) page.on(name, listener);
    for (const [name, listener] of sessionListeners) session.on(name, listener);
    await bounded(() => session.send("Network.enable"), "Network observation");
    armed = true;
    await bounded(
      () =>
        session.send("Fetch.enable", {
          patterns: [{ urlPattern: target.href, requestStage: "Response" }],
        }),
      "Exact response-stage interception",
    );
    await bounded(click, "The deliberate UI click");
    const response = await bounded(
      () => paused.promise,
      "The real HTTP response",
    );
    assert.ok(
      requestCount === 1 && networkRequestCount === 1 && targetRequest,
      "One genuine page POST must precede the real HTTP response",
    );
    assert.ok(
      response.responseHeaders?.some(
        ({ name, value }) =>
          name.toLowerCase() === "cache-control" &&
          value.split(",").some((v) => v.trim().toLowerCase() === "no-store"),
      ),
      "The withheld real response must prohibit storage",
    );
    const opened = await bounded(
      () =>
        session.send("Fetch.takeResponseBodyAsStream", { requestId: fetchId }),
      "The real response body stream",
    );
    assert.ok(
      typeof opened.stream === "string" && opened.stream.length > 0,
      "The real response stream handle must exist",
    );
    stream = opened.stream;
    const chunks = [];
    let bytes = 0;
    for (;;) {
      const chunk = await bounded(
        () => session.send("IO.read", { handle: stream, size: chunkBytes }),
        "The bounded real response body read",
      );
      assert.ok(
        typeof chunk.data === "string" &&
          (chunk.eof === undefined || typeof chunk.eof === "boolean") &&
          (chunk.base64Encoded === undefined ||
            typeof chunk.base64Encoded === "boolean"),
        "The real response stream returned an invalid chunk",
      );
      assert.ok(
        chunk.data.length <=
          (chunk.base64Encoded ? 4 * Math.ceil(chunkBytes / 3) : chunkBytes),
        "The real response exceeded the hard chunk-size limit",
      );
      const data = Buffer.from(
        chunk.data,
        chunk.base64Encoded ? "base64" : "utf8",
      );
      bytes += data.length;
      assert.ok(
        data.length <= chunkBytes && bytes <= maxBodyBytes,
        "The real response exceeded the hard body-size limit",
      );
      assert.ok(
        data.length > 0 || chunk.eof,
        "The real response stream made no progress",
      );
      chunks.push(data);
      if (chunk.eof === true) break;
    }
    await bounded(
      () => session.send("IO.close", { handle: stream }),
      "Stream close",
    );
    stream = undefined;
    let envelope;
    try {
      envelope = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch {
      throw new Error("The withheld real response was not valid UTF-8 JSON");
    }
    assert.ok(
      envelope &&
        typeof envelope === "object" &&
        !Array.isArray(envelope) &&
        envelope.code === 200 &&
        Object.hasOwn(envelope, "detail"),
      "The withheld real response was not a successful API envelope",
    );
    result = await bounded(
      () => validateResponse(envelope.detail),
      "The withheld receipt validation",
    );
    assert.ok(
      result !== undefined,
      "Receipt validation must return its validated detail",
    );
    await bounded(
      () => beforeReload(result),
      "The still-pending UI assertions",
    );
    reloadStarted = true;
    await bounded(
      () =>
        page.reload({
          waitUntil: "domcontentloaded",
          timeout: Math.max(1, operationDeadline - Date.now()),
        }),
      "The real document reload",
    );
    await bounded(() => aborted.promise, "The correlated real request abort");
    assert.ok(
      navigationObserved,
      "The reload must navigate the real main frame",
    );
    assert.ok(
      requestCount === 1 && networkRequestCount === 1 && pauseCount === 1,
      "Response loss must not retry or duplicate a POST",
    );
    if (fatalError) throw fatalError;
    success = true;
  } catch (error) {
    failure = error;
  } finally {
    // A failing probe is fail-closed. Never release a held response into its old
    // document. The enclosing harness also owns browser shutdown on any failure.
    const cleanup = async (operation, label) => {
      try {
        await bounded(operation, label, true);
      } catch (error) {
        failure ??= error;
      }
    };
    let oldDocumentDestroyed = success || !armed;
    if (!success && armed)
      await cleanup(async () => {
        await page.close({ runBeforeUnload: false });
        oldDocumentDestroyed = true;
      }, "Failed-probe page close");
    if (stream)
      await cleanup(
        () => session.send("IO.close", { handle: stream }),
        "Failed-stream close",
      );
    // If destroying the old document fails, leave interception in place for the
    // enclosing harness to close the browser. Disabling/detaching could release it.
    if (session && oldDocumentDestroyed) {
      if (armed)
        await cleanup(
          () => session.send("Fetch.disable"),
          "Response interception cleanup",
        );
      await cleanup(() => session.detach(), "Response-loss CDP detach");
    }
    disposed = true;
    for (const [name, listener] of pageListeners) page.off(name, listener);
    if (session)
      for (const [name, listener] of sessionListeners)
        session.off(name, listener);
  }
  if (failure) throw failure;
  if (fatalError) throw fatalError;
  return result;
}
