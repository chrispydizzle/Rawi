# Storybook Mode

[Back to README](../README.md)

Storybook is a parent-guided preschool interface over selected Jellyfin
libraries. Adult Mode remains available through the visible top-bar toggle.
**Library selection is curation, not access control:** use Jellyfin user
permissions to enforce content restrictions.

## Set it up

1. In Adult Mode, open **Storybook settings**.
2. Enter the child's display name and select one or more visible libraries.
3. Choose reduced motion and sound preferences.
4. Save, then select **Storybook** in the mode toggle.

Settings and the last-used mode are remembered between sessions.

## Finding something to watch

- Add or remove Storybook favorites from a title's Adult Mode details.
- Continue Watching opens the usual Storybook details and player flow.
- Story Doors open selected libraries; category shortcuts browse matching tags.
- **Tonight's Little Menu** stays stable for the app session.
- **Magic Pick** always asks for confirmation before playback.

[Search](usage.md#search) matches partial titles from selected, visible
libraries only. It never includes adult-only libraries.

After playback, **All done** exits the app on the TV. In a browser preview,
it returns to Storybook home because the Tizen exit API is unavailable.

## Artwork and motion

Artwork keeps its original proportions inside fixed cards. Portrait, square,
and landscape images are centered with padding rather than stretched or
cropped; small images are not upscaled.

Focused cards, categories, and Story Doors briefly attract three silent
fireflies. They fade after about 1.5 seconds or when focus moves and never
intercept input.

The moon looks toward the selected control, blinks, and dozes after 12 seconds
without input. The next remote press wakes it and still performs its normal
action. Hidden screens and playback stop its activity.

Search letters use short stamp and peel effects. Rapid input replaces
unfinished effects instead of queuing them. Fireflies and search effects
respect both parent-selected and system reduced-motion settings; they add
no sounds and do not change Adult Mode.

## Sound cues

Four local cues accompany successful focus movement, opening or confirming
a choice, going back, and revealing a Magic Pick. Disable them with **Play
gentle Storybook sounds** in settings.

Sounds never play in Adult Mode or during video playback. Play and Restart
stop any active cue before opening the player. The original WAV files are
[reproducible from their generator](development.md#generated-assets).

Quiet-time filters, additional watercolor presentation settings, and physical
TV speaker-volume and listening checks remain deferred.

## Try it without Jellyfin

From the repository root:

```powershell
.\tools\Start-RawiPreview.ps1 -StorybookMock
```

The deterministic Watercolor preview uses local fixtures. It does not
authenticate or contact Jellyfin, even if a server address is saved.
For direct links to individual screens and browser checks, see the
[development guide](development.md#storybook-preview-routes).
