# Storybook Mode Phase 4 Sound Cues Design

**Date:** 2026-09-02

## Summary

Phase 4 begins with optional Storybook sound cues. Rawi will add four short,
original acoustic cues for focus movement, confirmation, Back/close actions,
and Magic Pick reveals. Sounds are enabled by default, configurable by a
parent, limited to Storybook interactions, and stopped before video playback.

This slice does not implement quiet-time filtering, additional watercolor
library treatments, a volume slider, Adult Mode sounds, playback sounds, or
physical-TV deployment.

## Goals

- Give remote navigation gentle, consistent auditory feedback without making
  the interface noisy.
- Keep sound behavior isolated from Jellyfin playback and Adult Mode.
- Preserve the explicit Storybook preference recovery and write barriers.
- Package original sound assets with no external licensing dependency.
- Keep runtime code ES5-compatible with Samsung Tizen 3.0.
- Provide deterministic, browser-safe automated coverage without requiring
  speakers or microphone capture.

## Non-Goals

- Background music, spoken prompts, character voices, or continuous ambience.
- Sounds while the player is active.
- Sounds for Adult Mode controls.
- An adjustable volume setting in this phase.
- An automatic cue on the playback-complete ending screen.
- Quiet-time filters or watercolor-presentation configuration.
- Physical-TV installation or acoustic validation.

## Preference Schema

Storybook preferences advance from version 3 to version 4.

```javascript
{
  version: 4,
  enabled: true,
  lastMode: 'storybook',
  childName: 'Nova',
  libraryIds: [],
  favoriteItemIds: [],
  categoryTags: {
    singDance: 'sing-along',
    bedtime: 'bedtime',
    animals: 'animals',
    learning: 'learning',
    movement: 'movement'
  },
  durationLabels: {
    enabled: true,
    quickMaxMinutes: 12,
    cozyMaxMinutes: 30
  },
  recentHistoryDays: 14,
  reducedMotion: false,
  soundsEnabled: true
}
```

Version 3 migrates to version 4 in memory with `soundsEnabled: true` and no
restore-time write. Versions 1 and 2 continue to migrate transitively. Unknown
or malformed versions retain the existing explicit recovery flow and write
barrier. Every save path preserves `soundsEnabled`, including mode changes,
favorite changes, catalogue pruning, settings saves, preview saves, and
confirmed recovery resets.

The default-on decision intentionally overrides the earlier broad Storybook
design example that used `soundsEnabled: false`.

## Sound Assets

