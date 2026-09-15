#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "${repo_root}"

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( node_major < 24 )); then
  echo "Release builds require Node.js 24 or newer; found $(node --version)." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Release builds require a clean working tree." >&2
  exit 1
fi

release_tag="$(git describe --exact-match --tags HEAD 2>/dev/null || true)"
if [[ ! "${release_tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Release builds require HEAD to have a version tag such as v1.0.0." >&2
  exit 1
fi

release_version="${release_tag#v}"
package_version="$(node -p "require('./package.json').version")"
android_version="$(
  sed -n 's/^[[:space:]]*versionName[[:space:]]*"\([^"]*\)".*/\1/p' \
    android/app/build.gradle \
    | head -n 1
)"
if [[ "${package_version}" != "${release_version}" || "${android_version}" != "${release_version}" ]]; then
  echo "Release tag, package version, and Android versionName must match." >&2
  echo "tag=${release_version} package=${package_version} android=${android_version}" >&2
  exit 1
fi

default_store_file="${HOME}/Library/Application Support/Amethyst/signing/amethyst-release.p12"
export AMETHYST_RELEASE_STORE_FILE="${AMETHYST_RELEASE_STORE_FILE:-${default_store_file}}"
export AMETHYST_RELEASE_KEY_ALIAS="${AMETHYST_RELEASE_KEY_ALIAS:-amethyst-release}"

if [[ -z "${AMETHYST_RELEASE_STORE_PASSWORD:-}" ]] && command -v security >/dev/null 2>&1; then
  AMETHYST_RELEASE_STORE_PASSWORD="$(
    security find-generic-password \
      -a "$(id -un)" \
      -s "Amethyst Release Keystore" \
      -w
  )"
  export AMETHYST_RELEASE_STORE_PASSWORD
fi
export AMETHYST_RELEASE_KEY_PASSWORD="${AMETHYST_RELEASE_KEY_PASSWORD:-${AMETHYST_RELEASE_STORE_PASSWORD:-}}"

if [[ ! -f "${AMETHYST_RELEASE_STORE_FILE}" ]]; then
  echo "Release keystore not found: ${AMETHYST_RELEASE_STORE_FILE}" >&2
  exit 1
fi
if [[ -z "${AMETHYST_RELEASE_STORE_PASSWORD:-}" || -z "${AMETHYST_RELEASE_KEY_PASSWORD:-}" ]]; then
  echo "Release signing passwords are unavailable." >&2
  exit 1
fi

npm ci
npm test
npm run test:e2e
npm run build
npm run lint
npx cap sync android
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}" \
ANDROID_HOME="${ANDROID_HOME:-${HOME}/Library/Android/sdk}" \
  ./android/gradlew -p android clean testDebugUnitTest lintDebug assembleRelease

release_dir="${repo_root}/artifacts/releases/${release_tag}"
release_apk="${release_dir}/amethyst-${release_tag}.apk"
mkdir -p "${release_dir}"
cp android/app/build/outputs/apk/release/app-release.apk "${release_apk}"
(
  cd "${release_dir}"
  shasum -a 256 "$(basename "${release_apk}")" > "$(basename "${release_apk}").sha256"
)

echo "Created ${release_apk}"
echo "Created ${release_apk}.sha256"
