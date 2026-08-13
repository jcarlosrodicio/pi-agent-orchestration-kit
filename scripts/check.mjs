import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.resolve(fileURLToPath(import.meta.url));
const required = ["agents", "chains", "extensions", "prompts", "roles", "skills", "runtime"];
const forbidden = [
  ["/", "Users", "/"].join(""), ["/", "home", "/"].join(""),
  ["nan", "web", "search"].join("-"), [["sear", "xng"].join(""), "local"].join("-"),
  ["memory", ["q", "drant"].join("")].join("-"), ["project", "memory", ["q", "drant"].join("")].join("-"),
  ["NAN", "API_KEY"].join("_"), ["QDRANT", "API_KEY"].join("_"),
  ["SEARXNG", "URL"].join("_"), ["juan", "canas"].join(""), ["syno", "logy"].join(""),
];

for (const relative of required) {
  await readdir(path.join(root, relative));
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      await walk(full);
    }
    else files.push(full);
  }
}
await walk(root);

for (const file of files) {
  if (file.includes(`${path.sep}.git${path.sep}`)) continue;
  if (path.resolve(file) === checker) continue;
  const content = await readFile(file, "utf8");
  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(`public package contains forbidden marker: ${marker}`);
    }
  }
}

console.log(`checked ${files.length} public package files`);
