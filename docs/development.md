# Development

[Back to README](../README.md) | [Contributing](../CONTRIBUTING.md)

The TV/browser runtime must remain **ES5-compatible** for Tizen 3.0.
There is no transpilation or bundling step: the widget runs the HTML, CSS,
and JavaScript in `MovieDeck` directly.

## Local preview

Use Windows PowerShell 5.1 or PowerShell 7 with Python available as `python`.
Run commands from the repository root:

```powershell
.\tools\Start-RawiPreview.ps1
```

The helper serves `MovieDeck` at `http://127.0.0.1:4173/` and opens Edge in a
1920x1080 window when available. Otherwise, open the URL manually. Edit files
and refresh; no widget rebuild is needed for browser layout work.

```powershell
# Stop the default preview.
.\tools\Start-RawiPreview.ps1 -Stop

# Use a different port, without opening a browser.
.\tools\Start-RawiPreview.ps1 -Port 4176 -StorybookMock -NoBrowser
.\tools\Start-RawiPreview.ps1 -Port 4176 -Stop
```

`-NoBrowser` suppresses the browser launch, not the server. Preview ownership
is tied to the `MovieDeck` path and port, so one checkout should not stop or
reuse another checkout's server.

### Browser limitations

- Playback uses HTML video rather than Samsung AVPlay.
- Samsung remote-key registration and application exit APIs are unavailable.
- Browser and TV storage are separate; authorize Quick Connect independently.
- Codec support differs. Validate navigation, overscan, performance, and
  playback on physical TV hardware before relying on browser results.

For connection problems, see [usage troubleshooting](usage.md#troubleshooting).

## Automated checks

Install Node.js 22.13 or newer; an LTS release is recommended:

```powershell
npm ci
npm run lint
npm test
```

`lint` parses first-party browser scripts as ES5 using Acorn. It does not check
style or vendored GSAP. Development dependencies are not packaged in the widget.

The full suite needs Windows, Python, and at least one PowerShell host. It
exercises both Windows PowerShell 5.1 and PowerShell 7 when available, using
fixtures and an isolated fake Tizen SDK rather than a live server, TV, or
signing certificate. CI covers Node.js 22, 24, and 26 on Windows.

To run selected test files:

```powershell
node .\MovieDeck\tests\run-tests.js api.test.js storybook-app.test.js
```

## Storybook preview routes

These routes use local fixtures without authenticating or contacting a saved
Jellyfin server. The browser Network tab should show no requests to the
configured Jellyfin origin.

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen library -StorybookLibraryId songs
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen category -StorybookCategoryKey animals
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen details -StorybookItemId bluey
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen magic
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen settings
.\tools\Start-RawiPreview.ps1 -StorybookMock -StorybookScreen ending -StorybookItemId bluey
```

## Browser checks

With the mock preview running, use an installed `agent-browser` CLI to execute
the integration checks. For example:

```powershell
agent-browser --session rawi-artwork --headed false open 'http://127.0.0.1:4173/?preview=storybook'
agent-browser --session rawi-artwork set viewport 1920 1080
$script = Get-Content -Raw .\tools\Test-StorybookArtwork.js
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
agent-browser --session rawi-artwork eval -b $encoded
agent-browser --session rawi-artwork close
```

Each check replaces preview content; start from a fresh page or reload afterward.
Use the same evaluation pattern with these scripts:

| Script under `tools` | Coverage |
|---|---|
| `Test-StorybookArtwork.js` | Six artwork surfaces, proportions, and missing/broken-image fallbacks |
| `Test-SmartSearch.js` | Both modes, partial matches, 105 fixture results, paging, details-return focus, and adult-title exclusion |
| `Test-StorybookFireflies.js` | Visible effects, fade-out, focus cleanup, non-interception, and reduced motion |
| `Test-StorybookMicrointeractions.js` | Moon blink/doze/wake, letter effects, rapid edits, and unchanged Adult search |

For system reduced-motion checks, run the following against the active
browser session before evaluating the relevant script:

```powershell
agent-browser --session rawi-artwork set media reduced-motion
```

## Generated assets

Rebuild the four packaged Storybook cues:

```powershell
node .\tools\Generate-StorybookSounds.js --output .\MovieDeck\audio
```

With the same Node build, generation is byte-identical. An unchanged Git diff
confirms that the packaged WAV files still match their generator.

Rebuild the icon:

```powershell
.\tools\New-RawiIcon.ps1
```

The icon generator uses `System.Drawing` and the installed Bahnschrift font.
Keep experiments separate from the packaged icon:

```powershell
.\tools\New-RawiIcon.ps1 -OutputPath '.\dist\icon-preview.png'
```

## Code map

| Path | Purpose |
|---|---|
| `MovieDeck\index.html`, `css\` | Screens, 1920x1080 layout, and styling |
| `MovieDeck\config.xml` | Tizen identity, version, and privileges |
| `MovieDeck\js\app.js`, `animations.js` | UI state, remote navigation, and motion |
| `MovieDeck\js\api.js`, `player.js`, `storage.js` | Jellyfin, AVPlay/browser playback, and persistence |
| `MovieDeck\js\copy.js`, `config\copy-overrides.example.js` | Default and customizable interface text |
| `MovieDeck\js\preview-fixtures.js` | Deterministic preview data |
| `MovieDeck\js\storybook-*.js` | Catalogue, discovery, filtering, preferences, sound, and rendering |
| `MovieDeck\js\vendor\gsap.min.js` | Bundled animation library with separate license terms |
| `MovieDeck\tests\` | Node-based regression suite |
| `tools\` | Preview, deployment, asset generation, and check helpers |
| `dist\` | Generated signed widgets; ignored by Git |

Keep TV-only API access feature-detected. Prefer transforms to repeated
layout-triggering scroll changes, test at 1920x1080, and leave overscan margins.
Preserve the [package identity](tv-setup.md#keep-upgrades-compatible) for updates.
Historical design notes remain under `docs\superpowers`.

## Jellyfin integration

The API client in `MovieDeck\js\api.js` uses:

| Purpose | Endpoint |
|---|---|
| Discovery | `/System/Info/Public` |
| Quick Connect | `/QuickConnect/Initiate`, `/QuickConnect/Connect`, `/Users/AuthenticateWithQuickConnect` |
| Continue Watching / Recently Added | `/Users/{userId}/Items/Resume`, `/Users/{userId}/Items/Latest` |
| Libraries and recursive content | `/Users/{userId}/Views`, `/Users/{userId}/Items` |
| Playback negotiation | `/Items/{itemId}/PlaybackInfo` |
| Progress reporting | `/Sessions/Playing*` |

The MU8000 device profile advertises MP4, M4V, MKV, MPEG-TS, MOV, and AVI;
H.264, HEVC, MPEG-4, MPEG-2, and VC-1 video; and AAC, AC-3, E-AC-3, MP3, and DTS
audio. HLS with H.264 and AC-3 or AAC is the transcoding fallback. No subtitle
profiles are advertised.

Profile changes need checks against both Jellyfin's selected media source
and Samsung AVPlay. See [TV setup](tv-setup.md) for signing and deployment,
and [CONTRIBUTING](../CONTRIBUTING.md#maintainer-release-guidance) for releases.
