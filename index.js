import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREBUILDS_DIR = path.join(__dirname, 'prebuilds');

export function binaryPath() {
  const platformArch = `${process.platform}-${process.arch}`;
  const binaryName = process.platform === 'win32' ? 'nsz.exe' : 'nsz';
  const candidate = path.join(PREBUILDS_DIR, platformArch, binaryName);

  if (!fs.existsSync(candidate)) {
    const available = fs.existsSync(PREBUILDS_DIR) ? fs.readdirSync(PREBUILDS_DIR) : [];

    throw new Error(
      `No nsz prebuild found for platform "${platformArch}". ` +
      `Available prebuilds: ${available.join(', ') || 'none'}`
    );
  }

  return candidate;
}

function toArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function withMachineReadable(args) {
  return args.includes('--machine-readable') ? args : [...args, '--machine-readable'];
}

// The binary emits one JSON object per line (NDJSON).
// Any non-JSON line is treated as invalid output.
function parseMachineReadableOutput(stdout) {
  const lines = stdout.split('\n').filter((line) => line.trim().length > 0);

  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`nsz produced invalid JSON output: ${line}`);
    }
  });
}

// Maps the shared compression/verification/output options documented in
// deps/docs/usage.md to their CLI flags.
function buildCommonArgs(options = {}) {
  const args = [];

  if (options.level !== undefined) args.push('-l', String(options.level));
  if (options.long) args.push('-L');
  if (options.block) args.push('-B');
  if (options.solid) args.push('-S');
  if (options.bs !== undefined) args.push('-s', String(options.bs));
  if (options.verify) args.push('-V');
  if (options.quickVerify) args.push('-Q');
  if (options.keep) args.push('-K');
  if (options.fixPadding) args.push('-F');
  if (options.alwaysParseCnmt) args.push('-P');
  if (options.threads !== undefined) args.push('-t', String(options.threads));
  if (options.multi !== undefined) args.push('-m', String(options.multi));
  if (options.output !== undefined) args.push('-o', options.output);
  if (options.overwrite) args.push('-w');
  if (options.rmOldVersion) args.push('-r');
  if (options.rmSource) args.push('--rm-source');
  if (options.depth !== undefined) args.push('--depth', String(options.depth));
  if (options.minimalOutput) args.push('--minimal-output');
  if (options.keys !== undefined) args.push('--keys', options.keys);

  return args;
}

export function spawnNsz(args, spawnOptions = {}) {
  return spawn(binaryPath(), withMachineReadable(args), spawnOptions);
}

// Runs the binary to completion, buffering stdout/stderr, and parses stdout
// as newline-delimited JSON. Throws if any line of output is not valid JSON.
// Rejects on a non-zero exit code unless options.allowFailure is set.
export function runNsz(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnNsz(args, options.spawnOptions);

    let stdout = '';
    let stderr = '';
    let pendingLine = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;

      if (options.onStdout) {
        options.onStdout(chunk);
      }

      if (options.onLine) {
        pendingLine += chunk;

        const lines = pendingLine.split('\n');

        pendingLine = lines.pop();

        for (const line of lines) {
          options.onLine(line);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (options.onStderr) options.onStderr(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (options.onLine && pendingLine.length > 0) {
        options.onLine(pendingLine);
      }

      let json;

      try {
        json = parseMachineReadableOutput(stdout);
      } catch (err) {
        Object.assign(err, { code, stdout, stderr });
        reject(err);
        return;
      }

      const result = { code, stdout, stderr, json };

      if (code !== 0 && !options.allowFailure) {
        reject(Object.assign(new Error(`nsz exited with code ${code}`), result));
      } else {
        resolve(result);
      }
    });
  });
}

export function compress(files, options = {}) {
  return runNsz(['-C', ...buildCommonArgs(options), ...toArray(files)], options);
}

export function decompress(files, options = {}) {
  return runNsz(['-D', ...buildCommonArgs(options), ...toArray(files)], options);
}

export function verify(files, options = {}) {
  const mode = options.quick ? '-Q' : '-V';

  return runNsz([mode, ...buildCommonArgs(options), ...toArray(files)], options);
}

export function extract(files, options = {}) {
  const args = ['-x'];

  if (options.extractRegex !== undefined) {
    args.push('--extractregex', options.extractRegex);
  }

  args.push(...buildCommonArgs(options), ...toArray(files));

  return runNsz(args, options);
}

export function create(output, input, options = {}) {
  return runNsz(['-c', output, ...buildCommonArgs(options), ...toArray(input)], options);
}

export function info(files, options = {}) {
  return runNsz(['-i', ...buildCommonArgs(options), ...toArray(files)], options);
}

export function titlekeys(files, options = {}) {
  return runNsz(['--titlekeys', ...buildCommonArgs(options), ...toArray(files)], options);
}

export function undupe(files, options = {}) {
  const args = ['--undupe'];

  if (options.dryRun) args.push('--undupe-dryrun');
  if (options.rename) args.push('--undupe-rename');
  if (options.hardlink) args.push('--undupe-hardlink');
  if (options.oldVersions) args.push('--undupe-old-versions');
  if (options.priorityList !== undefined) args.push('--undupe-prioritylist', options.priorityList);
  if (options.whitelist !== undefined) args.push('--undupe-whitelist', options.whitelist);
  if (options.blacklist !== undefined) args.push('--undupe-blacklist', options.blacklist);

  args.push(...buildCommonArgs(options), ...toArray(files));

  return runNsz(args, options);
}
