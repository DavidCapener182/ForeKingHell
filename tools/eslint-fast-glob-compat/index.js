import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";
import { expand } from "brace-expansion";
const missing = (error) => error && (error.code === "ENOENT" || error.code === "ENOTDIR");
function directory(entry) {
  try {
    return fs.statSync(path.normalize(entry)).isDirectory();
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
  // Fail closed before matcher/expansion resource limits can silently truncate
  // discovered roots. A lint configuration must never turn into partial coverage.
  let braces = 0,
    depth = 0,
    groups = 0,
    escaped = false,
    characterClass = false;
  for (const char of pattern) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "[") characterClass = true;
    if (char === "]") characterClass = false;
    if (characterClass) continue;
    if (char === "{") {
      braces += 1;
      groups += 1;
    }
    if (char === "}") braces = Math.max(0, braces - 1);
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (braces > 128 || depth > 128 || groups > 128)
      throw new TypeError(
        "Directory-glob resource limit exceeded; simplify the lint root configuration.",
      );
  }
  if (pattern.length > 10_000)
    throw new TypeError(
      "Directory-glob resource limit exceeded; simplify the lint root configuration.",
    );
  const expanded = expand(pattern, {
    max: 10_001,
    maxLength: 1_010_000,
    maxDepth: 128,
    maxRewrites: 1000,
  });
  if (
    expanded.length > 10_000 ||
    expanded.reduce((sum, value) => sum + value.length, 0) > 1_000_000
  )
    throw new TypeError(
      "Directory-glob resource limit exceeded; simplify the lint root configuration.",
    );
  const matches = new Set();
  for (const original of expanded.filter(Boolean).sort((a, b) => a.length - b.length)) {
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
    const queue = [
      { entry: base, level: 0, ancestors: new Set([fs.realpathSync(path.normalize(base))]) },
    ];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      let children;
      try {
        children = fs.readdirSync(path.normalize(current.entry), { withFileTypes: true });
      } catch (error) {
        if (missing(error)) continue;
        throw error;
      }
      for (const child of children) {
        // fast-glob does not enter hidden directories unless a pattern segment
        // explicitly names them. Avoid traversing unmatched hidden symlinks too.
        if (
          child.name.startsWith(".") &&
          !value
            .split("/")
            .some(
              (segment) =>
                (segment.startsWith(".") || segment.startsWith("!(")) &&
                picomatch.isMatch(child.name, segment, { dot: true }),
            )
        )
          continue;
        const entry = (
          current.entry === "." ? child.name : `${current.entry}/${child.name}`
        ).replace(/^\.\//, "");
        if (!child.isDirectory() && !(child.isSymbolicLink() && directory(entry))) continue;
        if (accepts(entry)) matches.add(entry);
        if (current.level + 1 < depth) {
          const real = fs.realpathSync(path.normalize(entry));
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
