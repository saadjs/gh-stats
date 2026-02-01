import fs from "node:fs";
import path from "node:path";

const cliPath = path.resolve("dist/cli.js");

if (!fs.existsSync(cliPath)) {
  console.warn("dist/cli.js not found; skipping chmod.");
  process.exit(0);
}

const currentMode = fs.statSync(cliPath).mode & 0o777;

if ((currentMode & 0o111) !== 0o111) {
  fs.chmodSync(cliPath, 0o755);
  console.log("Set executable bit on dist/cli.js");
}
