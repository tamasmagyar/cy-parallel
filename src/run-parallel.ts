import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import ts from 'typescript';

// Constants for weight calculation
const WEIGHT_PER_TEST: number = process.env.WEIGHT_PER_TEST
  ? parseInt(process.env.WEIGHT_PER_TEST, 10)
  : 1;
const BASE_WEIGHT: number = process.env.BASE_WEIGHT
  ? parseInt(process.env.BASE_WEIGHT, 10)
  : 1;

// Environment Variables
const maxCpuCores: number = os.cpus().length;
const WORKERS: number = Math.min(
  process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : maxCpuCores,
  maxCpuCores
);
const DIR: string = process.env.DIR ? process.env.DIR : 'cypress/e2e';
const COMMAND: string = process.env.COMMAND
  ? process.env.COMMAND
  : 'npx cypress run';
const POLL: boolean = process.env.POLL === 'true';

/**
 * Resolves and validates the directory path.
 * Defaults to 'cypress/e2e' if DIR is not provided.
 * Exits the process if the directory is invalid.
 *
 * @param {string} dir - The directory path to validate.
 * @returns {string} - The resolved absolute directory path.
 */
function validateDir(dir: string): string {
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
function getTestFiles(dir: string): string[] {
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
 * Checks if a node represents a call to a testific method.
 * @param {ts.Node} node - The node to check.
 * @param {string|null} objectName - The object name (e.g., 'describe') or null if not applicable.
 * @param {string} methodName - The method name (e.g., 'it', 'skip').
 * @returns {boolean} - True if the node is a call to the testified method.
 */
const isCallTo = (
  node: ts.Node,
  objectName: string | null,
  methodName: string
): boolean => {
  if (ts.isCallExpression(node) && node.expression) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const { expression, name } = node.expression;
      const objName = expression.getText();
      const method = name.getText();
      return objName === objectName && method === methodName;
    } else if (ts.isIdentifier(node.expression)) {
      const method = node.expression.getText();
      return objectName === null && method === methodName;
    }
  }
  return false;
};

/**
 * Calculates the weight of a test file based on the number of active (non-skipped) 'it' blocks.
 * Accounts for skipped 'describe' blocks and nested structures.
 * @param {string} filePath - The path to the test file.
 * @returns {Object|null} - An object containing the file path and its weight, or null if an error occurs.
 */
