import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!pkg.dependencies["@simplewebauthn/server"]) throw new Error("Missing WebAuthn dependency");
execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { stdio: "inherit" });
console.log("package-lock.json synchronized");
