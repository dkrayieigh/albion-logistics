import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return collectTestFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.test.js') ? [fullPath] : [];
    })
  );
  return files.flat();
}

const testFiles = (await collectTestFiles('tests'))
  .map((file) => relative(process.cwd(), file))
  .sort();

if (testFiles.length === 0) {
  console.error('No test files found under tests/**/*.test.js');
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ['--test', ...testFiles], {
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`Test process terminated by ${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}
