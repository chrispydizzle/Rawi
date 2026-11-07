# Contributing to Rawi

Bug reports, fixes, and improvements are welcome. Be respectful, assume good
intent, and keep feedback about the work rather than the person. Harassment
and sharing someone else's private information are not acceptable.

## Development setup

Follow the [README quick start](README.md#quick-start) for a mock browser
preview. For the full checks, use Windows with Node.js 22.13 or newer, Python
on PATH, and Windows PowerShell 5.1 or PowerShell 7:

```powershell
npm ci
npm run lint
npm test
```

The tests do not require a live Jellyfin server, TV, or signing certificate.
The preview helper's process-ownership tests are Windows-specific. CI runs
the suite on Node.js 22, 24, and 26 and exercises both PowerShell hosts.

Run a focused subset by passing filenames to the existing test runner:

```powershell
node .\MovieDeck\tests\run-tests.js api.test.js storybook-app.test.js
```

Browser checks in `tools\Test-*.js` are optional integration checks; see the
[development guide](docs/development.md#browser-checks) for the mock-preview workflow.

## Changes and pull requests

Keep changes focused and add regression tests for changed behavior. Explain
what changed, how to reproduce a bug, and which checks you ran. For TV issues,
include the TV model, firmware/Tizen version, Jellyfin version, and whether
the issue reproduces in the browser. Do not include session tokens, Quick
Connect secrets, signing material, or private media in reports.

- Keep `MovieDeck\js\` code ES5-compatible; do not introduce module imports,
  arrow functions, `let`, or `const` into the TV runtime.
- Feature-detect TV APIs so the browser preview remains usable.
- Put user-facing text in `MovieDeck\js\copy.js`; keep personal overrides in
  the ignored `MovieDeck\config\copy-overrides.js`.
- Keep TV deployment settings in the ignored `rawi.local.json`, not script
  defaults. See [local configuration](docs/tv-setup.md#local-configuration).
- Preserve `JfMovieTV1.MovieDeck`, package ID `JfMovieTV1`, and `moviedeck.*`
  storage keys unless intentionally migrating installed users.
- Follow `.editorconfig` and neighboring code. Avoid unrelated reformatting.
- Do not commit generated widgets, signatures, certificates, local tooling
  state, or `node_modules`.

Use the deterministic sound and icon generators for asset changes and keep
their outputs with the source changes. Do not substitute copyrighted media
for the synthetic preview fixtures.

The `lint` command enforces ES5 syntax in first-party runtime scripts using
Acorn; it does not check style or the vendored GSAP file. When updating that library,
review its license and retain its notice. Dependabot handles npm development
dependencies and pinned GitHub Actions, not the vendored library.

Contributions to original project files are accepted under Apache-2.0.
Third-party code must retain its own license and attribution.

## Maintainer release guidance

Before the initial public launch, review the complete Git history and all
GitHub-hosted material, not just the current checkout. A local history scan
with [Gitleaks](https://github.com/gitleaks/gitleaks) is:

```powershell
git fetch --all --tags
gitleaks git . --log-opts="--all --full-history" --redact
```

A clean scan is not proof that no confidential data exists. If credentials or
confidential material are discovered, stop publication, rotate credentials
as appropriate, and use a reviewed clean repository rather than exposing the
old history. Ignore rules do not remove previously committed material.

At launch, enable private vulnerability reporting, secret scanning and push
protection where available, and Dependabot alerts. Configure a `main` ruleset
to block force pushes and deletion and require pull requests plus the
`Windows / Node 22`, `Windows / Node 24`, and `Windows / Node 26` CI checks
after their first successful run. Do not require approvals from nonexistent
co-maintainers on a solo-maintained project.

For source releases, keep the versions in `MovieDeck\config.xml` and
`MovieDeck\js\api.js` aligned and tag the reviewed commit `vX.Y.Z`. Describe
compatibility changes and known TV limitations in the GitHub release notes.
Signed widgets remain local because each installation needs an appropriate
Samsung certificate and target authorization. Do not upload personal signing
keys to CI or publish a widget containing local copy overrides without
reviewing it.
