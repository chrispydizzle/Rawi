# Task 4 Report: Whimsical Watercolor Storybook Shell

## Outcome

Implemented the dedicated Storybook home shell and routed Storybook Mode
through it while preserving the Adult shelf renderer for normal browsing and
for Phase 1 Story Door handoff.

**Commit:** `5f4d2cb12b6eb0ae8629ecedbf2bb341d0672c21`

## Files changed

- `MovieDeck/index.html`
- `MovieDeck/css/storybook.css`
- `MovieDeck/js/animations.js`
- `MovieDeck/js/app.js`
- `MovieDeck/js/copy.js`
- `MovieDeck/js/storybook-view.js`
- `MovieDeck/tests/animations.test.js`
- `MovieDeck/tests/run-tests.js`
- `MovieDeck/tests/storybook-app.test.js`
- `MovieDeck/tests/storybook-view.test.js`

## RED / GREEN evidence

### RED 1: Storybook home renderer and animation export missing

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
node:assert:152
  throw new AssertionError(obj);
  ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'undefined'
- 'function'

    at animatesOnlyTheFirstThreeStoryDoors (C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck\tests\animations.test.js:82:10)
    at Object.<anonymous> (C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck\tests\animations.test.js:91:2)
...
Node.js v24.12.0
```

### RED 2: Storybook reduced-motion still animated screen entry

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
All Rawi tests passed.
node:internal/process/promises:394
    triggerUncaughtException(err, true /* fromPromise */);
    ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

1 !== -1

    at keepsReducedMotionStorybookHomeStatic (C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck\tests\storybook-app.test.js:714:10)
...
Node.js v24.12.0
```

### GREEN: Final added tests and regressions pass

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
All Rawi tests passed.
```

## Validation commands and outputs

### 1. Node tests

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
All Rawi tests passed.
```

### 2. Runtime JavaScript syntax check

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; $paths = @('.\MovieDeck\js\*.js'); if (Test-Path .\MovieDeck\config) { $paths += '.\MovieDeck\config\*.js' }; Get-ChildItem $paths | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

**Output**

```text
```

### 3. Whitespace check

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; git diff --check
```

**Output**

```text
```

## Preview evidence

### Provided preview script

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; .\tools\Start-RawiPreview.ps1
```

**Output**

```text
Rawi preview: http://127.0.0.1:4173/
Press F12 for DevTools and refresh the page after edits.
Stop it with: .\tools\Start-RawiPreview.ps1 -Stop
```

### Environment observation from script-served page

The script started successfully, but the served `index.html` did not include
the new `css/storybook.css` link or the `storybook-screen` markup in this
environment, so I did not treat that page as trustworthy preview evidence for
the worktree changes.

### Direct worktree-local preview verification

**Command**

```powershell
$process = Start-Process python -ArgumentList '-m','http.server','4174','--bind','127.0.0.1','--directory','C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck' -PassThru -WindowStyle Hidden; try { Start-Sleep -Seconds 1; $index = Invoke-WebRequest http://127.0.0.1:4174/ -UseBasicParsing; $css = Invoke-WebRequest http://127.0.0.1:4174/css/storybook.css -UseBasicParsing; Write-Output ("preview-url=http://127.0.0.1:4174/"); Write-Output ("index-status=" + $index.StatusCode); Write-Output ("storybook-css-present=" + [bool]($index.Content -match 'css/storybook.css')); Write-Output ("storybook-screen-present=" + [bool]($index.Content -match 'id=""storybook-screen""')); Write-Output ("storybook-css-status=" + $css.StatusCode); Write-Output ("storybook-door-style-present=" + [bool]($css.Content -match '\.storybook-door')); } finally { Stop-Process -Id $process.Id }
```

**Output**

```text
preview-url=http://127.0.0.1:4174/
index-status=200
storybook-css-present=True
storybook-screen-present=True
storybook-css-status=200
storybook-door-style-present=True
```

## Self-review

1. The Adult renderer was extracted into `renderAdultGroups(groups)` without
   changing its shelf composition or card-selection behavior; Storybook home
   only changes routing and the filtered library set it passes in Phase 1.
2. Storybook home rendering, Story Door routing, back-navigation restoration,
   door-count capping, and reduced-motion behavior are covered by focused
   dependency-free tests in `storybook-view.test.js`, `animations.test.js`,
   and `storybook-app.test.js`.
