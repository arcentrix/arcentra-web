/** Versioned, synthetic-fixture-only contract. No downloaded code is executed. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const buildContract = Object.freeze({
  version: "stdlib-build-v1",
  artifactName: "stdlib-demo",
  manifestName: "manifest.json",
  goVersion: "go1.25.6",
  stdout: '{"message":"HELLO, ARCENTRA!","length":8}\n',
});
const fullCommit = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const binaryEnv = [
  "ARCENTRA_ACCEPTANCE_MANIFEST_NAME",
  "ARCENTRA_ACCEPTANCE_GO_VERSION",
  "ARCENTRA_ACCEPTANCE_EXPECTED_OUTPUT",
  "ARCENTRA_ACCEPTANCE_COORDINATION_DIR",
];

function exactKeys(value, keys, name) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${name} must be an object`,
  );
  assert.deepEqual(
    Object.keys(value).sort(),
    [...keys].sort(),
    `${name} fields`,
  );
}

// All v1 keys are unique across the document. JSON.parse alone silently accepts
// duplicate keys, which would make integrity and coordination records ambiguous.
function parseContractJSON(text) {
  const value = JSON.parse(text);
  const keys = new Set();
  for (const token of text.matchAll(/"(?:\\.|[^"\\])*"/g)) {
    if (!/^\s*:/.test(text.slice(token.index + token[0].length))) continue;
    const key = JSON.parse(token[0]);
    assert.ok(!keys.has(key), "Contract JSON must not contain duplicate keys");
    keys.add(key);
  }
  return value;
}

export function artifactContractConfig(env, required) {
  const mode = env.ARCENTRA_ACCEPTANCE_CONTRACT;
  if (mode === undefined) {
    assert.ok(
      binaryEnv.every((key) => env[key] === undefined),
      "Binary fixture fields require an explicit acceptance contract",
    );
    return {
      artifactMode: "text-v1",
      artifactContent: required("ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT"),
    };
  }
  assert.equal(mode, buildContract.version, "Unsupported acceptance contract");
  assert.equal(
    env.ARCENTRA_ACCEPTANCE_ARTIFACT_CONTENT,
    undefined,
    "Binary contract must not include text artifact content",
  );
  for (const [key, expected] of [
    ["ARCENTRA_ACCEPTANCE_ARTIFACT_NAME", buildContract.artifactName],
    ["ARCENTRA_ACCEPTANCE_MANIFEST_NAME", buildContract.manifestName],
    ["ARCENTRA_ACCEPTANCE_GO_VERSION", buildContract.goVersion],
    ["ARCENTRA_ACCEPTANCE_EXPECTED_OUTPUT", buildContract.stdout],
  ])
    assert.equal(required(key), expected, `${key} must match the v1 fixture`);
  assert.match(required("ARCENTRA_ACCEPTANCE_COMMIT"), fullCommit);
  assert.equal(
    env.ARCENTRA_ACCEPTANCE_BRANCH || "main",
    "main",
    "The v1 fixture advances only its synthetic main branch",
  );
  const coordinationDir = required("ARCENTRA_ACCEPTANCE_COORDINATION_DIR");
  assert.ok(
    isAbsolute(coordinationDir) &&
      resolve(coordinationDir) === coordinationDir &&
      coordinationDir !== parse(coordinationDir).root &&
      !/[\u0000-\u001f]/.test(coordinationDir),
    "Coordination directory must be an absolute private fixture directory",
  );
  const evidenceDir = resolve(
    env.UI_TEST_OUTPUT_DIR ||
      env.ARCENTRA_ACCEPTANCE_EVIDENCE_DIR ||
      "test-results/actual-backend",
  );
  const relativePath = relative(evidenceDir, coordinationDir);
  assert.ok(
    isAbsolute(relativePath) ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`),
    "Coordination files must remain outside browser evidence",
  );
  return {
    artifactMode: mode,
    manifestName: buildContract.manifestName,
    coordinationDir,
  };
}

/** Compare bytes from browser downloads against independently pinned facts. */
export function verifyBuildDownloads(
  manifestBytes,
  binaryBytes,
  expectedCommit,
) {
  assert.match(
    expectedCommit,
    fullCommit,
    "Expected source must be a full SHA",
  );
  assert.ok(Buffer.isBuffer(manifestBytes) && manifestBytes.length <= 16_384);
  const manifest = parseContractJSON(
    new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
  );
  exactKeys(
    manifest,
    ["schemaVersion", "sourceCommit", "goVersion", "binary", "behavior"],
    "Manifest",
  );
  assert.equal(manifest.schemaVersion, 1, "Manifest schema version");
  assert.match(
    manifest.sourceCommit,
    fullCommit,
    "Manifest source must be a full SHA",
  );
  assert.equal(
    manifest.sourceCommit,
    expectedCommit,
    "Independent checkout commit",
  );
  assert.equal(
    manifest.goVersion,
    buildContract.goVersion,
    "Pinned Go toolchain",
  );
  exactKeys(
    manifest.binary,
    ["name", "sizeBytes", "sha256"],
    "Binary manifest",
  );
  assert.equal(manifest.binary.name, buildContract.artifactName);
  assert.ok(
    Number.isSafeInteger(manifest.binary.sizeBytes) &&
      manifest.binary.sizeBytes > 0,
  );
  assert.match(manifest.binary.sha256, /^[a-f0-9]{64}$/);
  assert.ok(
    Buffer.isBuffer(binaryBytes) &&
      binaryBytes.length >= 64 &&
      binaryBytes.length <= 64 * 1024 * 1024,
    "A bounded nonempty executable must be downloaded",
  );
  assert.deepEqual(
    binaryBytes.subarray(0, 4),
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    "The Linux fixture artifact must be an ELF binary",
  );
  assert.equal(
    manifest.binary.sizeBytes,
    binaryBytes.length,
    "Downloaded binary byte length",
  );
  assert.equal(
    manifest.binary.sha256,
    sha256(binaryBytes),
    "Downloaded binary SHA-256",
  );
  exactKeys(
    manifest.behavior,
    ["args", "stdout", "stdoutSha256"],
    "Behavior manifest",
  );
  assert.deepEqual(manifest.behavior.args, ["arcentra"]);
  assert.equal(
    manifest.behavior.stdout,
    buildContract.stdout,
    "Independent expected program output",
  );
  assert.equal(
    manifest.behavior.stdoutSha256,
    sha256(Buffer.from(buildContract.stdout)),
    "Independent expected output SHA-256",
  );
  return manifest;
}

