# Rawi

A Jellyfin video browser and player for Samsung Tizen TVs, built for a TV
remote. Browse libraries, find a title, and pick up where you left off.

Rawi is an independent, experimental project targeting the Samsung UN75MU8000
(Tizen 3.0), not an official Samsung or Jellyfin client. Other models and
firmware may behave differently.

- Library shelves, Continue Watching, and remote-friendly title search.
- Quick Connect sign-in with remembered sessions.
- Direct playback when supported, with Jellyfin HLS transcoding as a fallback.
- Optional Storybook Mode with parent-selected libraries, favorites, and sounds.

## Quick start

Try the mock library without a TV or Jellyfin server. On Windows, use
PowerShell 5.1 or 7 with Python 3 available as `python`:

```powershell
git clone https://github.com/chrispydizzle/Rawi.git
Set-Location .\Rawi
.\tools\Start-RawiPreview.ps1 -StorybookMock
```

Open `http://127.0.0.1:4173/?preview=storybook` if a browser doesn't open.
Navigate with **arrow keys**, **Enter**, and **Backspace**. No npm install or
signing certificate is needed for this preview.

```powershell
.\tools\Start-RawiPreview.ps1 -Stop
```

## Guides

| I want to... | Read |
|---|---|
| Install on my TV or save local deployment settings | [TV setup](docs/tv-setup.md) |
| Connect Jellyfin, learn the controls, or customize text | [Using Rawi](docs/usage.md) |
| Set up the parent-guided interface | [Storybook Mode](docs/storybook.md) |
| Develop, run checks, or regenerate assets | [Development](docs/development.md) |

Storybook selection is curation, not access control. Use Jellyfin user
permissions to restrict content.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report bugs through
[GitHub issues](https://github.com/chrispydizzle/Rawi/issues), and follow
[SECURITY.md](SECURITY.md) for private vulnerability reports.

## License

Rawi's original code and assets use [Apache-2.0](LICENSE).
Bundled GSAP has **separate, non-Apache terms**; see
[third-party notices](THIRD_PARTY_NOTICES.md).
