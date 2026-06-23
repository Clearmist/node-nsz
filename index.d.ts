import type { ChildProcess, SpawnOptionsWithoutStdio } from 'node:child_process';

export interface CommonOptions {
  level?: number;
  long?: boolean;
  block?: boolean;
  solid?: boolean;
  bs?: number;
  verify?: boolean;
  quickVerify?: boolean;
  keep?: boolean;
  fixPadding?: boolean;
  alwaysParseCnmt?: boolean;
  threads?: number;
  multi?: number;
  output?: string;
  overwrite?: boolean;
  rmOldVersion?: boolean;
  rmSource?: boolean;
  depth?: number;
  minimalOutput?: boolean;
  keys?: string;
}

export interface RunOptions extends CommonOptions {
  spawnOptions?: SpawnOptionsWithoutStdio;
  allowFailure?: boolean;
  onStdout?: (chunk: Buffer | string) => void;
  onStderr?: (chunk: Buffer | string) => void;
  onLine?: (line: string) => void;
}

export interface VerifyOptions extends RunOptions {
  quick?: boolean;
}

export interface ExtractOptions extends RunOptions {
  extractRegex?: string;
}

export interface UndupeOptions extends RunOptions {
  dryRun?: boolean;
  rename?: boolean;
  hardlink?: boolean;
  oldVersions?: boolean;
  priorityList?: string;
  whitelist?: string;
  blacklist?: string;
}

export interface NszResult {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown[];
}

export function binaryPath(): string;

export function spawnNsz(args: string[], spawnOptions?: SpawnOptionsWithoutStdio): ChildProcess;

export function runNsz(args: string[], options?: RunOptions): Promise<NszResult>;

export function compress(files: string | string[], options?: RunOptions): Promise<NszResult>;

export function decompress(files: string | string[], options?: RunOptions): Promise<NszResult>;

export function verify(files: string | string[], options?: VerifyOptions): Promise<NszResult>;

export function extract(files: string | string[], options?: ExtractOptions): Promise<NszResult>;

export function create(
  output: string,
  input: string | string[],
  options?: RunOptions
): Promise<NszResult>;

export function info(files: string | string[], options?: RunOptions): Promise<NszResult>;

export function titlekeys(files: string | string[], options?: RunOptions): Promise<NszResult>;

export function undupe(files: string | string[], options?: UndupeOptions): Promise<NszResult>;
