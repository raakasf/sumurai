import { readFile, writeFile } from "node:fs/promises";

const nextVersion = process.argv[2];

if (!nextVersion) {
  throw new Error("Usage: node scripts/sync-release-version.mjs <version>");
}

const updateJsonVersion = async (filePath) => {
  const contents = await readFile(filePath, "utf8");
  const parsed = JSON.parse(contents);
  parsed.version = nextVersion;
  if (parsed.packages && parsed.packages[""]) {
    parsed.packages[""].version = nextVersion;
  }
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
};

const updateCargoTomlRootPackageVersion = async (filePath, version) => {
  const lines = (await readFile(filePath, "utf8")).split("\n");
  let inRootPackage = false;
  const out = [];
  for (const line of lines) {
    if (/^\[package\]\s*$/.test(line)) {
      inRootPackage = true;
      out.push(line);
      continue;
    }
    if (/^\[/.test(line)) {
      inRootPackage = false;
      out.push(line);
      continue;
    }
    if (inRootPackage && /^version\s*=/.test(line)) {
      out.push(`version = "${version}"`);
      continue;
    }
    out.push(line);
  }
  await writeFile(filePath, `${out.join("\n")}\n`);
};

const updateCargoLockPackageVersion = async (filePath, crateName, version) => {
  const lines = (await readFile(filePath, "utf8")).split("\n");
  let matchBlock = false;
  const out = [];
  for (const line of lines) {
    if (line === "[[package]]") {
      matchBlock = false;
      out.push(line);
      continue;
    }
    const nameMatch = /^name = "([^"]*)"$/.exec(line);
    if (nameMatch) {
      matchBlock = nameMatch[1] === crateName;
      out.push(line);
      continue;
    }
    if (matchBlock && /^version = /.test(line)) {
      out.push(`version = "${version}"`);
      matchBlock = false;
      continue;
    }
    out.push(line);
  }
  await writeFile(filePath, `${out.join("\n")}\n`);
};

await updateJsonVersion("package.json");
await updateJsonVersion("package-lock.json");
await updateJsonVersion("frontend/package.json");
await updateJsonVersion("frontend/package-lock.json");
await updateCargoTomlRootPackageVersion("backend/Cargo.toml", nextVersion);
await updateCargoLockPackageVersion("backend/Cargo.lock", "sumurai-backend", nextVersion);
