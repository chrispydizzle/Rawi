# Rawi Storybook Mode Design

**Date:** 2026-09-01  
**Status:** Approved design  
**Primary audience:** A preschool child choosing content together with a parent

## Summary

Rawi will support two presentation modes over the same Jellyfin account,
catalogue, and player:

- **Adult Mode** preserves the current cinematic Rawi interface and behavior.
- **Storybook Mode** provides a warm, whimsical, parent-guided experience
  limited to parent-selected Jellyfin libraries.

The selected visual direction is **Whimsical Watercolor**: a calm nighttime
palette presented as an asymmetrical picture-book spread, with hand-drawn
display lettering, floating story doors, irregular painted shapes, and gentle
buoyant motion.

Storybook Mode is designed for shared choosing rather than autonomous
consumption. It will not use endless autoplay, viewing streaks, countdowns, or
rewards that encourage watching more.

## Goals

1. Make choosing a video together inviting and understandable for a preschool
   child.
2. Keep Adult Mode stable and visually unchanged.
3. Let parents curate Storybook Mode using existing Jellyfin libraries,
   favorites, and optional tags.
4. Reduce choice overload without hiding meaningful choices.
5. Keep playback behavior, progress tracking, and authentication consistent
   between modes.
6. Maintain smooth interaction on the target 2017 Samsung Tizen television.

## Non-goals

- Storybook Mode is not a parental-security boundary.
- Rawi will not replace Jellyfin user permissions or content ratings.
- The first release will not add profiles, cloud synchronization, voice
  control, a mascot, achievements, or viewing streaks.
- Storybook Mode will not automatically play another video.
- Adult Mode will not be redesigned as part of this work.

## Experience principles

### Parent-guided

The parent and child choose together. Controls remain visible and understandable
to both. The interface may suggest, simplify, and delight, but it does not take
control away from the parent.

### Calm whimsy

Movement should feel buoyant rather than energetic. One or two elements may
gently float, and transitions may resemble a page turn or watercolor reveal.
Nothing should blink, pulse continuously, or compete with the selected title.

### Fewer, better choices

Storybook Mode initially presents one resume choice, three rotating suggestions,
the selected library doors, and an optional Magic Pick. It avoids reproducing
Adult Mode's full shelf density.

### Honest endings

Completing a video leads to a calm ending screen with **All done** as the primary
action and **Pick another** as the secondary action. There is no countdown and
no automatic next item.

## Mode switching

A visible toggle in the top bar switches between **Adult** and **Storybook**.
The toggle is intentionally unrestricted.

The last-used mode is stored locally on the TV and restored on launch. Switching
modes does not:

- sign the user out;
- reload or replace the Jellyfin session;
- interrupt active playback;
- change Jellyfin permissions; or
- modify playback progress.

The toggle is unavailable during playback. Mode changes occur from browsing or
details screens and never interrupt an active video.

## Storybook home

### Greeting

The home screen opens as a picture-book spread with configurable child-facing
copy, such as:

> What should we watch tonight, Nova?

The child's display name comes from Storybook preferences and is passed through
the existing copy placeholder system.

### Continue Nova's Story

When Jellyfin returns resumable content from an enabled library, Storybook Mode
shows one oversized resume card. The most recently active item is selected.

The card includes:

- primary artwork or a watercolor fallback;
- title;
- friendly duration label;
- visible progress;
- resume position; and
- a clear option to restart from the beginning on the details screen.

The section is omitted when no enabled item has progress.

### Tonight's Little Menu

Three rotating suggestions provide a manageable set of choices. Eligible items
must:

- belong to an enabled Storybook library;
- be playable videos;
- not be hidden by the active quiet-time filter; and
- not have been completed recently.

The menu should prefer variety across libraries and categories. It must remain
stable for the current app session so choices do not unexpectedly move whenever
focus changes.

### Story Doors

Each enabled Jellyfin library appears as a large illustrated doorway. A door
uses:

- the Jellyfin library name or a configured friendly name;
- a configured watercolor color treatment;
- available library artwork when suitable; and
- an illustrated fallback when artwork is unavailable.

Opening a door reveals a simplified library page with large cards and the same
Storybook visual language. It does not expose disabled libraries.

### Nova's Favorites

Parents can mark or unmark Storybook favorites from Adult Mode. Favorites are
stored as Jellyfin item IDs in Storybook preferences and displayed prominently
in Storybook Mode.

Missing or inaccessible favorite IDs are ignored and pruned from local
preferences after a successful catalogue refresh.

### Magic Pick

Magic Pick chooses one eligible title and presents a confirmation card. It never
starts playback immediately.

The initial selection rules are:

1. Exclude items outside enabled libraries.
2. Exclude items blocked by the active quiet-time filter.
3. Exclude items completed within the configured recent-history window.
4. Prefer unwatched items.
5. Give a moderate preference to favorites without making them the only result.
6. Prefer a category different from the most recently completed item when tags
   are available.