async function privateDirectory(path) {
  const stat = await lstat(path);
  assert.ok(
    stat.isDirectory() && !stat.isSymbolicLink(),
    "Coordination path must be a real directory",
  );
  assert.equal(stat.mode & 0o077, 0, "Coordination directory must be private");
}

export async function writeBuildReceipt(config, name, details) {
  assert.ok(["failed-run.json", "successful-run.json"].includes(name));
  exactKeys(
    details,
    ["projectId", "pipelineId", "runId", "sourceCommit"],
    "Run receipt",
  );
  for (const key of ["projectId", "pipelineId", "runId"])
    assert.match(
      details[key],
      /^[A-Za-z0-9_-]{1,64}$/,
      "Receipt IDs must be bounded safe fixture identifiers",
    );
  assert.match(details.sourceCommit, fullCommit);
  await privateDirectory(config.coordinationDir);
  const temporary = join(config.coordinationDir, `${name}.browser-tmp`);
  await writeFile(
    temporary,
    `${JSON.stringify({ schemaVersion: 1, ...details })}\n`,
    { flag: "wx", mode: 0o600 },
  );
  await rename(temporary, join(config.coordinationDir, name));
}

export function fixedSourceCommit(receipt, initialCommit) {
  assert.match(initialCommit, fullCommit, "Initial source must be a full SHA");
  exactKeys(receipt, ["schemaVersion", "sourceCommit"], "Fixed source receipt");
  assert.equal(receipt.schemaVersion, 1);
  assert.match(receipt.sourceCommit, fullCommit);
  assert.notEqual(
    receipt.sourceCommit,
    initialCommit,
    "A successful build requires a NEW fixed source commit",
  );
  return receipt.sourceCommit;
}

export async function waitForFixedSource(config, { timeoutMs = 120_000 } = {}) {
  await privateDirectory(config.coordinationDir);
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const file = await open(
        join(config.coordinationDir, "fixed-source.json"),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await file.stat();
        assert.ok(
          stat.isFile() &&
            stat.nlink === 1 &&
            stat.size > 0 &&
            stat.size <= 4096,
          "Fixed source receipt must be a bounded single-link regular file",
        );
        assert.equal(
          stat.mode & 0o777,
          0o600,
          "Fixed source receipt must be private and non-executable",
        );
        const bytes = Buffer.alloc(4097);
        const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
        assert.ok(
          bytesRead <= 4096 && bytesRead === stat.size,
          "Fixed source receipt must not change while reading",
        );
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(0, bytesRead),
        );
        return fixedSourceCommit(
          parseContractJSON(text),
          config.expectedCommit,
        );
      } finally {
        await file.close();
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    assert.ok(
      Date.now() < deadline,
      "Timed out waiting for the independently verified source fix",
    );
    await delay(Math.min(250, Math.max(1, deadline - Date.now())));
  }
}

export async function saveBuildDownloads(
  config,
  manifestBytes,
  binaryBytes,
  expectedCommit,
) {
  verifyBuildDownloads(manifestBytes, binaryBytes, expectedCommit);
  await privateDirectory(config.coordinationDir);
  const directory = join(config.coordinationDir, "downloads");
  await mkdir(directory, { mode: 0o700 });
  for (const [name, bytes] of [
    [buildContract.manifestName, manifestBytes],
    [buildContract.artifactName, binaryBytes],
  ])
    await writeFile(join(directory, name), bytes, { flag: "wx", mode: 0o600 });
}
