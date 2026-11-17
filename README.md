# Tempo Core Components

The presentation boundary for Tempo 2. This initial package is a dependency-free
ES module with TypeScript declarations. No frontend framework is selected.

## Public interface

| Export | Responsibility |
| --- | --- |
| `validateStudyView(value)` | Validate external wire version 1 data and return an immutable copy. Missing, malformed, unknown and extra fields are rejected. |
| `renderStudy(view, state?)` | Return escaped HTML from a validated view; no event handlers or network access. |
| `createStudyController({ transport, render, makeSubmissionId })` | Translate user intent into commands using the current server-issued IDs and revision. |

## Read by concept

[src/index.js](src/index.js) and [src/index.d.ts](src/index.d.ts) are small public
export lists. Definitions and usage scenarios live in the named modules below.
Every scenario imports through the public barrel, so examples also check that
consumers can keep using the package's existing imports.

| Question | Implementation / declarations | Executable usage beside it |
| --- | --- | --- |
| Can I trust this transport reply? | [validate_study_view.js](src/validate_study_view.js) / [declarations](src/validate_study_view.d.ts) | [validate_study_view.scenarios.js](src/validate_study_view.scenarios.js): immutable copies, supported versions, missing/extra fields and leaked solution rejection. |
| How do I display this state? | [render_study.js](src/render_study.js) / [declarations](src/render_study.d.ts) | [render_study.scenarios.js](src/render_study.scenarios.js): escaping, available controls and disabled new intents during recovery. |
| How do I send an answer safely? | [study_controller.js](src/study_controller.js) / [declarations](src/study_controller.d.ts) | [study_controller.scenarios.js](src/study_controller.scenarios.js): revision propagation, abandonment, concurrent clicks, retryable errors and lost replies. |
| Which fields belong in a view? | [study_view.d.ts](src/study_view.d.ts) | Validator and renderer scenarios show ready, finished, empty and error variants. |
| Which fields belong in an intent? | [study_command.d.ts](src/study_command.d.ts) | Controller scenarios assert the exact commands sent by a caller. |

[wire_values.js](src/wire_values.js) holds only the internal string/freeze helpers
shared by validation and command construction. [view_fixtures.js](src/view_fixtures.js)
contains wire-only examples used by tests, and is not imported by production
modules. Public consumers continue importing from the package root.

The controller exposes `next()`, `resume(attemptId)`, `answer(uci)`, `abandon()`,
`retry()` and `getState()`. Its `transport.send(command)` returns a promise of an
external view. Its render callback receives `(view, { busy, canRetry })` and may
pass those arguments to `renderStudy`. The application supplies a fresh, stable
submission ID for each new answer or abandonment; retry reuses the original.

All async action methods resolve to the returned view. An action suppressed
because another is busy resolves to `null`. Transport failures and malformed
replies reject their promise; the unresolved command remains available for
`retry()`. A retryable application error also retains that command. New intents
are refused until an unresolved command is recovered. A non-retryable error
clears the command so the caller can resume or request another exercise.

An attempt view carries its content/dataset identity, response revision, prompt,
feedback and optional assessment. Ready views require a prompt; complete and
abandoned views have no prompt. Empty and error are separate variants. The
complete wire types are in [src/index.d.ts](src/index.d.ts). IDs are nonempty
strings; decision indexes start at zero. No solution is included in the view.

## Follow one answer through the modules

1. A host event handler calls `controller.answer("e2e4")` while the view is ready.
2. The controller copies the server's dataset/attempt IDs and current attempt
   revision, allocates one submission ID, and freezes the command.
3. The injected transport sends that intent and returns unknown external data.
4. The validator accepts only the version 1 view shape and returns an immutable copy.
5. The controller passes that view and its busy/recovery state to the host's render
   callback. The callback may use `renderStudy` to get escaped HTML.

If the reply is lost, retry sends the exact same frozen command. It does not
allocate a new submission ID or guess whether the answer was accepted. The server
can recover its committed reply from the original identity.

This runtime request/response loop introduces no package import from the UI into
Study, Queue, Learning, Chess or Store. Domain decisions stay behind the transport.

## What is real and what is deferred

The versioned view validation, HTML escaping, intent construction, response
revision propagation, busy guard and reuse of unresolved submission IDs are
implemented. The UI has no answer key, grader, eligibility policy, scheduler,
persistence or provider access. A failed tactic may remain ready for corrective
input while displaying the application's `again` assessment; the UI does not
change it to `good`.

The renderer shows a FEN placeholder instead of a graphical board. Styling,
interactive board graphics, browser event binding and a production network
transport are future adapters. Consumers attach events through the
`data-action` attributes and inject their transport; no HTTP endpoint is assumed.

## Validation

From this package directory, use Node 18 or newer. No installed dependencies are
needed. The `.scenarios.js` suffix keeps default discovery from running each file
twice: [test/study.test.js](test/study.test.js) remains the established aggregator.

```sh
# Run the usage scenarios for just the concept being read.
node --test src/validate_study_view.scenarios.js
node --test src/render_study.scenarios.js
node --test src/study_controller.scenarios.js

# Run all ten existing public-boundary scenarios through their stable entry point.
npm test

# One runnable presentation example, with no server or framework needed.
node --input-type=module -e 'import { renderStudy } from "./src/index.js"; console.log(renderStudy(null));'
```

For the actual Rust boundary, run `cargo build -p tempo` and then
`node --test tempo/tests/ui_boundary.mjs` from the parent workspace. That suite
uses these same public exports and a live stdio application process, including a
reply lost after commit. Local fake transports demonstrate usage; those retained
integration journeys check that the two packages still agree on the wire values.
