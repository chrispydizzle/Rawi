# TV setup and local configuration

[Back to README](../README.md)

Rawi currently targets the Samsung UN75MU8000 with Tizen 3.0. Other models
and firmware may behave differently. Run the commands below from the
repository root in Windows PowerShell 5.1 or PowerShell 7.

## Requirements

- Enable Developer Mode on the TV and put it on the same network as your PC.
- Install Tizen Studio at `%USERPROFILE%\tizen-studio`, including Samsung TV
  extensions.
- Create a Samsung certificate profile containing your TV's DUID.
- In Tizen Device Manager, enable **Permit to install applications** for the TV.

## Local configuration

For a fresh clone, copy the [example](../rawi.local.example.json) and edit the
resulting file. Skip the copy if you already have local settings:

```powershell
Copy-Item .\rawi.local.example.json .\rawi.local.json
```

```json
{
  "target": "192.0.2.10:26101",
  "signingProfile": "MySamsungProfile"
}
```

Replace the example address with your TV's address and SDB port, and use the
profile name from Tizen Certificate Manager. `192.0.2.10` is a documentation
placeholder, not a live TV.

`rawi.local.json` is ignored by Git and sits outside the packaged `MovieDeck`
directory, so it is neither pushed to GitHub nor included in the widget.
The deployment helper finds it relative to the repository, not your shell's
current directory. Invalid JSON, unknown settings, and non-string values
produce an error before packaging or version changes.

Other local settings stay separate:

| Setting | Where it lives |
|---|---|
| TV address and signing profile name | Ignored `rawi.local.json` |
| Personalized interface text | Ignored [`MovieDeck\config\copy-overrides.js`](usage.md#customizing-interface-copy) |
| Jellyfin address and login | Entered in the app and stored on that TV/browser |
| Signing certificate and private key | Your Tizen certificate setup, outside this repository |

These settings do not change the normal `git add`, `git commit`, and `git push`
workflow. Commit the example file, not your local configuration.

## Deploy an update

With local settings saved:

```powershell
.\tools\Deploy-Rawi.ps1 -Launch
```

The helper copies license notices into the widget source, increments the
patch version in `MovieDeck\config.xml` and `MovieDeck\js\api.js`, packages
and signs `dist\Rawi.wgt`, connects to your TV, and installs the update.
It launches Rawi only when `-Launch` is supplied.

Command-line options override local settings. You can also use them without
a local file:

```powershell
.\tools\Deploy-Rawi.ps1 `
  -Target '192.0.2.20:26101' `
  -SigningProfile 'MySamsungProfile' `
  -Launch
```

To package without connecting to a TV:

```powershell
.\tools\Deploy-Rawi.ps1 -PackageOnly
```

Add `-NoVersionIncrement` to keep the current version. A signing profile is
still required, either in local settings or through `-SigningProfile`;
`-Target` is not required for packaging alone.

Generated widgets, manifests, signatures, and copied license notices are
ignored by Git. Widgets are signed locally for your own TV; no shared signing
keys or pre-signed releases are provided.

## Keep upgrades compatible

Preserve these internal identifiers:

```text
Application ID: JfMovieTV1.MovieDeck
Package ID:     JfMovieTV1
Storage keys:   moviedeck.*
```

The same application/package IDs and signing author let an update replace the
installed app while retaining its saved session. Changing those IDs creates a
separate app; changing the signing author prevents an in-place update.
The visible name, icon, description, and widget filename can change without
changing this identity.

## Troubleshooting

### The TV is not detected

Check that Developer Mode's host IP matches your PC, then list devices:

```powershell
& "$env:USERPROFILE\tizen-studio\tools\sdb.exe" devices
```

Your TV should appear in the `device` state. The helper attempts an SDB
connection automatically when the target is not listed.

### Installation fails with error 118

In Tizen Device Manager, select the TV and enable **Permit to install
applications**. Confirm that your signing profile includes the TV's DUID.

### An update is rejected

Check that you used the installed app's author certificate, kept the IDs above,
increased the widget version, and retained installation permission on the TV.

For library or playback problems, see [Using Rawi](usage.md#troubleshooting).
