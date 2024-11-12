// src/index.ts
import os from 'os';
import process from 'process';
import { validateDir, collectTestFiles } from './utils/fileUtils.js';
import { getFileInfo } from './utils/weightUtils.js';
import { runCypress } from './runners/cypressRunner.js';
import { runCypressSingle } from './runners/cypressSingleRunner.js';
import { FileInfo, CypressResult } from './types';

/**
 * Distributes test files into buckets to balance the total weight of each bucket.
 * @param {number} bucketsCount - The number of buckets to distribute files into.
 * @param {FileInfo[]} filesInfo - Array of file information with weights.
 * @returns {string[][]} - An array of buckets containing file paths.
 */
function getFileBucketsCustom(
  bucketsCount: number,
  filesInfo: FileInfo[]
): string[][] {
  if (!Array.isArray(filesInfo)) {
    console.error('Error: filesInfo is not an array.');
    return [];
  }

  console.log(`\nTotal Test Files Found: ${filesInfo.length}\n`);

  // Sort files by descending weight (heaviest first)
  const sortedFiles = filesInfo.sort((a, b) => b.weight - a.weight);

  // Initialize buckets
  const buckets = Array.from({ length: bucketsCount }, () => [] as string[]);
  const bucketWeights = Array(bucketsCount).fill(0);

  // Distribute files into buckets to balance total weights
  for (const fileInfo of sortedFiles) {
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
}

/**
 * Main function to orchestrate parallel Cypress test execution.
 */
async function runParallelCypress(): Promise<void> {
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

  // Base display number for Xvfb
  const BASE_DISPLAY_NUMBER: number = process.env.BASE_DISPLAY_NUMBER
    ? parseInt(process.env.BASE_DISPLAY_NUMBER, 10)
    : 99;

  // Validate and resolve DIR
  const resolvedDir: string = validateDir(DIR);

  // Step 1: Collect all test files in the specified directory
  const testFiles: string[] = collectTestFiles(resolvedDir);

  if (!POLL) {
    // POLL=false: Weighted Bucketing Mode
    console.log('Running in Weighted Bucketing Mode.\n');
    // Step 2: Calculate weights for each test file
    const filesInfo: FileInfo[] = testFiles
      .map((file) => getFileInfo(file, BASE_WEIGHT, WEIGHT_PER_TEST))
      .filter((info): info is FileInfo => info !== null);

    // Step 3: Split test files into WORKERS buckets based on test counts for balanced execution
    const testBuckets: string[][] = getFileBucketsCustom(WORKERS, filesInfo);
    const promises: Promise<CypressResult>[] = testBuckets.map(
      (bucket, index) => {
        if (bucket.length > 0) {
          const display = BASE_DISPLAY_NUMBER + index;
          return runCypress(bucket, index, display, COMMAND);
        }
        return Promise.resolve({ status: 'fulfilled', index });
      }
    );

    const results: CypressResult[] = await Promise.all(promises);

    let hasFailures: boolean = false;
    results.forEach((result) => {
      if (result.status === 'rejected') {
        hasFailures = true;
        console.error(
          `\nCypress process ${result.index + 1} failed with exit code ${result.code}.\n`
        );
      } else {
        console.log(`\nCypress process ${result.index + 1} succeeded.\n`);
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
    const queue: string[] = [...testFiles];
    const promises: Promise<CypressResult>[] = [];

    /**
     * Worker function that picks up test files from the queue and runs them.
     * Each worker uses a unique display number.
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

        const display = BASE_DISPLAY_NUMBER + workerIndex;
        const result = await runCypressSingle(
          test,
          workerIndex,
          display,
          COMMAND
        );
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

    const results: CypressResult[] = await Promise.all(promises);

    let hasFailures: boolean = false;
    results.forEach((result) => {
      if (result.status === 'rejected') {
        hasFailures = true;
        console.error(
          `\nWorker ${result.index + 1} had at least one failed Cypress run.\n`
        );
      } else {
        console.log(
          `\nWorker ${result.index + 1} completed all Cypress runs successfully.\n`
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