export const getFileInfo = (
  filePath: string
): { file: string; weight: number } | null => {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');

    let testCount = 0;
    const skippedDescribeStack: boolean[] = [];

    // Parse the file using TypeScript
    const sourceFile = ts.createSourceFile(
      filePath,
      contents,
      ts.ScriptTarget.Latest,
      true
    );

    // Traverse the AST
    const visit = (node: ts.Node) => {
      let isEnteringDescribe = false;

      if (ts.isCallExpression(node)) {
        // Check for 'describe.skip' and 'describe'
        if (isCallTo(node, 'describe', 'skip')) {
          skippedDescribeStack.push(true); // Entering a skipped describe
          isEnteringDescribe = true;
        } else if (isCallTo(node, null, 'describe')) {
          skippedDescribeStack.push(false); // Entering a regular describe
          isEnteringDescribe = true;
        }

        // Check for 'it.skip' and 'it'
        if (isCallTo(node, null, 'it.skip') || isCallTo(node, null, 'it')) {
          const isSkippedIt = isCallTo(node, null, 'it.skip');
          const isSkipped = skippedDescribeStack.includes(true) || isSkippedIt;
          if (!isSkipped) {
            testCount += 1; // Count active test cases
          }
        }
      }

      // Recursively visit children nodes
      ts.forEachChild(node, visit);

      // Pop from the stack when leaving a 'describe' block
      if (isEnteringDescribe) {
        skippedDescribeStack.pop();
      }
    };

    ts.forEachChild(sourceFile, visit);

    // Calculate the total weight, including the base weight if there are active tests
    const weight =
      testCount > 0 ? BASE_WEIGHT + WEIGHT_PER_TEST * testCount : BASE_WEIGHT;

    return {
      file: filePath,
      weight,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error}`);
    return null;
  }
};

/**
 * Collects and validates test files based on the provided directory.
 * @param {string} directory - The directory path containing test files.
 * @returns {string[]} - An array of valid test file paths.
 */
function collectTestFiles(directory: string): string[] {
  // Use the custom gettestFiles function to find test files
  const testFiles: string[] = getTestFiles(directory);

  if (testFiles.length === 0) {
    console.error('No test files found in the provided DIR directory.');
    process.exit(1);
  }

  console.log(`\nFound ${testFiles.length} test files in '${directory}'.\n`);
  return testFiles;
}

/**
 * Distributes test files into buckets to balance the total weight of each bucket.
 * @param {number} bucketsCount - The number of buckets to distribute files into.
 * @param {string[]} testFiles - Array of test file paths.
 * @returns {string[][]} - An array of buckets containing file paths.
 */
export const getFileBuckets = (
  bucketsCount: number,
  testFiles: string[]
): string[][] => {
  if (!Array.isArray(testFiles)) {
    console.error('Error: testFiles is not an array.');
    return [];
  }

  console.log(`\nTotal Test Files Found: ${testFiles.length}\n`);

  const filesInfo = testFiles
    .map(getFileInfo)
    .filter((info): info is { file: string; weight: number } => info !== null)
    .sort((a, b) => b.weight - a.weight); // Sort files by descending weight (heaviest first)

  // Initialize buckets
  const buckets = Array.from({ length: bucketsCount }, () => [] as string[]);
  const bucketWeights = Array(bucketsCount).fill(0);

  // Distribute files into buckets to balance total weights
  for (const fileInfo of filesInfo) {
    // Find the bucket with the least total weight
    let minIndex = 0;
    for (let i = 1; i < bucketsCount; i++) {
      if (bucketWeights[i] < bucketWeights[minIndex]) {
        minIndex = i;
      }
    }

    buckets[minIndex].push(fileInfo.file);
    bucketWeights[minIndex] += fileInfo.weight;
  }

  // Log the distribution
  buckets.forEach((bucket, idx) => {
    const totalWeight = bucket.reduce(
      (acc, file) =>
        acc + (filesInfo.find((f) => f.file === file)?.weight || 0),
      0
    );
    console.log(
      `\nBucket ${idx + 1}: ${bucket.length} test files, weight: ${totalWeight}`
    );
    bucket.forEach((test) => console.log(`  - ${test}`));
  });

  return buckets;
};

/**
 * Runs the Cypress command for a given set of test files with a unique display.
 * @param {string[]} tests - Array of test file paths.
 * @param {number} index - Index of the parallel process.
 * @returns {Promise<CypressResult>}
 */
function runCypress(tests: string[], index: number): Promise<CypressResult> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env };

    const testList: string = tests.join(',');
    const command: string = `FORCE_COLOR=1 ${COMMAND} --spec "${testList}"`;
    console.log(
      `\nStarting Cypress process ${index + 1} for the following tests:\n${testList}\n`
    );

    const cypressProcess = spawn(command, {
      shell: true,
      env: env,
      stdio: 'inherit', // This will directly pipe the output to the terminal in real-time
    });

    // Handle Cypress process completion
    cypressProcess.on('close', (code: number) => {
      if (code !== 0) {
        console.error(
          `\nCypress process ${index + 1} failed with exit code ${code}.\n`
        );
        resolve({ status: 'rejected', index, code });
      } else {
        console.log(`\nCypress process ${index + 1} completed successfully.\n`);
        resolve({ status: 'fulfilled', index, code });
      }
    });

    // Handle errors during spawning
    cypressProcess.on('error', (err: Error) => {
      console.error(
        `\nCypress process ${index + 1} encountered an error.\n`,
        err
      );
      resolve({ status: 'rejected', index });
    });
  });
}

interface CypressResult {
  status: 'fulfilled' | 'rejected';
  index: number;
  code?: number;
}

/**
 * Runs a single Cypress test file.
 * @param {string} test - The test file path.
 * @param {number} index - The worker index.
 * @returns {Promise<CypressResult>}
 */
function runCypressSingle(test: string, index: number): Promise<CypressResult> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env };

    const command: string = `FORCE_COLOR=1 ${COMMAND} --spec "${test}"`;
    console.log(`\nWorker ${index + 1} starting Cypress for test:\n${test}\n`);

    const cypressProcess = spawn(command, {
      shell: true,
      env: env,
      stdio: 'inherit',
    });

    cypressProcess.on('close', (code: number) => {
      if (code !== 0) {
        console.error(
          `\nWorker ${index + 1} Cypress failed with exit code ${code}.\n`
        );
        resolve({ status: 'rejected', index, code });
      } else {
        console.log(`\nWorker ${index + 1} Cypress completed successfully.\n`);
        resolve({ status: 'fulfilled', index, code });
      }
    });

    cypressProcess.on('error', (err: Error) => {
      console.error(
        `\nWorker ${index + 1} Cypress encountered an error.\n`,
        err
      );
      resolve({ status: 'rejected', index });
    });
  });
}

/**
 * Main function to orchestrate parallel Cypress test execution.
 */
async function runParallelCypress(): Promise<void> {
  // Validate and resolve DIR
  const resolvedDir: string = validateDir(DIR);

  // Step 1: Collect all test files in the testified directory
  const testFiles: string[] = collectTestFiles(resolvedDir);

  if (!POLL) {
    // POLL=false: Weighted Bucketing Mode
    console.log('Running in Weighted Bucketing Mode.\n');
    // Step 2: Split test files into WORKERS buckets based on test counts for balanced execution
    const testBuckets: string[][] = getFileBuckets(WORKERS, testFiles);
    const promises: Promise<CypressResult>[] = [];

    // Step 3: Start Cypress processes in parallel for each bucket
    testBuckets.forEach((bucket, index) => {
      if (bucket.length > 0) {
        promises.push(runCypress(bucket, index));
      }
    });

    const results: PromiseSettledResult<CypressResult>[] =
      await Promise.allSettled(promises);

    let hasFailures: boolean = false;
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value.status === 'rejected') {
          hasFailures = true;
          console.error(
            `\nCypress process ${value.index + 1} failed with exit code ${value.code}.\n`
          );
        } else {
          console.log(`\nCypress process ${value.index + 1} succeeded.\n`);
        }
      } else {
        hasFailures = true;
        console.error(
          `\nCypress process encountered an unexpected error.\n`,
          result.reason
        );
      }
    });

    if (hasFailures) {
      console.error('\nOne or more Cypress processes failed.\n');
      process.exit(1);
    } else {
      console.log('\nAll Cypress tests completed successfully.\n');
      process.exit(0);
    }
  } else {
    // POLL=true: Polling Mode
    console.log('Running in Polling Mode.\n');
    const queue = [...testFiles];
    const promises: Promise<CypressResult>[] = [];

    /**
     * Worker function that picks up test files from the queue and runs them.
     * @param {number} workerIndex - The index of the worker.
     * @returns {Promise<CypressResult>}
     */
    const worker = async (workerIndex: number): Promise<CypressResult> => {
      let hasFailed = false;

      while (true) {
        let test: string | undefined;

        // Synchronize access to the queue
        if (queue.length > 0) {
          test = queue.shift();
        }

        if (!test) {
          break; // Queue is empty
        }

        const result = await runCypressSingle(test, workerIndex);
        if (result.status === 'rejected') {
          hasFailed = true;
          // Optionally, handle individual test failures here
          // For now, just log and continue
        }
      }

      return {
        status: hasFailed ? 'rejected' : 'fulfilled',
        index: workerIndex,
        code: hasFailed ? 1 : 0,
      };
    };

    // Start WORKERS number of workers
    for (let i = 0; i < WORKERS; i++) {
      promises.push(worker(i));
    }

    const results = await Promise.allSettled(promises);

    let hasFailures: boolean = false;
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value.status === 'rejected') {
          hasFailures = true;
          console.error(
            `\nWorker ${value.index + 1} had at least one failed Cypress run.\n`
          );
        } else {
          console.log(
            `\nWorker ${value.index + 1} completed all Cypress runs successfully.\n`
          );
        }
      } else {
        hasFailures = true;
        console.error(
          `\nA worker encountered an unexpected error.\n`,
          result.reason
        );
      }
    });

    if (hasFailures) {
      console.error('\nOne or more Cypress workers failed.\n');
      process.exit(1);
    } else {
      console.log('\nAll Cypress tests completed successfully.\n');
      process.exit(0);
    }
  }
}

// Execute the script
runParallelCypress();
