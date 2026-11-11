/**
 * Fail when a JSX file uses a component it never imported or defined.
 *
 * eslint cannot catch this: a JSX tag is a JSXIdentifier, not an Identifier, so
 * `no-undef` never sees it. The build does not catch it either — Vite only fails
 * at runtime, which surfaces as a white screen.
 *
 * Approach: let esbuild turn JSX into explicit `__h(Tag, ...)` calls, then check
 * every capitalised tag against the file's imports and local declarations.
 *
 * Usage: node scripts/check-jsx-imports.mjs [paths...]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { transformSync } from "esbuild";

const ROOTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["src"];

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

function walk(dir, files = []) {
  if (!statSync(dir).isDirectory()) {
    files.push(dir);
    return files;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(jsx|js)$/.test(entry)) files.push(full);
  }
  return files;
}

/** Names the file imports, binds locally, or receives as props/params. */
function declaredNames(source) {
  const names = new Set();

  // import X, { A, B as C } from "..."
  for (const match of source.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["']/g)) {
    const clause = match[1];
    for (const part of clause.matchAll(/([A-Za-z_$][\w$]*)/g)) names.add(part[1]);
  }

  // const/let/var/function/class declarations
  for (const match of source.matchAll(
    /(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(match[1]);
  }

  // destructured props: ({ children, Foo }) => ...
  for (const match of source.matchAll(/\(\s*\{([^}]*)\}\s*\)\s*=>/g)) {
    for (const part of match[1].matchAll(/([A-Za-z_$][\w$]*)/g)) names.add(part[1]);
  }

  // destructured bindings: const { Toolbar } = plugin(...)
  for (const match of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const part of match[1].matchAll(/([A-Za-z_$][\w$]*)/g)) names.add(part[1]);
  }

  return names;
}

let failures = 0;
let checked = 0;

for (const file of ROOTS.flatMap((root) => walk(root))) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("<") || !/\.jsx$|\/jsx/.test(file + (source.includes("jsx") ? "/jsx" : ""))) {
    try {
      transformSync(source, { loader: "jsx" });
    } catch {
      continue;
    }
  }

  let output;
  try {
    output = transformSync(source, {
      loader: "jsx",
      jsx: "transform",
      jsxFactory: "__h",
      jsxFragment: "__F",
    }).code;
  } catch (error) {
    console.log(`${file}: could not parse — ${error.message}`);
    failures += 1;
    continue;
  }

  const declared = declaredNames(source);
  const seen = new Set();

  // JSX elements compile to __h(Tag, ...). Lowercase tags are DOM elements.
  for (const match of output.matchAll(/__h\(([A-Za-z_$][\w$]*)/g)) {
    const tag = match[1];
    if (!/^[A-Z]/.test(tag)) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    if (declared.has(tag)) continue;

    // Built-in JSX factory passthroughs are never elements.
    if (tag === "__F") continue;

    console.log(`${relative(process.cwd(), file)}: <${tag}> is used but not imported or defined`);
    failures += 1;
  }

  checked += 1;
}

console.log(`\nChecked ${checked} file(s); ${failures} undefined JSX component(s).`);
process.exit(failures > 0 ? 1 : 0);
