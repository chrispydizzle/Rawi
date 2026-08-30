# Rawi

Rawi is a remote-first Jellyfin video browser and player for Samsung Tizen TVs.
It provides a focused 10-foot interface for browsing Jellyfin libraries,
viewing metadata, resuming playback, and playing video through Samsung AVPlay.

The current target is a Samsung UN75MU8000 running the Tizen 3.0 web runtime.
The JavaScript intentionally remains ES5-compatible for older Samsung firmware.

## Features

- Jellyfin Quick Connect authentication.
- Persistent TV sessions using the Tizen Preference API with a `localStorage`
  fallback.
- Continue Watching and Recently Added shelves.
- One shelf per top-level Jellyfin library.
- Recursive video discovery within each library.
- Poster, backdrop, synopsis, year, rating, runtime, and genre metadata.
- Sticky selected-title display while browsing.
- Remote-first spatial navigation.
- GPU-composited vertical shelf scrolling with a small bounce.
- Resume playback or restart from the beginning.
- Direct play when the TV supports the source format.
- HLS transcoding fallback through Jellyfin.
- Playback progress reporting to Jellyfin.
- HTML video fallback for local browser previews.

## Repository layout

```text
Rawi/
|-- MovieDeck/
|   |-- config.xml          Tizen package metadata and privileges
|   |-- index.html          Application screens and UI structure
|   |-- icon.png            Packaged application icon
|   |-- css/
|   |   `-- app.css         1920x1080 TV layout and visual styling
|   `-- js/
|       |-- animations.js   Screen and shelf motion
|       |-- api.js          Jellyfin API, authentication, and persistence
|       |-- app.js          UI state, rendering, and remote navigation
|       |-- player.js       AVPlay and browser playback
|       `-- vendor/
|           `-- gsap.min.js Animation dependency
|-- tools/
|   |-- Deploy-Rawi.ps1     Package, sign, install, and launch
|   |-- New-RawiIcon.ps1    Rebuild the application icon
|   `-- Start-RawiPreview.ps1
|                            Run a local browser preview
`-- dist/                   Generated signed widgets; ignored by Git
```

## Requirements

### Local preview

- Windows PowerShell 5.1 or PowerShell 7.
- Python available as `python`.
- Microsoft Edge is recommended. The preview still starts if Edge is absent,
  but the browser must then be opened manually.

### TV deployment

- Samsung TV with Developer Mode enabled.
- TV and development machine on the same network.
- Tizen Studio installed at `%USERPROFILE%\tizen-studio`.
- Samsung TV extensions installed in Tizen Studio.
- A Samsung certificate profile containing the target TV's DUID.
- Permission to install applications enabled for the TV in Tizen Device
  Manager.

The included deployment defaults expect:

| Setting | Default |
|---|---|
| TV target | `192.168.1.159:26101` |
| Signing profile | `MovieDeck` |
| Application ID | `JfMovieTV1.MovieDeck` |
| Widget name | `Rawi.wgt` |
| Jellyfin server | `http://192.168.1.2:8096` |

The TV target and signing profile can be overridden with script parameters.
The default Jellyfin address is defined in `MovieDeck\js\app.js`.

## Local development

Start the preview server from the repository root:

```powershell
.\tools\Start-RawiPreview.ps1
```

The script serves `MovieDeck\` at:

```text
http://127.0.0.1:4173/
```

It also opens Edge in a 1920x1080 window. Edit HTML, CSS, or JavaScript under
`MovieDeck\`, then refresh the page. A widget rebuild is not required for
browser-only layout work.

Stop the preview server with:

```powershell
.\tools\Start-RawiPreview.ps1 -Stop
```

Use a different port when necessary:

```powershell
.\tools\Start-RawiPreview.ps1 -Port 4174
.\tools\Start-RawiPreview.ps1 -Port 4174 -Stop
```

### Browser preview limitations

- Samsung AVPlay is unavailable, so playback uses the HTML `<video>` element.
- Samsung remote key registration and application-exit APIs are unavailable.
- Browser storage is separate from storage on the TV. Quick Connect must
  therefore be completed independently in the browser.
- Codec support differs from the TV. Successful browser playback does not prove
  that AVPlay will accept the same stream, and the reverse can also be true.
- Final navigation, overscan, performance, and playback testing should be done
  on the physical TV.

## Connecting to Jellyfin

1. Start Rawi.
2. Confirm or edit the Jellyfin server URL.
3. Select **Connect**.
4. Rawi displays a Jellyfin Quick Connect code.
5. In Jellyfin, open Quick Connect, enter the code, and approve it.
6. Rawi stores the resulting session and opens the library.

Rawi queries all Jellyfin items whose media type is `Video`. This is
intentional: some Jellyfin libraries classify playable files as generic videos
rather than movies.

The home screen loads:

1. Continue Watching.
2. Recently Added.
3. Every top-level view returned by `/Users/{userId}/Views`.

Each library shelf recursively loads videos from that view. If view discovery
fails, Rawi falls back to a single All Videos shelf.

## Controls

### Browsing

| Remote or keyboard input | Action |
|---|---|
| Arrow keys | Move focus between controls and video cards |
| OK / Enter | Activate the focused control |
| Back / Backspace | Return to the previous screen |
| Refresh button | Reload shelves from Jellyfin |
| Profile button twice within three seconds | Sign out |

The two-press sign-out behavior prevents an accidental remote press from
clearing the saved session.

### Playback

| Remote or keyboard input | Action |
|---|---|
| OK / Enter / Play-Pause | Toggle pause |
| Play | Resume |
| Pause | Pause |
| Left / Rewind | Seek backward 30 seconds |
| Right / Fast Forward | Seek forward 30 seconds |
| Back / Stop | Stop playback and return to details |

## Packaging and deployment

Run the deployment helper from the repository root:

```powershell
.\tools\Deploy-Rawi.ps1
```

The helper:

1. Increments the patch version in `MovieDeck\config.xml`.
2. Updates the Jellyfin client version in `MovieDeck\js\api.js`.
3. Packages and signs `dist\Rawi.wgt`.
4. Connects to the configured TV if needed.
5. Installs the widget as an update.
6. Launches Rawi.

Package without installing or launching:

```powershell
.\tools\Deploy-Rawi.ps1 -PackageOnly
```

Package without incrementing the current version:

```powershell
.\tools\Deploy-Rawi.ps1 -PackageOnly -NoVersionIncrement
```

Deploy to another target or use another signing profile:

```powershell
.\tools\Deploy-Rawi.ps1 `
  -Target '192.168.1.200:26101' `
  -SigningProfile 'MySamsungProfile'
