# node-nsz

node-nsz is a Node-API (NAPI) wrapper around the [NSZ][nsz] application.

## Installation

`npm install node-nsz`

## Prebuilds

- darwin-arm64
- linux-arm64
- linux-x64
- win32-arm64
- win32-x64

## Usage

All functions return a Promise that resolves to `{ code, stdout, stderr, json }`,
where `json` is the array of NDJSON objects the nsz binary printed in `--machine-readable` mode.

```js
import { compress } from 'node-nsz';

const result = await compress('game.nsp', {
  output: './out',
  overwrite: true,
  keys: './prod.keys',
});

console.log(result.json);
```

### Streaming progress

The nsz binary reports progress as one JSON object per line on stdout. Pass a callback to
`onLine` to receive each line as soon as it's emitted instead of waiting for the whole run to finish:

```js
import { compress } from 'node-nsz';

await compress('game.nsp', {
  output: './out',
  overwrite: true,
  keys: './prod.keys',
  onLine: (line) => {
    const event = JSON.parse(line);

    if (event.type === 'progress') {
      console.log(`${event.file}: ${event.percent}%`);
    }
  },
});
```

`onStdout`/`onStderr` are also available if you need the raw, unsplit chunks
as they arrive.

### API

- `compress(files, options)` / `decompress(files, options)`
- `verify(files, options)` — pass `quick: true` for a faster check
- `extract(files, options)` — pass `extractRegex` to filter extracted files
- `create(output, input, options)`
- `info(files, options)`
- `titlekeys(files, options)`
- `undupe(files, options)` — pass `dryRun: true` to preview without deleting
- `binaryPath()` — resolves the path to the platform-specific nsz binary
- `spawnNsz(args, spawnOptions)` / `runNsz(args, options)` — lower-level
  escape hatches for running the binary directly

`options` (`CommonOptions`) maps to the shared nsz flags: `level`, `long`,
`block`, `solid`, `bs`, `verify`, `quickVerify`, `keep`, `fixPadding`,
`alwaysParseCnmt`, `threads`, `multi`, `output`, `overwrite`, `rmOldVersion`,
`rmSource`, `depth`, `minimalOutput`, and `keys`. It also accepts
`spawnOptions`, `allowFailure`, `onStdout`, `onStderr`, and `onLine`. See
[index.d.ts](index.d.ts) for the full type definitions.

[nsz]: https://github.com/nicoboss/nsz