7. Choose randomly among the remaining highest-priority candidates.

If no eligible item exists, the interface explains why and offers to open a
Story Door instead.

## Friendly categories

Optional Jellyfin tags map to child-facing categories:

| Jellyfin tag | Default Storybook label |
|---|---|
| `sing-along` | Sing & Dance |
| `bedtime` | Bedtime Stories |
| `animals` | Animal Friends |
| `learning` | Little Lessons |
| `movement` | Move Around |

The tag-to-label mapping is configurable. Untagged items remain available
through Story Doors and general suggestions.

Tag categories are shortcuts, not additional access-control rules.

## Friendly duration labels

Storybook Mode can supplement minute counts with configurable labels:

| Default range | Default label |
|---|---|
| Up to 12 minutes | Quick story |
| 13–30 minutes | Cozy episode |
| More than 30 minutes | Big movie |

Adult Mode continues to display runtime in minutes. Thresholds and labels are
stored in Storybook configuration and may be disabled.

## Quiet-time filter

Quiet time is an optional temporary Storybook filter. It may restrict the
visible catalogue to one or more of:

- Storybook favorites;
- items tagged `bedtime`;
- items below a configured runtime; and
- selected Storybook categories.

The filter is visibly active and can be cleared from Storybook Mode. It does not
change Jellyfin permissions or delete preferences.

## Visual design

### Direction

The approved **Whimsical Watercolor** direction uses:

- deep indigo and blue-violet nighttime washes;
- soft moon-gold highlights;
- muted coral, periwinkle, and sea-glass green story doors;
- irregular, hand-painted silhouettes;
- handwritten display lettering paired with a highly legible body face;
- asymmetrical composition; and
- sparse stars, moon shapes, and painted texture.

The layout should resemble an illustrated bedtime-book spread rather than a
dashboard or a grid of corporate cards.

### Motion

Permitted motion includes:

- a short page-opening entrance;
- slow vertical bobbing on a small number of story doors;
- a soft watercolor reveal when changing pages;
- a restrained sparkle when a title or Magic Pick is confirmed; and
- transform-based focus growth.

All recurring animation must stop or become static when reduced motion is
enabled. Animations must use transforms and opacity rather than layout
properties.

### Typography

The Storybook display face should look hand-drawn and friendly without reducing
title legibility at television distance. The chosen font must be packaged with
the application or replaced by a verified Tizen-safe fallback.

Body text, runtimes, controls, and error messages use a simple high-legibility
sans serif. Adult Mode typography remains unchanged.

## Parent settings

Adult Mode exposes a Storybook Settings panel containing:

- Storybook Mode enabled state;
- enabled Jellyfin library IDs;
- optional friendly library names and colors;
- child's display name;
- Storybook favorite item IDs;
- tag-to-category mappings;
- friendly duration thresholds;
- quiet-time defaults; and
- motion and sound preferences.

The first launch into Storybook Mode opens this panel if no libraries are
selected. The panel must list currently accessible Jellyfin libraries and
identify previously selected libraries that are no longer available.

## Architecture

### Shared core

Both modes use the existing:

- Jellyfin authentication and session persistence;
- API client;
- normalized item metadata;
- image URL generation;
- playback negotiation;
- Samsung AVPlay integration;
- HTML video preview fallback; and
- playback progress reporting.

No playback or authentication logic is duplicated for Storybook Mode.

### Presentation boundary

Adult Mode and Storybook Mode have separate renderers that consume the same
normalized view model.

The intended component boundary is:

```text
Jellyfin API
    |
Catalogue and playback services
    |
Normalized Rawi view model
    |
    +-- Adult renderer
    |
    `-- Storybook renderer
            |
            +-- Storybook home
            +-- Story Door library page
            +-- Storybook details
            +-- Magic Pick confirmation
            `-- Gentle ending screen
```

Mode-specific CSS is scoped beneath an explicit mode class. Storybook rules must
not override Adult Mode selectors globally.

### Copy

The existing copy resolver remains the only source for user-facing text.
Storybook Mode adds mode-specific keys and supports placeholders such as:

- `{child}`;
- `{title}`;
- `{minutes}`;
- `{category}`; and
- `{library}`.

Default copy remains complete. Sparse local overrides may personalize either
mode without editing application logic.

## Preferences

Storybook preferences are stored under a versioned key separate from the
existing Jellyfin session:

```javascript
{
  version: 1,
  enabled: true,
  lastMode: "storybook",
  childName: "Nova",
  libraryIds: [],
  favorites: [],
  libraryPresentation: {},
  categoryTags: {},
  durationLabels: {
    enabled: true,
    quickMaxMinutes: 12,
    cozyMaxMinutes: 30
  },
  quietTime: {
    active: false,
    favoritesOnly: false,
    requiredTags: [],
    maxMinutes: null
  },
  reducedMotion: false,
  soundsEnabled: false
}
```