3. I added explicit reduced-motion handling in both places that could animate
   the Storybook home: recurring door motion is killed and cleared in
   `animateStorybookHome`, and screen-entry animation is skipped when the
   Storybook preference requests reduced motion.

## Concerns

- `tools\Start-RawiPreview.ps1` launched successfully but, in this environment,
  the page served on port `4173` did not reflect the updated worktree assets.
  I captured that as a preview concern and used a direct worktree-local HTTP
  server to verify the changed `index.html` and `storybook.css` were being
  served correctly.

## Fix Review

### Files changed

- `MovieDeck\css\storybook.css`
- `MovieDeck\index.html`
- `MovieDeck\js\animations.js`
- `MovieDeck\js\app.js`
- `MovieDeck\js\storybook-view.js`
- `MovieDeck\tests\animations.test.js`
- `MovieDeck\tests\storybook-app.test.js`
- `MovieDeck\tests\storybook-view.test.js`

### RED / GREEN evidence for review regressions

#### RED 1: Story Door leaked Adult continue/recent shelves

**Command**

```powershell
$temp = Join-Path $env:TEMP 'rawi-task4-red-app'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }; New-Item -ItemType Directory -Path $temp | Out-Null; Copy-Item 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck' (Join-Path $temp 'MovieDeck') -Recurse -Force; Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; git show HEAD:MovieDeck/js/app.js | Set-Content -Path (Join-Path $temp 'MovieDeck\js\app.js') -Encoding utf8NoBOM; try { Set-Location $temp; node .\MovieDeck\tests\run-tests.js; $code = $LASTEXITCODE } finally { Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force } }; exit $code
```

**Output**

```text
All Rawi tests passed.
node:internal/process/promises:394
    triggerUncaughtException(err, true /* fromPromise */);
    ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

  [
+   'Continue watching',
+   'Recently added',
    'Kids'
  ]

    at opensStoryDoorInAdultShelfViewAndBackRestoresStorybookHome (C:\Users\posad\AppData\Local\Temp\rawi-task4-red-app\MovieDeck\tests\storybook-app.test.js:750:10)
...
Node.js v24.12.0
```

#### RED 2: Missing selected libraries left Storybook home without recovery copy

**Command**

```powershell
$temp = Join-Path $env:TEMP 'rawi-task4-red-app2'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }; New-Item -ItemType Directory -Path $temp | Out-Null; Copy-Item 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck' (Join-Path $temp 'MovieDeck') -Recurse -Force; Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; git show HEAD:MovieDeck/js/storybook-view.js | Set-Content -Path (Join-Path $temp 'MovieDeck\js\storybook-view.js') -Encoding utf8NoBOM; try { Set-Location $temp; @'
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
function loadBrowserScript(relativePath, additions) {
  var values = additions || {};
  var context = {
    console: console,
    window: values.window || {},
    localStorage: values.localStorage,
    document: values.document
  };
  context.window.window = context.window;
  context.window.localStorage = context.localStorage;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(process.cwd(), 'MovieDeck', relativePath), 'utf8'),
    context,
    { filename: relativePath }
  );
  return context.window;
}
global.RawiTest = {
  assert: require('assert'),
  loadBrowserScript: loadBrowserScript
};
process.on('unhandledRejection', function (error) { throw error; });
require(path.join(process.cwd(), 'MovieDeck', 'tests', 'storybook-app.test.js'));
setImmediate(function () {});
'@ | node -; $code = $LASTEXITCODE } finally { Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force } }; exit $code
```

**Output**

```text
[stdin]:27
process.on('unhandledRejection', function (error) { throw error; });
                                                    ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ ''
- 'No Storybook libraries are available.'

    at showsStorybookRecoveryStateWhenSelectedLibrariesDisappear (C:\Users\posad\AppData\Local\Temp\rawi-task4-red-app2\MovieDeck\tests\storybook-app.test.js:790:10)
...
Node.js v24.12.0
```

#### RED 3: Storybook door animation lifecycle did not reset authored transforms cleanly

**Command**

