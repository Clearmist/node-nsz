import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import * as nsz from './index.js';

// The path to your testing application.
const TEST_FILE = path.join(process.cwd(), 'test.nsp');

// Find an available keys file.
const KEYS_FILE = [
  path.join(process.cwd(), 'prod.keys'),
  path.join(process.cwd(), 'keys.txt')
].find(
  (p) => fs.existsSync(p)
);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-nsz-test-'));

// Provide a callback to `onLine` to get instant updates as lines are printed to stdout
// or capture the entire output into `const result` after the operation is completed.
const result = await nsz.compress(TEST_FILE, {
  output: workDir,
  overwrite: true,
  block: true,
  ...(KEYS_FILE ? { keys: KEYS_FILE } : {}),
  onLine: (line) => console.log(JSON.parse(line)),
  onStderr: (chunk) => console.error('stderr:', chunk.toString()),
});