Four committed mono WAV files live under `MovieDeck\audio\`:

| Cue | File | Character |
|---|---|---|
| Focus | `storybook-focus.wav` | Very short soft wooden tick |
| Confirm | `storybook-confirm.wav` | Warm, restrained bell |
| Back | `storybook-back.wav` | Short page-like hush |
| Magic | `storybook-magic.wav` | Small two- or three-note sparkle |

The assets are original and generated deterministically by a retained tool
under `tools\`. The generator defines sample rate, duration, envelopes,
harmonics, and output filenames so the assets can be reproduced and tuned
without downloading third-party audio.

The files remain short, mono, and conservatively normalized. The focus cue is
the quietest and shortest. The Magic cue may be longest, but no cue should
continue long enough to compete with dialogue or video audio.

## Runtime Architecture

A new ES5 module, `MovieDeck\js\storybook-sound.js`, exposes one global:

```javascript
window.RawiStorybookSound = {
  init: function (options) {},
  setEnabled: function (enabled) {},
  play: function (cueName) {},
  stop: function () {}
};
```

`init(options)` accepts injectable audio construction and warning callbacks for
tests while using `window.Audio` and `console.warn` in production. The module
owns:

- cue-name-to-file mapping;
- preloading;
- conservative per-cue volume;
- one active cue at a time;
- focus-cue throttling;
- safe restart behavior;
- session-level disablement of an individual cue after a load or play failure;
  and
- stopping and rewinding active cue audio.

The module does not know about screens, Jellyfin items, focus geometry, or
playback. `app.js` owns semantic gating and calls `play('focus')`,
`play('confirm')`, `play('back')`, or `play('magic')`.

## Gating Rules

A cue may play only when all of these conditions are true:

1. Storybook preferences are enabled.
2. The active mode is Storybook.
3. `soundsEnabled` is true.
4. The active screen is not `player-screen`.
5. The shared player is not playing.

Switching to Adult Mode, starting playback, signing out, or disabling sounds
calls `RawiStorybookSound.stop()` immediately.

The engine's own enabled state follows the stored Storybook mode, the sound
preference, and player activity, so it is disabled in Adult Mode and during
playback rather than relying on caller gating alone. It deliberately excludes
the screen allowlist, which stays in `playStorybookCue`, so the transient
browse screen between a successful Storybook settings save and the Storybook
home cannot clip the confirmation cue. Returning from playback re-enables the
engine before the next user cue.

Because the player only reports itself as playing once its playback-info
request settles, the playback-entry sync runs from the settlement of the value
returned by `play()` rather than on the calling turn; a start that fails leaves
the engine enabled because playback never began. A runtime whose `play()`
returns no thenable is synced synchronously. Sign-out disables the engine
outright in addition to stopping it, so setup mode carries the same defence in
depth as playback.

Sound failure never blocks navigation, saving, or playback. The first failure
for a cue reports a concise warning and disables only that cue for the current
app session. Repeated failures do not generate repeated warnings.

## Cue Semantics

### Focus

Play the focus cue only after a remote directional key successfully changes
`document.activeElement` on a Storybook screen. Do not play it:

- for initial focus when a screen opens;
- for programmatic focus restoration;
- when a directional key finds no target;
- in Adult Mode; or
- while playback is active.

Focus cues are throttled so rapid held-key navigation does not produce an
overlapping or harsh stream of clicks. A successful cue restarts its own short
audio from the beginning rather than layering multiple instances.

### Confirm

Play the confirm cue for Storybook browsing actions that open or commit a
choice:

- opening a resume, menu, or favorite card;
- opening a Story Door or category shortcut;
- opening a selected item from a collection;
- confirming a Magic Pick into Storybook details;
- saving Storybook settings; and
- choosing another story from the ending screen.

Do not play the confirm cue for Play or Restart. Video audio follows those
actions immediately, so `startPlayback()` stops Storybook audio before opening
the player.

### Back

Play the Back cue when a user closes or cancels within Storybook:

- details to its origin;
- collection to Storybook home;
- Magic Pick to Storybook home;
- settings cancel/Back;
- ending screen back to Storybook home.

Do not play it for application exit, sign-out, or player stop.

### Magic

Play the Magic cue when Magic Pick opens or rerolls. It replaces the normal
confirm cue for the same action, so the two cues never stack.

## Parent Settings

The existing Storybook Settings screen gains one checkbox:

```text
Play gentle Storybook sounds
```

The checkbox:

- reflects `soundsEnabled`;
- defaults to checked for new and migrated version-4 preferences;
- is disabled during preference recovery;
- participates in the existing remote-navigation and scroll order;
- is preserved when validation fails elsewhere; and
- takes effect immediately after a successful save.

No volume slider is added. Per-cue volume remains code-owned so the sound
palette stays coherent and conservative.

## Data Flow

1. Preferences restore and migrate to version 4.
2. `app.js` initializes `RawiStorybookSound` and applies `soundsEnabled`.
3. Storybook renderers continue emitting semantic callbacks without audio file
   knowledge.
4. `app.js` maps successful interactions to cue names after confirming the
   action or focus change occurred.
5. The sound module stops any active cue, rewinds the selected cue, applies its
   volume, and starts playback.
6. Entering playback or Adult Mode stops Storybook sound immediately.
7. Settings saves update the sound module only after preference persistence
   succeeds.

## Interaction and Focus Integration

Focus sound is integrated at the `spatialMove` boundary. `app.js` captures the
focused element before movement and compares it with `document.activeElement`
after movement. It plays the cue only when the element changed and the new
element belongs to an active Storybook screen.

Action sounds are triggered in app-level semantic handlers rather than
attached generically to every button. This avoids duplicate sounds, keeps
Magic Pick from stacking confirm and sparkle cues, and prevents Play/Restart
from sounding immediately before video playback.

Programmatic calls such as `focusWhenReady`, preview route entry, and Back
focus restoration remain silent unless the user action itself has a Back or
confirm cue.

## Preview Behavior

The deterministic Storybook preview loads the packaged sound assets but does
not require audible output for acceptance. Automated preview tests inject a
fake sound module or fake Audio implementation and assert semantic cue calls.

The preview continues making zero Jellyfin requests. `-NoBrowser` remains the
automation boundary for preview-helper tests, and browser sessions remain
headless unless a user explicitly requests a visible browser.

## Error Handling

- Missing or undecodable assets disable the affected cue for the session and
  report one warning.
- A rejected `Audio.play()` promise is handled without an unhandled rejection.
  An `AbortError` is the expected result of pausing or restarting a cue and is
  ignored silently; a `NotAllowedError` may report one warning but leaves the
  cue retryable; every other rejection, including `NotSupportedError`, reports
  one warning and disables the affected cue.
- Each play attempt carries a generation token, so a rejection belonging to a
  superseded attempt never clears or disables the attempt that replaced it.
- Runtimes where `Audio.play()` returns no promise remain supported.
- `currentTime = 0`, `pause()`, or `load()` failures are reported for the
  affected cue without blocking the user action.
- An unavailable `window.Audio` disables Storybook sounds for the session while
  leaving the stored parent preference unchanged.
- Re-initializing the module stops any active cue and resets the disabled,
  warned, and focus-throttle state.

No user-facing toast is shown for optional sound failures; navigation remains
the authoritative success signal.

## Testing Strategy

### Preference and Settings Tests

- Version-3 preferences migrate to version 4 with `soundsEnabled: true`.
- Migration does not write during restore.
- Save normalization and all app save paths preserve `soundsEnabled`.
- Recovery disables the new checkbox and explicit reset restores the version-4
  default.
- Settings emit and reload the sound preference.
- Remote navigation includes the new checkbox in the exact settings order.

### Sound Module Tests

Using a fake Audio implementation:

- every cue maps to the expected packaged file;
- fixed volume is applied;
- one cue stops before another begins;
- rapid focus cues are throttled;
- a later focus cue can play after the throttle window;
- disabling sounds stops active audio;
- missing Audio support disables the module safely;
- synchronous play failures and fatal rejected play promises warn once and
  disable only the affected cue;
- an `AbortError` from a cue restart neither warns nor disables, and a
  `NotAllowedError` warns once while leaving the cue retryable;
- a stale rejection from a superseded attempt never clears the active attempt;
- re-initializing stops the active cue and resets session state; and
- `stop()` pauses and rewinds the active cue.

### App Integration Tests

- successful D-pad movement emits one focus cue;
- blocked movement emits no cue;
- initial/programmatic focus emits no focus cue;
- card, door, category, settings-save, Magic Pick, reroll, and Back flows emit
  the correct semantic cue exactly once;
- Magic Pick does not also emit confirm;
- Play/Restart emits no cue and stops active Storybook audio;
- Adult Mode and player-screen keys emit no Storybook cues;
- the engine's enabled state follows Storybook, Adult Mode, and playback
  transitions when driven through the real sound module;
- the engine is still enabled on the turn `play()` is called and becomes
  disabled only once the player's start settles, driven by an explicitly
  asynchronous player double that mirrors the real `play()` contract;
- a failed playback start resyncs the engine from the rejection path without
  an unhandled rejection, and a player whose `play()` returns no thenable is
  still synced synchronously;
- sign-out disables the engine as well as stopping it;
- a same-cue Magic reroll whose first play promise rejects still leaves the
  newer attempt stoppable, so no cue bleeds into the player;
- a successful Storybook settings save keeps its confirmation cue audible
  through the transient browse screen;
- disabling sounds prevents later cue calls; and
- optional sound failure does not change navigation or persistence outcomes.

### Asset, Preview, and Package Tests

- the four files exist and contain valid RIFF/WAVE headers;
- the deterministic generator reproduces the committed byte content;
- preview mode requests the local assets without contacting Jellyfin;
- the package contains `js/storybook-sound.js` and all four audio files; and
- package metadata, app ID, package ID, and version remain unchanged until the
  eventual release task explicitly increments them.

## Delivery and Compatibility

Implementation occurs in an isolated worktree and advances the schema to
version 4 without changing the current application/package IDs. The Phase 4
sound-cue slice does not deploy to a physical TV and does not increment
`0.1.13` during ordinary task work.

Because the original Storybook design expected Phase 4 after comfortable TV
use, proceeding now is an explicit user-directed override. Physical-TV volume,
speaker coloration, and room-level audibility remain unverified until a later
deployment is explicitly requested.

## Acceptance Criteria

1. Storybook sounds default on after a safe version-3-to-version-4 migration.
2. Parents can disable or re-enable sounds from Storybook Settings.
3. Focus, confirm, Back, and Magic actions produce the approved acoustic cue
   semantics exactly once.
4. Programmatic focus, blocked movement, Adult Mode, and playback remain silent.
5. Entering playback or Adult Mode stops any active Storybook cue.
6. Cue failures never block navigation, persistence, or playback and never
   produce repeated warnings.
7. Every sound asset is original, reproducible, packaged, and locally loaded.
8. Runtime JavaScript remains ES5-compatible with Samsung Tizen 3.0.
9. Existing recovery, no-autoplay, no-popup preview, and Adult Mode behavior
   remain intact.
10. No physical-TV deployment or version increment occurs in this slice.

## Deferred Phase 4 Work

- Quiet-time filters and bedtime-only catalogue composition.
- Additional watercolor library treatments and friendly library presentation
  configuration.
- Volume adjustment, alternate sound packs, background ambience, and ending
  screen completion sounds.
- Physical-TV acoustic validation and deployment.
