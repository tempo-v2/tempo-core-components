# Standalone Core consumer

This example uses the public package, stylesheet, and piece asset exports.
It serves a caller-supplied board and dialog without a Tempo app or database.

To run it by hand, build and pack Core with `npm run build` and `npm pack`.
Copy this directory outside the Tempo repositories. From the copy, run
`npm install /path/to/tempo-v2-core-components-0.2.2.tgz` and `npm run build`,
then serve the generated `public/` directory over HTTP.

To run the browser contract from the Core checkout after building, use an
installed Playwright module and Chrome:

```sh
TEMPO_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs npm test
```

The test packs Core, installs the tarball in a temporary standalone consumer,
and runs real Chrome interactions. It checks caller identities and revisions,
equivalent destinations during a drag, input cancellation, locked and read-only
movement, restoration, promotion preview, a public asset, and dialog focus.
Set `TEMPO_NPM_OFFLINE=1` when the npm dependencies are already cached.
Without `TEMPO_PLAYWRIGHT`, the export smoke test runs and the browser case is
reported as skipped.
