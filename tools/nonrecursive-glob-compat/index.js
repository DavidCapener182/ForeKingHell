/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS compatibility required by existing tooling consumers; licensed scanner uses the same module format. */
"use strict";
const { Minimatch } = require("minimatch");
if (require("minimatch/package.json").version !== "11.0.9")
  throw new Error("Nonrecursive matcher requires minimatch 11.0.9");
const allowed = new Set([
  "dot",
  "nobrace",
  "nocase",
  "noextglob",
  "noglobstar",
  "posix",
  "matchBase",
  "ignore",
  "returnIndex",
]);
function translate(p, opts) {
  let out = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\") {
      out += c + (p[++i] || "");
      continue;
    }
    if (c === "[") {
      let j = i + 1;
      while (j < p.length) {
        if (p[j] === "[" && p[j + 1] === ":") {
          const end = p.indexOf(":]", j + 2);
          if (end >= 0) {
            j = end + 2;
            continue;
          }
        }
        if (p[j] === "]" && p[j - 1] !== "\\") break;
        j++;
      }
      if (j < p.length) {
        const group = p.slice(i, j + 1);
        const cls = group.startsWith("[!") && !opts.posix ? "[\\!" + group.slice(2) : group;
        out +=
          group.startsWith("[!") && opts.posix
            ? cls
            : "@(" + cls + "|" + group.replace(/[\\[\]()*?+@!|{}]/g, "\\$&") + ")";
        i = j;
        continue;
      }
    }
    if (c === "(" && (opts.noextglob || !["!", "?", "+", "*", "@"].includes(p[i - 1]))) out += "@";
    out += c;
  }
  return out;
}
function boundPattern(p, opts) {
  let brace = false,
    choices = 1,
    expansion = 1,
    depth = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === "\\") {
      i++;
      continue;
    }
    if (p[i] === "(" && ++depth > 32) throw new RangeError("Glob nesting exceeds 32");
    if (p[i] === ")") depth = Math.max(0, depth - 1);
    if (!opts.nobrace) {
      if (p[i] === "{") {
        if (brace) throw new RangeError("Nested brace expansion unsupported");
        brace = true;
        choices = 1;
      }
      if (brace && p[i] === ",") choices++;
      if (brace && p[i] === "." && p[i + 1] === ".")
        throw new RangeError("Brace ranges unsupported by bounded matcher");
      if (p[i] === "}" && brace) {
        expansion *= choices;
        brace = false;
        if (expansion > 256) throw new RangeError("Brace expansion exceeds 256");
      }
    }
  }
  return expansion;
}
function matcher(pattern, opts = {}, skipLiteral = false) {
  for (const key of Object.keys(opts))
    if (!allowed.has(key)) throw new TypeError("Unsupported glob option: " + key);
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  if (patterns.length > 256) throw new RangeError("Too many glob patterns");
  const compiled = patterns.map((p) => {
    if (typeof p !== "string" || !p || p.length > 4096)
      throw new TypeError("Expected non-empty glob of at most 4096 characters");
    if (opts.posix === false && p.includes("[[:"))
      throw new TypeError("POSIX classes with posix:false unsupported");
    const expansion = boundPattern(p, opts);
    let n = 0;
    while (p[n] === "!" && (opts.noextglob || p[n + 1] !== "(")) n++;
    let value = p.slice(n).replace(/^\.\//, "");
    const translated = translate(value, opts);
    const segments = value.split("/");
    const negativeDot = segments.some((s) => s.startsWith("!("));
    if (negativeDot && segments.some((s) => s === "**"))
      throw new TypeError("Negative extglob with globstar unsupported");
    const variants = [translated];
    if (!opts.noglobstar) {
      let base = translated;
      while (base.endsWith("/**")) {
        base = base.slice(0, -3);
        if (base) variants.push(base);
      }
    }
    const mm = variants.map(
      (pattern) =>
        new Minimatch(pattern, {
          dot: opts.dot || value.split("/").some((s) => s.startsWith("!(")),
          nobrace: opts.nobrace,
          nocase: opts.nocase,
          noext: false,
          noglobstar: opts.noglobstar,
          matchBase: opts.matchBase,
          nonegate: true,
          nocomment: true,
          preserveMultipleSlashes: true,
          optimizationLevel: 0,
        }),
    );
    return {
      p,
      value,
      mm,
      segments,
      negativeDot,
      cost: p.length * expansion * variants.length,
      negate: n % 2 === 1,
    };
  });
  const ignore = opts.ignore ? matcher(opts.ignore, { ...opts, ignore: undefined }) : null;
  return (input) => {
    if (typeof input !== "string") throw new TypeError("Expected string input");
    if (input.length > 65536) throw new RangeError("Glob input too long");
    if (compiled.reduce((sum, p) => sum + p.cost, 0) * Math.max(1, input.length) > 10_000_000)
      throw new RangeError("Glob matching work budget exceeded");
    if (!input || ignore?.(input)) return false;
    return compiled.some(({ p, value, mm, segments, negativeDot, negate }) => {
      if (!skipLiteral && p === input) return true;
      let matches = mm.some((pattern) => pattern.match(input));
      if (
        !opts.dot &&
        negativeDot &&
        input
          .split("/")
          .some(
            (part, i) =>
              part.startsWith(".") &&
              !segments[i]?.startsWith(".") &&
              !segments[i]?.startsWith("!("),
          )
      )
        matches = false;
      if (input.endsWith("/") && !value.endsWith("/") && !value.endsWith("*")) matches = false;
      return negate ? !matches : matches;
    });
  };
}
matcher.isMatch = (input, p, opts) => matcher(p, opts)(input);
matcher.directoryMatcher = (p, opts) => matcher(p, opts, true);
const scan = require("./lib/scan");
matcher.scan = (input, opts) => {
  if (typeof input !== "string" || input.length > 4096)
    throw new TypeError("Expected scan input of at most 4096 characters");
  return scan(input, opts);
};
matcher.makeRe = () => {
  throw new TypeError("Nonrecursive glob adapter cannot generate RegExp; use matcher function");
};
module.exports = matcher;
