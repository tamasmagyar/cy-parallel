// src/utils/fileUtils.ts
import fs from 'fs';
import path from 'path';

/**
 * Resolves and validates the directory path.
 * Exits the process if the directory is invalid.
 *
 * @param {string} dir - The directory path to validate.
 * @returns {string} - The resolved absolute directory path.
 */
export function validateDir(dir: string): string {
  const resolvedPath = path.resolve(dir);

  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      console.error(`Error: Provided DIR is not a directory: ${resolvedPath}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error accessing DIR directory: ${resolvedPath}`, err);
    process.exit(1);
  }

  return resolvedPath;
}

/**
 * Recursively collects all *.test.ts and *.test.tsx files from the given directory.
 * @param {string} dir - The directory path to search for test files.
 * @returns {string[]} - An array of test file paths ending with *.test.ts or *.test.tsx.
 */
export function getTestFiles(dir: string): string[] {
  let testFiles: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      testFiles = testFiles.concat(getTestFiles(fullPath));
    } else {
      testFiles.push(fullPath);
    }
  }

  return testFiles;
}

/**
 * Collects and validates test files based on the provided directory.
 * @param {string} directory - The directory path containing test files.
 * @returns {string[]} - An array of valid test file paths.
 */
export function collectTestFiles(directory: string): string[] {
  const testFiles: string[] = getTestFiles(directory);

  if (testFiles.length === 0) {
    console.error('No test files found in the provided DIR directory.');
    process.exit(1);
  }

  console.log(`\nFound ${testFiles.length} test files in '${directory}'.\n`);
  return testFiles;
}
