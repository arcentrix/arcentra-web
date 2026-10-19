import assert from "node:assert/strict";

/** No token/object may escape observation while its value is still unknown. */
export async function observeInboxLogin(
  page,
  submitAndRead,
  protectSensitiveValue,
) {
  let earlyConsoleEvents = 0;
  const observe = () => {
    earlyConsoleEvents++;
  };
  page.on("console", observe);
  try {
    const body = await submitAndRead();
    assert.ok(
      body?.code === 200 && body?.detail?.token,
      "Inbox login did not return a successful token envelope",
    );
    for (const key of ["accessToken", "refreshToken"]) {
      const value = body.detail.token[key];
      assert.ok(
        typeof value === "string" && value.length > 0 && value.length <= 16_384,
        "Inbox login token contract is invalid",
      );
      protectSensitiveValue(value);
    }
    assert.equal(
      earlyConsoleEvents,
      0,
      "Authentication must not emit console data before token guards are registered",
    );
  } finally {
    page.off("console", observe);
  }
}