Invalid preference data is surfaced through a recoverable settings error and
reset only with explicit parent confirmation. Missing optional properties use
versioned defaults.

## Data flow

1. Rawi restores the Jellyfin session and Storybook preferences.
2. It loads accessible Jellyfin views.
3. Storybook library IDs are intersected with currently accessible views.
4. Video items are loaded and normalized once.
5. Resume, latest, favorites, categories, duration labels, and Magic Pick
   candidates are derived from the normalized catalogue.
6. The active renderer receives its mode-specific view model.
7. Both modes send selected items to the same details and playback services.

The catalogue should be cached for the active session and invalidated by manual
refresh, authentication changes, or Storybook library-selection changes.

## Error handling

- **No Storybook libraries selected:** open a friendly setup prompt linking to
  Storybook Settings.
- **Selected library no longer accessible:** omit it from Storybook Mode and
  identify it in Adult Mode settings.
- **Missing artwork:** render a deterministic watercolor fallback based on the
  item or library ID.
- **Missing tags:** omit category shortcuts without hiding the item.
- **Storybook catalogue failure:** display a mode-specific retry message and
  allow switching back to Adult Mode without signing out.
- **No Magic Pick candidates:** explain that no matching stories are available
  and offer Story Doors.
- **Corrupt preferences:** retain the Jellyfin session, show a recoverable
  settings error, and require confirmation before resetting Storybook settings.
- **Playback failure:** use the shared player error flow with Storybook-specific
  copy.

## Performance constraints

- Preserve ES5-compatible runtime JavaScript for Tizen 3.0.
- Limit continuously animated elements to three visible items.
- Use `translate3d`, transforms, and opacity for motion.
- Avoid live blur filters, large animated shadows, and layout-triggering
  animation.
- Decode and display only artwork needed for the current screen.
- Keep Storybook DOM size lower than the existing full-library shelf view.
- Provide a static reduced-motion path.

## Testing

### Deterministic local preview

Add mock catalogue fixtures covering:

- enabled and disabled libraries;
- resumable and completed items;
- favorites;
- tagged and untagged items;
- short, medium, and long runtimes;
- missing artwork;
- empty catalogues; and
- inaccessible saved libraries.

The preview must support switching modes without a live Jellyfin session.

### Automated checks

- Adult Mode output remains unchanged when Storybook Mode is disabled.
- Mode preference survives reload.
- Only enabled libraries appear in Storybook Mode.
- Every Storybook copy key has a default.
- Magic Pick never selects an ineligible item.
- Magic Pick returns a confirmation state rather than starting playback.
- Friendly duration boundaries produce the configured labels.
- Quiet-time filters compose correctly.
- Missing metadata produces defined fallback states.
- Completing playback never triggers another item automatically.

### Physical TV checks

- The mode toggle is reachable and legible from normal viewing distance.
- Focus movement remains predictable with the Samsung remote.
- Story Doors and large cards remain within overscan-safe margins.
- Page transitions and door motion remain smooth on the target MU8000.
- Reduced motion disables recurring movement.
- Switching modes preserves authentication and playback progress.
- Storybook copy fits at 1920x1080 without truncation.
- Playback completion presents **All done** without a countdown.

## Delivery phases

### Phase 1: Storybook foundation

- Visible, persisted mode toggle.
- Versioned Storybook preferences.
- Adult Mode preservation.
- Selected-library settings and filtering.
- Whimsical Watercolor shell.
- Mode-scoped copy and CSS.
- Reduced-motion support.

### Phase 2: Core shared experience

- Story Doors.
- Continue Nova's Story.
- Nova's Favorites.
- Storybook details view.
- Gentle ending screen with no autoplay.

### Phase 3: Guided discovery

- Tonight's Little Menu.
- Magic Pick and confirmation.
- Friendly duration labels.
- Jellyfin tag categories.

### Phase 4: Optional refinements

- Quiet-time filters.
- Subtle sound cues.
- Additional watercolor library treatments.

Phase 4 begins only after the core experience has been used comfortably on the
physical TV.

## Acceptance criteria

The initial Storybook release is complete when:

1. The user can visibly toggle between Adult and Storybook modes.
2. The selected mode persists across application launches.
3. Adult Mode retains its current layout, copy, and navigation.
4. Storybook Mode displays only parent-selected Jellyfin libraries.
5. Storybook Mode uses the approved Whimsical Watercolor visual direction.
6. Storybook copy can be personalized through the existing override system.
7. The UI remains operable using only the Samsung remote.
8. Storybook animations remain smooth on the target TV and have a static
   reduced-motion path.
9. Authentication and playback are shared between modes.
10. Storybook Mode never automatically starts a second video.
