import fs from "node:fs";
import picomatch from "picomatch";
import { expand } from "brace-expansion";
const missing = (error) => error && (error.code === "ENOENT" || error.code === "ENOTDIR");
function directory(entry) {
  try {
    return fs.statSync(entry).isDirectory();
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}

// The only API consumed by pinned Next ESLint's get-root-dirs. This is not a
// general fast-glob replacement. New options/callers must fail for review.
export function globSync(pattern, options) {
  if (
    typeof pattern !== "string" ||
    !options ||
    options.onlyDirectories !== true ||
    Object.keys(options).some((key) => key !== "onlyDirectories")
  )
    throw new TypeError(
      "Next ESLint directory-glob contract changed; review the compatibility adapter before upgrading.",
    );
  const matches = new Set();
  for (const original of expand(pattern)
    .filter(Boolean)
    .sort((a, b) => a.length - b.length)) {
    const value = original.replace(/(?!^)\/{2,}/g, "/");
    if (value.startsWith("!") && !value.startsWith("!(")) continue;
    const regex = picomatch.makeRe(value, { dot: false, posix: true, strictSlashes: false });
    const accepts = (entry) =>
      regex.test(entry.replace(/^\.\//, "")) || regex.test(`${entry.replace(/^\.\//, "")}/`);
    const dynamic = /[*?]|\[[^[]*\]|(?:^|[^!*+?@])\([^(]*\|[^|]*\)|[!*+?@]\([^(]*\)|\\/.test(value);
    if (!dynamic) {
      if (directory(value) && accepts(value)) matches.add(value);
      continue;
    }
    const scan = picomatch.scan(value, { parts: true, scanToEnd: true });
    const base = scan.base || ".";
    if (!directory(base)) continue;
    const depth = value.includes("**")
      ? Infinity
      : Math.max(
          1,
          value
            .slice(base === "." ? 0 : base.length)
            .split("/")
            .filter(Boolean).length,
        );
    const queue = [{ entry: base, level: 0, ancestors: new Set([fs.realpathSync(base)]) }];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      let children;
      try {
        children = fs.readdirSync(current.entry, { withFileTypes: true });
      } catch (error) {
        if (missing(error)) continue;
        throw error;
      }
      for (const child of children) {
        const entry = (
          current.entry === "." ? child.name : `${current.entry}/${child.name}`
        ).replace(/^\.\//, "");
        if (!child.isDirectory() && !(child.isSymbolicLink() && directory(entry))) continue;
        if (accepts(entry)) matches.add(entry);
        if (current.level + 1 < depth) {
          const real = fs.realpathSync(entry);
          if (current.ancestors.has(real))
            throw new Error(
              "Cyclic directory symlink in Next ESLint rootDir; resolve it before linting.",
            );
          queue.push({
            entry,
            level: current.level + 1,
            ancestors: new Set([...current.ancestors, real]),
          });
        }
      }
    }
  }
  return [...matches];
}
