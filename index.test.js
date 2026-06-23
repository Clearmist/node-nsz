import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as nsz from './index.js';
import { unlink } from 'node:fs/promises';

const TEST_FILE = path.join(process.cwd(), 'test.nsp');
const hasTestFile = fs.existsSync(TEST_FILE);

// Most operations need real Switch encryption keys to decrypt the container.
// Assume there is a keys file in the repo root for testing purposes then
// point nsz to that file via --keys instead of relying on nsz's default search paths.
const KEYS_FILE = [path.join(process.cwd(), 'prod.keys'), path.join(process.cwd(), 'keys.txt')].find(
  (p) => fs.existsSync(p)
);
const keysOptions = KEYS_FILE ? { keys: KEYS_FILE } : {};

// Probe once up front so we can skip with a clear reason instead of failing
// every test the same way when keys aren't set up.
let hasKeys = false;
let keysCheckError;
if (hasTestFile) {
  try {
    await nsz.info(TEST_FILE, keysOptions);
    hasKeys = true;
  } catch (err) {
    keysCheckError = err;
  }
}

describe('binaryPath', () => {
  it('resolves to an existing executable for this platform', () => {
    const resolved = nsz.binaryPath();
    expect(fs.existsSync(resolved)).toBe(true);
  });
});

describe('output validation', () => {
  it('throws when the binary produces a non-JSON line', async () => {
    // No keys configured / a non-existent file reliably drives nsz down its
    // plain-text error path even in --machine-readable mode, which is exactly
    // what should be rejected by our JSON validation.
    await expect(nsz.info(path.join(os.tmpdir(), '__node-nsz-missing__.nsp'))).rejects.toThrow(
      /invalid JSON output/
    );
  });
});

describe.skipIf(!hasTestFile || !hasKeys)('API endpoints (using test.nsp)', () => {
  let workDir;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-nsz-test-'));
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('info reports metadata about the file', async () => {
    const result = await nsz.info(TEST_FILE, { ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
    expect(result.json.length).toBeGreaterThan(0);
  });

  it('verify checks file integrity', async () => {
    const result = await nsz.verify(TEST_FILE, { quick: true, ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
  });

  it('titlekeys extracts title keys from the file', async () => {
    const result = await nsz.titlekeys(TEST_FILE, { ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
    unlink('titlekeys.txt');
  });

  it('compress produces an NSZ file and streams progress lines', async () => {
    // Solid mode (nsz's default) hits an upstream bug where its own progress
    // reporting isn't JSON-serializable under --machine-readable. Block mode
    // avoids that code path entirely.
    const lines = [];
    const result = await nsz.compress(TEST_FILE, {
      output: workDir,
      overwrite: true,
      block: true,
      onLine: (line) => lines.push(line),
      ...keysOptions,
    });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);

    // Every line onLine saw should reconstruct the buffered stdout, and there
    // should be more than one of them since nsz reports progress per-step.
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('\n')).toBe(result.stdout.replace(/\n$/, ''));

    const compressed = fs.readdirSync(workDir).find((f) => f.endsWith('.nsz'));
    expect(compressed).toBeDefined();
  }, 120_000);

  it('decompress restores the file compressed above and streams progress lines', async () => {
    const compressed = fs.readdirSync(workDir).find((f) => f.endsWith('.nsz'));
    expect(compressed).toBeDefined();

    const lines = [];
    const result = await nsz.decompress(path.join(workDir, compressed), {
      output: workDir,
      overwrite: true,
      onLine: (line) => lines.push(line),
      ...keysOptions,
    });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('\n')).toBe(result.stdout.replace(/\n$/, ''));
  }, 120_000);

  it('extract pulls files out of the container', async () => {
    const extractDir = path.join(workDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    const result = await nsz.extract(TEST_FILE, { output: extractDir, ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
  }, 120_000);

  it('create repacks the extracted files into a new NSP', async () => {
    const extractDir = path.join(workDir, 'extracted');
    // nsz extracts into a subdirectory named after the source file, e.g.
    // extracting "test.nsp" produces "<extractDir>/test/".
    const extractedSubdir = fs
      .readdirSync(extractDir)
      .map((name) => path.join(extractDir, name))
      .find((p) => fs.statSync(p).isDirectory());
    expect(extractedSubdir).toBeDefined();

    const repacked = path.join(workDir, 'repacked.nsp');

    const result = await nsz.create(repacked, extractedSubdir, { ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
  }, 120_000);

  it('undupe dry-run reports duplicates without deleting anything', async () => {
    const result = await nsz.undupe(workDir, { dryRun: true, ...keysOptions });
    expect(result.code).toBe(0);
    expect(Array.isArray(result.json)).toBe(true);
  });
});

if (!hasTestFile) {
  describe('API endpoints', () => {
    it.skip(`skipped: place a "test.nsp" file in the repo root to run the full endpoint suite (looked for ${TEST_FILE})`, () => {});
  });
} else if (!hasKeys) {
  describe('API endpoints', () => {
    it.skip(
      `skipped: nsz could not load Switch encryption keys (prod.keys/keys.txt) needed to read test.nsp: ${keysCheckError?.message}`,
      () => {}
    );
  });
}