```

Generated widget files, package manifests, and XML signatures are ignored by
Git. Certificate private keys are not stored in this repository.

## Package identity and upgrades

The following values are intentionally retained from the application's
original identity:

```text
Application ID: JfMovieTV1.MovieDeck
Package ID:     JfMovieTV1
Storage keys:   moviedeck.*
```

Do not change these values for normal branding or UI work. Keeping them stable
allows a newly signed widget to update the installed application while
preserving its stored Jellyfin session. Changing the application or package ID
creates a separate TV application. Changing the signing author prevents an
in-place update.

The visible product name, icon, description, and widget filename can be changed
without changing the internal identity.

## Jellyfin integration

`MovieDeck\js\api.js` contains the Jellyfin client. Important operations
include:

- `/System/Info/Public` for server discovery.
- `/QuickConnect/Initiate` and `/QuickConnect/Connect` for authorization.
- `/Users/AuthenticateWithQuickConnect` for session creation.
- `/Users/{userId}/Items/Resume` for Continue Watching.
- `/Users/{userId}/Items/Latest` for Recently Added.
- `/Users/{userId}/Views` for top-level library grouping.
- `/Users/{userId}/Items` for recursive library content.
- `/Items/{itemId}/PlaybackInfo` for direct-play and transcode negotiation.
- `/Sessions/Playing*` for playback state reporting.

The device profile currently advertises:

- Containers: MP4, M4V, MKV, MPEG-TS, MOV, and AVI.
- Video: H.264, HEVC, MPEG-4, MPEG-2, and VC-1.
- Audio: AAC, AC-3, E-AC-3, MP3, and DTS.
- H.264/AC-3 or AAC over HLS as the transcoding fallback.
- No subtitle profiles.

The profile is tuned for the target MU8000. Changes should be tested against
both Jellyfin's selected media source and Samsung AVPlay.

## Session persistence

Rawi stores its device ID and authenticated session in:

1. `tizen.preference` when the API is available.
2. `localStorage` as a fallback and for browser previews.

An HTTP `401` while loading the library clears the expired session and returns
the user to connection setup. Uninstalling the application, clearing its data,
or revoking the Jellyfin token requires Quick Connect again.

## Icon generation

Rebuild `MovieDeck\icon.png` with:

```powershell
.\tools\New-RawiIcon.ps1
```

The generator uses `System.Drawing` and the installed Bahnschrift font. Supply
another output path when experimenting:

```powershell
.\tools\New-RawiIcon.ps1 -OutputPath '.\dist\icon-preview.png'
```

## Troubleshooting

### The TV is not detected

Confirm Developer Mode is enabled and that its configured host IP matches the
development machine. Then check:

```powershell
& "$env:USERPROFILE\tizen-studio\tools\sdb.exe" devices
```

The target should appear in the `device` state. The deployment helper attempts
an SDB connection automatically when it is not already listed.

### Installation fails with error 118

Open Tizen Device Manager, select the TV, and enable **Permit to install
applications**. Confirm that the signing profile includes the TV's DUID.

### An update is rejected

Confirm all of the following:

- The new widget uses the same author certificate as the installed application.
- `JfMovieTV1.MovieDeck` and package `JfMovieTV1` have not changed.
- The widget version is newer than the installed version.
- The TV remains authorized for application installation.

### The library is empty

- Confirm the Jellyfin user can access the expected libraries.
- Confirm the server URL is reachable from the TV.
- Ensure Quick Connect is enabled.
- Remember that Rawi requests `MediaTypes=Video`, not only Jellyfin `Movie`
  items.
- Use the refresh button after changing libraries or permissions.

### The browser preview cannot reach Jellyfin

Confirm Jellyfin is running and permits requests from
`http://127.0.0.1:4173`. Use Edge DevTools to inspect the Console and Network
tabs for connection, authentication, or CORS failures.

### Playback transcodes unexpectedly

Inspect Jellyfin's playback information and server logs. Direct play depends on
the container, codecs, levels, bitrate, and audio compatibility advertised by
the device profile. Rawi allows Jellyfin to transcode when direct play is not
available.

## Development notes

- Keep runtime code ES5-compatible unless support for Tizen 3.0 is intentionally
  dropped.
- Keep TV-only API access feature-detected so the browser preview remains usable.
- Prefer transforms over repeated layout-triggering scroll changes on older TV
  hardware.
- Test at 1920x1080 and leave adequate margins for television overscan.
- Do not commit generated `.wgt` files, signatures, manifests, or certificate
  material.
- Treat deployment as the final validation step; browser preview behavior is
  not a substitute for testing on Samsung hardware.
