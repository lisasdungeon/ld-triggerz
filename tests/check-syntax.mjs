// Syntax-checks every shipped .js/.mjs file with `node --check`, so a broken
// file is caught before it ever reaches a Foundry world.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'zips', 'tests']);

function collectJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...collectJsFiles(path.join(dir, entry.name)));
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function checkSyntax() {
  const files = collectJsFiles(projectRoot);
  const failures = [];

  for (const file of files) {
    try {
      execFileSync('node', ['--check', file], { stdio: 'pipe' });
    } catch (error) {
      failures.push({ file: path.relative(projectRoot, file), message: error.stderr?.toString() ?? error.message });
    }
  }

  if (failures.length > 0) {
    console.error(`Syntax check failed for ${failures.length} file(s):`);
    for (const failure of failures) {
      console.error(`  - ${failure.file}\n${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Syntax check passed for ${files.length} file(s).`);
}

checkSyntax();
