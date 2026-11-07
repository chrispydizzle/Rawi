# Security policy

## Supported versions

Security fixes target the latest code on `main`. Older snapshots and TV
firmware are not maintained by this project.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting through **Security > Report a
vulnerability**:

<https://github.com/chrispydizzle/Rawi/security/advisories/new>

If that option is unavailable, open an issue asking the maintainer for a
private reporting channel **without including vulnerability details**.
Do not post exploit details, credentials, or personal data in public issues
or pull requests.

Include the affected revision, reproduction steps using synthetic data, the
expected impact, and the relevant TV/browser/Jellyfin versions. This is a
personal project; no guaranteed response time is offered.

## Security boundaries

Rawi connects to the Jellyfin server you enter and stores its authenticated
session in Tizen preferences or browser localStorage. Treat the TV/browser
profile as an authenticated client. Sign out on shared devices and revoke
the Jellyfin token if a device or browser profile is compromised.

Use HTTPS when your server and TV support it. Plain HTTP does not protect
session credentials or media in transit; use it only on a network you trust.
Do not expose the development preview server to the internet.

Storybook Mode, selected libraries, and the Adult/Storybook toggle are not
access controls. Enforce content permissions on the Jellyfin user account.
Local copy overrides are trusted executable JavaScript, not untrusted input.

Keep Tizen signing keys and certificate passwords outside the repository.
The repository's ignore rules reduce accidental inclusion but are not a
substitute for reviewing commits and release artifacts.
