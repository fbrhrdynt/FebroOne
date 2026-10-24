#!/usr/bin/env bash
set -euo pipefail
cd /opt/febro-one
# Isolated runtime: does not replace the VPS Node.js used by other applications.
version="${FEBRO_NODE_VERSION:-v24.19.0}"
case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) echo 'Unsupported CPU architecture'; exit 1;; esac
[[ "$version" =~ ^v24\.[0-9]+\.[0-9]+$ ]] || { echo 'Use a Node 24 version'; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
archive="node-${version}-linux-${arch}.tar.xz"
curl --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/${version}/${archive}" -o "$tmp/$archive"
curl --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/${version}/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
(cd "$tmp" && awk -v name="$archive" '$2==name { print }' SHASUMS256.txt | sha256sum --check --strict)
mkdir -p runtime/node
[[ ! -e runtime/node/bin/node ]] || { echo 'Runtime already exists; refusing overwrite'; exit 1; }
tar -xJf "$tmp/$archive" -C runtime/node --strip-components=1
runtime/node/bin/node --version
