import fs from "fs";
import path from "path";

const root = process.cwd();
const out = path.join(root, "dist");

function copy(srcRelative, destName) {
  const src = path.join(root, srcRelative);
  const dest = path.join(out, destName);
  if (!fs.existsSync(src)) {
    console.warn("Source not found:", src);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log("Copied", srcRelative, "->", destName);
}

if (!fs.existsSync(out)) {
  console.error("dist folder not found. Run `vite build` first.");
  process.exit(1);
}

copy("src/background/background.js", "background.js");
copy("src/content/content.js", "content.js");

console.log("Copy complete.");
