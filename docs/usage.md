# Using Rawi

[Back to README](../README.md)

## Connect to Jellyfin

For real media in a browser, start the preview without mock mode from the
repository root:

```powershell
.\tools\Start-RawiPreview.ps1
```

On the TV, open the installed app. Then:

1. Start Rawi and enter your Jellyfin server URL.
2. Select **Connect** to display a Quick Connect code.
3. Open Quick Connect in Jellyfin on another device, enter the code, and
   approve it.

Rawi remembers the successful server address and login. The home screen shows
Continue Watching, Recently Added, and a shelf for each top-level library,
with recursive video discovery and title metadata.

All items with media type `Video` are included, even if Jellyfin does not
classify them as movies. If library discovery fails, Adult Mode falls back
to All Videos. Storybook Mode instead shows a recoverable error rather than
bypassing its selected libraries.

## Controls

### Browsing

| Remote or keyboard input | Action |
|---|---|
| Arrow keys | Move between controls and video cards |
| OK / Enter | Activate the selection |
| Back / Backspace | Return to the previous screen |
| Refresh button | Reload shelves |
| Profile button twice within three seconds | Sign out |

### Playback

| Remote or keyboard input | Action |
|---|---|
| OK / Enter / Play-Pause | Toggle pause |
| Play / Pause | Resume / pause |
| Left / Rewind | Seek backward 30 seconds |
| Right / Fast Forward | Seek forward 30 seconds |
| Back / Stop | Stop and return to details |

From a title's details, resume playback or restart from the beginning.
Rawi uses Samsung AVPlay on the TV, with direct play where supported and
Jellyfin HLS transcoding as a fallback. Browser previews use HTML video.
Playback progress is reported to Jellyfin.

## Search

Select **Search** from either mode's home screen. Use arrows and OK to pick
letters; keys that cannot match a title are dimmed and skipped. Matches can
occur anywhere in a title. Delete and Clear broaden the search; More results
reveals additional matches.

Adult search covers loaded video libraries. Storybook search is limited to
parent-selected, currently visible libraries. Search stays local after
loading, rather than sending a request for every letter. A warning appears
if a library failed to load, so partial results are not presented as complete.

See [Storybook Mode](storybook.md) for parent settings, favorites, and sounds.

## Saved sessions

The device ID and authenticated session use `tizen.preference` when available,
with `localStorage` as a fallback. Browser storage is separate from TV storage,
so each needs its own Quick Connect approval.

An HTTP `401` while loading clears the expired session and returns to setup.
Uninstalling Rawi, clearing its data, or revoking the Jellyfin token also
requires Quick Connect again. See the [security policy](../SECURITY.md) for
shared-device and network considerations.

## Customizing interface copy

Default text lives in `MovieDeck\js\copy.js`. To personalize a fresh checkout,
copy the example from the repository root:

```powershell
Copy-Item .\MovieDeck\config\copy-overrides.example.js .\MovieDeck\config\copy-overrides.js
```

Skip this step if you already have an overrides file. Edit only the values
you want to change:

```javascript
(function (global) {
  'use strict';

  global.RawiCopyOverrides = {
    heroTitle: 'Family movie night.',
    continueWatchingCaption: 'Keep the movie night going'
  };
}(window));
```

`copy-overrides.js` is ignored by Git, but is included when you package your
own TV widget. Without it, the built-in text is used; browsers may show a
harmless 404 for this optional script. Delete an override to restore its
default, or set it to an empty string to intentionally hide that text.

Preserve placeholders when customizing these messages:

| Key | Placeholder |
|---|---|
| `runtimeMinutes` | `{minutes}` |
| `shelfItemCount`, `libraryCaption` | `{count}` |
| `posterAlt`, `finishedToast` | `{title}` |
| `resumeButton` | `{time}` |
| `samsungPlayerError` | `{error}` |
| `jellyfinHttpError` | `{status}` |

`quickTitle` and `quickInstructions` support trusted HTML. Other overrides
are inserted as plain text. Refresh the browser to see changes, or
[repackage and deploy](tv-setup.md#deploy-an-update) for the TV.

## Troubleshooting

### The library is empty

Check the Jellyfin user's library permissions, server reachability, and
whether Quick Connect is enabled. Rawi requests `MediaTypes=Video`, not just
movies. Refresh after changing libraries or permissions.

### The browser preview cannot reach Jellyfin

Confirm that Jellyfin permits requests from `http://127.0.0.1:4173`.
Use browser DevTools' Console and Network tabs to inspect connection,
authentication, and CORS errors.

### Playback transcodes unexpectedly

Inspect Jellyfin's playback information and server logs. Direct play depends
on the container, codecs, levels, bitrate, and audio compatibility advertised
by the [device profile](development.md#jellyfin-integration). Browser success
does not prove TV codec support, or vice versa.

For installation errors, see [TV setup troubleshooting](tv-setup.md#troubleshooting).
