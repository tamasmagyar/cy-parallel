// #!/usr/bin/env node
import process from 'process';
import { validateDir, collectTestFiles } from './utils/fileUtils';
import { getFileInfo } from './utils/weightUtils';
import { runCypress } from './runners/cypressRunner';
import { runCypressSingle } from './runners/cypressSingleRunner';
import { FileInfo, CypressResult } from './types';
import { log } from './utils/logging';
import { getConfig } from './utils/envUtils';

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
    log('Error: filesInfo is not an array.', { type: 'error' });
    return [];
  }

  log(`Total Test Files Found: ${filesInfo.length}`, { type: 'info' });

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
    log(
      `Bucket ${idx + 1}: ${bucket.length} test files, weight: ${totalWeight}`,
      {
        type: 'info',
      }
    );
    bucket.forEach((test) => log(`  - ${test}`, { type: 'info' }));
  });

  return buckets;
}

/**
 * Main function to orchestrate parallel Cypress test execution.
 */
async function runParallelCypress(): Promise<void> {
  const {
    WEIGHT_PER_TEST,
    BASE_WEIGHT,
    WORKERS,
    DIR,
    COMMAND,
    POLL,
    BASE_DISPLAY_NUMBER,
  } = getConfig();

  // Validate and resolve DIR
  const resolvedDir: string = validateDir(DIR);

  // Step 1: Collect all test files in the specified directory
  const testFiles: string[] = collectTestFiles(resolvedDir);

  // Track the total number of tests for progress indication
  const totalTests = testFiles.length;
  let completedTests = 0;

  function logProgress() {
    if (completedTests >= totalTests) {
      return; // Skip logging if all tests are complete
    }
    const remainingTests = totalTests - completedTests;
    const progressPercentage = ((completedTests / totalTests) * 100).toFixed(2);
    log(
      `Progress: ${completedTests}/${totalTests} tests completed (${progressPercentage}% done). ${remainingTests} test file(s) remaining.`,
      { type: 'info' }
    );
  }

  if (!POLL) {
    // POLL=false: Weighted Bucketing Mode
    log('Running in Weighted Bucketing Mode.', { type: 'info' });
    const filesInfo: FileInfo[] = testFiles
      .map((file) => getFileInfo(file, BASE_WEIGHT, WEIGHT_PER_TEST))
      .filter((info): info is FileInfo => info !== null);

    const testBuckets: string[][] = getFileBucketsCustom(WORKERS, filesInfo);
    const promises: Promise<CypressResult>[] = testBuckets.map(
      async (bucket, index) => {
        if (bucket.length > 0) {
          const display = BASE_DISPLAY_NUMBER + index;
          log(
            `Starting Cypress process ${index + 1} with ${bucket.length} test file(s).`,
            {
              type: 'info',
              workerId: index + 1,
            }
          );
          const result = await runCypress(bucket, index, display, COMMAND);

          // Increment completed tests after the whole bucket completes
          completedTests += bucket.length;
          logProgress(); // Log progress here after bucket completion

          return result;
        }
        return Promise.resolve({ status: 'fulfilled', index });
      }
    );

    const results: CypressResult[] = await Promise.all(promises);

    let hasFailures = false;
    results.forEach((result) => {
      if (result.status === 'rejected') {
        hasFailures = true;
        log(`Worker ${result.index + 1} had at least one failed run.`, {
          type: 'error',
          workerId: result.index + 1,
        });
      } else {
        log(`Worker ${result.index + 1} completed all runs successfully.`, {
          type: 'info',
          workerId: result.index + 1,
        });
      }
    });

    if (hasFailures) {
      log('One or more workers failed.', { type: 'error' });
      process.exit(1);
    } else {
      log('All tests completed successfully.', { type: 'info' });
      process.exit(0);
    }
  } else {
    // POLL=true: Polling Mode
    log('Running in Polling Mode.', { type: 'info' });
    const queue: string[] = [...testFiles];
    const promises: Promise<CypressResult>[] = [];

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

        completedTests += 1;
        logProgress();

        if (result.status === 'rejected') {
          hasFailed = true;
        }
      }

      return {
        status: hasFailed ? 'rejected' : 'fulfilled',
        index: workerIndex,
        code: hasFailed ? 1 : 0,
      };
    };

    for (let i = 0; i < WORKERS; i++) {
      promises.push(worker(i));
    }

    const results: CypressResult[] = await Promise.all(promises);

    let hasFailures: boolean = false;
    results.forEach((result) => {
      log(`NEM TUDOM ${results}`, { type: 'error' });
      if (result.status === 'rejected') {
        hasFailures = true;
        log(`Worker ${result.index + 1} had at least one failed Cypress run.`, {
          type: 'error',
          workerId: result.index + 1,
        });
      } else {
        log(
          `Worker ${result.index + 1} completed all Cypress runs successfully.`,
          {
            type: 'info',
            workerId: result.index + 1,
          }
        );
      }
    });

    log('kaki', { type: 'info' });
    if (hasFailures) {
      log('fos', { type: 'error' });
      log('One or more Cypress workers failed.', { type: 'error' });
      process.exit(1);
    } else {
      log('lol', { type: 'error' });
      log('All Cypress tests completed successfully.', { type: 'info' });
      process.exit(0);
    }
  }
}

// Execute the script
runParallelCypress();
