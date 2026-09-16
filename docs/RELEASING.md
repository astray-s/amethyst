# Releasing Amethyst

Amethyst is distributed as a signed APK through GitHub Releases. It is not
published through Google Play.

## Versioning

Once releases begin, use semantic version tags such as `v0.1.0`. Keep these values aligned:

- the public release tag;
- the package version;
- Android `versionName`;
- monotonically increasing Android `versionCode`;
- the changelog entry.

Do not create a release tag while those values disagree.

## Required release gates

A release candidate should not ship until:

- CI and dependency review pass;
- CodeQL passes once code scanning is available for the repository;
- web unit and browser tests pass;
- Android unit tests, lint, and release compilation pass;
- permission and privacy disclosures match the manifest and runtime behavior;
- Accessibility blocking and schedule restoration pass real-device tests;
- device-based score language clearly distinguishes estimates from measurements;
- asset provenance and third-party notices are current;
- the SBOM has been reviewed;
- signing, rollback, and key recovery have named maintainers and written procedures.

## Build a signed artifact

For the maintainer machine, store the PKCS#12 key outside the repository and
store its password in macOS Keychain under service `Amethyst Release Keystore`.
After committing the intended release and applying a matching semantic-version
tag, run:

```bash
./scripts/build-android-release.sh
```

The script refuses dirty, untagged, or version-mismatched source; runs the web
and Android release gates; reads the signing password from Keychain; and writes
the APK and SHA-256 checksum under `artifacts/releases/<tag>/`.

Release compilation fails when any signing variable is missing. There is no
debug-key fallback.

## Signing

The repository contains no keystore or password. The default maintainer setup
uses:

- key file: `~/Library/Application Support/Amethyst/signing/amethyst-release.p12`;
- alias: `amethyst-release`;
- password: macOS Keychain service `Amethyst Release Keystore`;
- encrypted/off-device backup: maintained separately from the repository.

For another build machine, provide all four values explicitly:

```bash
export AMETHYST_RELEASE_STORE_FILE="/absolute/path/to/amethyst-release.p12"
export AMETHYST_RELEASE_STORE_PASSWORD="..."
export AMETHYST_RELEASE_KEY_ALIAS="amethyst-release"
export AMETHYST_RELEASE_KEY_PASSWORD="..."
```

Then run the Android release build. Never place these values in a committed
file or shell history. Maintainers remain responsible for deciding:

- who owns and can recover the key;
- where the key and passwords are stored;
- which protected GitHub environment may access them;
- how release approval works;
- what happens if the key is lost or exposed.

Never commit a keystore, password, service-account file, or local signing configuration.

The SHA-256 checksum and signing-certificate fingerprint are safe to publish.
They let users confirm what they downloaded and whether two releases came from
the same signing identity. They cannot be used to reconstruct the private
signing key.

## SBOM

The SBOM workflow creates:

- a CycloneDX npm SBOM from the frozen dependency tree;
- an Android Gradle dependency report.

Generate the npm SBOM locally with:

```bash
npm ci
npm sbom --package-lock-only --sbom-format=cyclonedx > sbom.cdx.json
npm run build
npx cap sync android
cd android
./gradlew --no-daemon :app:dependencies > ../android-dependencies.txt
```

An SBOM is an inventory, not a vulnerability scan. Review it alongside dependency alerts and release notes.

## Release notes

Release notes should cover user-visible changes, permission or data-handling changes, known limitations, migration steps, and security fixes. Do not claim native functionality based only on a browser recording.

Attach the APK and `.sha256` file to a draft GitHub Release first. Verify both
downloads, the checksum, and the APK signature before publishing the release.

## Future release automation

A signed release workflow may be added after key management is approved. It should build from a protected tag, use least-privilege permissions, generate checksums and an SBOM, attest the artifact where supported, and require a human approval before publication.