```powershell
$temp = Join-Path $env:TEMP 'rawi-task4-red'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }; New-Item -ItemType Directory -Path $temp | Out-Null; Copy-Item 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck' (Join-Path $temp 'MovieDeck') -Recurse -Force; Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; git show HEAD:MovieDeck/js/app.js | Set-Content -Path (Join-Path $temp 'MovieDeck\js\app.js') -Encoding utf8NoBOM; git show HEAD:MovieDeck/js/storybook-view.js | Set-Content -Path (Join-Path $temp 'MovieDeck\js\storybook-view.js') -Encoding utf8NoBOM; git show HEAD:MovieDeck/js/animations.js | Set-Content -Path (Join-Path $temp 'MovieDeck\js\animations.js') -Encoding utf8NoBOM; try { Set-Location $temp; node .\MovieDeck\tests\run-tests.js; $code = $LASTEXITCODE } finally { Set-Location 'C:\Code\Rawi\.worktrees\storybook-mode-phase-1'; if (Test-Path $temp) { Remove-Item $temp -Recurse -Force } }; exit $code
```

**Output**

```text
node:assert:152
  throw new AssertionError(obj);
  ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   [
+     {
+       style: {
+         opacity: '0.5',
+         transform: 'translateY(7px)',
+         visibility: 'hidden'
+       }
+     },
+     {
+       style: {
+         opacity: '0.5',
+         transform: 'translateY(7px)',
+         visibility: 'hidden'
+       }
+     },
+     {
+       style: {
+         opacity: '0.5',
+         transform: 'translateY(7px)',
+         visibility: 'hidden'
+       }
+     },
+     {
+       style: {
+         opacity: '0.5',
+         transform: 'translateY(7px)',
+         visibility: 'hidden'
+       }
+     },
+     {
+       style: {
+         opacity: '0.5',
+         transform: 'translateY(7px)',
+         visibility: 'hidden'
+       }
+     }
+   ]
+ ]
- []

    at animatesOnlyTheFirstThreeStoryDoorsAfterEntrance (C:\Users\posad\AppData\Local\Temp\rawi-task4-red\MovieDeck\tests\animations.test.js:94:10)
...
Node.js v24.12.0
```

#### GREEN: Fixed Storybook home, Story Door routing, and animation lifecycle all pass

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
All Rawi tests passed.
```

### Validation commands and pristine outputs

#### 1. Full MovieDeck test suite

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; node .\MovieDeck\tests\run-tests.js
```

**Output**

```text
All Rawi tests passed.
```

#### 2. Runtime JavaScript syntax check for `MovieDeck\js\*.js`

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; $paths = Get-ChildItem '.\MovieDeck\js\*.js'; foreach ($path in $paths) { node --check $path.FullName; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
```

**Output**

```text
```

#### 3. Whitespace / patch hygiene

**Command**

```powershell
Set-Location C:\Code\Rawi\.worktrees\storybook-mode-phase-1; git --no-pager diff --check
```

**Output**

```text
```

#### 4. Worktree-local preview

**Command**

```powershell
$process = Start-Process python -ArgumentList '-m','http.server','4175','--bind','127.0.0.1','--directory','C:\Code\Rawi\.worktrees\storybook-mode-phase-1\MovieDeck' -PassThru -WindowStyle Hidden; try { Start-Sleep -Seconds 1; $index = Invoke-WebRequest 'http://127.0.0.1:4175/' -UseBasicParsing; Write-Output ('preview-url=http://127.0.0.1:4175/'); Write-Output ('index-status=' + $index.StatusCode); Write-Output ('storybook-empty-state-present=' + [bool]($index.Content -match 'id="storybook-empty-state"')); Write-Output ('storybook-edit-button-present=' + [bool]($index.Content -match 'id="storybook-edit-libraries"')); } finally { Stop-Process -Id $process.Id }
```

**Output**

```text
preview-url=http://127.0.0.1:4175/
index-status=200
storybook-empty-state-present=True
storybook-edit-button-present=True
```

### Self-review

1. `renderAdultGroups` now has an explicit Story Door path that suppresses Continue Watching and Recently Added, while ordinary Adult Mode still renders those shelves unchanged.
2. Storybook home now renders an in-screen recovery state with `storybookNoSelectedLibraries`, hides the misleading hint, and moves focus to `storybook-edit-libraries` so the repair path is immediately actionable.
3. Storybook door offsets now live in scoped layout margins instead of authored `translateY`, and the GSAP lifecycle resets prior door tweens, respects both reduced-motion inputs, and starts at most three recurring bobbing tweens only after the entrance motion completes.
