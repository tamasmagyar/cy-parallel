import process from 'process';
import { validateDir, collectTestFiles } from './utils/fileUtils';
import { getFileInfo } from './utils/weightUtils';
import { runCypress } from './runners/cypressRunner';
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
      `Bucket ${idx + 1}: ${bucket.length} test file(s), weight: ${totalWeight}`,
      {
        type: 'info',
      }
    );
    bucket.forEach((test) => log(`  - ${test}`, { type: 'info' }));
  });

  return buckets;
}

/**
 * Helper function to create CypressResult objects.
 * @param status - 'fulfilled' or 'rejected'
 * @param index - Worker index
 * @param code - Optional exit code
 * @returns {CypressResult}
 */
function createCypressResult(
  status: 'fulfilled' | 'rejected',
  index: number,
  code?: number
): CypressResult {
  return { status, index, code };
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

  const resolvedDir: string = validateDir(DIR);
  const testFiles: string[] = collectTestFiles(resolvedDir);
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

  if (totalTests === 0) {
    log('No test files found. Exiting.', { type: 'info' });
    process.exit(0);
  }

  if (!POLL) {
    // POLL=false: Weighted Bucketing Mode
    log('Running in Weighted Bucketing Mode.', { type: 'info' });

    const filesInfo: FileInfo[] = testFiles
      .map((file) => getFileInfo(file, BASE_WEIGHT, WEIGHT_PER_TEST))
      .filter((info): info is FileInfo => info !== null);

    const testBuckets: string[][] = getFileBucketsCustom(WORKERS, filesInfo);
    const promises: Promise<CypressResult>[] = testBuckets
      .map((bucket, index) => ({ bucket, index }))
      .filter(({ bucket }) => bucket.length > 0) // Only process non-empty buckets
      .map(async ({ bucket, index }) => {
        const display = BASE_DISPLAY_NUMBER + index;
        log(`Starting Cypress process with ${bucket.length} test file(s).`, {
          type: 'info',
          workerId: index + 1,
        });
        try {
          const result = await runCypress(bucket, index, display, COMMAND);
          if (result.status === 'fulfilled') {
            completedTests += bucket.length;
            logProgress(); // Log progress here after bucket completion
            log(`Cypress process completed successfully.`, {
              type: 'success',
              workerId: index + 1,
            });
          } else {
            log(`Cypress process failed with code ${result.code}.`, {
              type: 'error',
              workerId: index + 1,
            });
          }
          return result;
        } catch (error) {
          log(`Cypress process encountered an error: ${error}`, {
            type: 'error',
            workerId: index + 1,
          });
          // Explicitly return a CypressResult with status 'rejected'
          return createCypressResult('rejected', index, 1);
        }
      });

    try {
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
            type: 'success',
            workerId: result.index + 1,
          });
        }
      });

      if (hasFailures) {
        log('One or more workers failed.', { type: 'error' });
        // Allow some time for logs to flush before exiting
        setTimeout(() => process.exit(1), 100);
      } else {
        log('All tests completed successfully.', { type: 'success' });
        // Allow some time for logs to flush before exiting
        setTimeout(() => process.exit(0), 100);
      }
    } catch (overallError) {
      log(
        `An unexpected error occurred during Weighted Bucketing Mode execution: ${overallError}`,
        { type: 'error' }
      );
      // Allow some time for logs to flush before exiting
      setTimeout(() => process.exit(1), 100);
    }
  } else {
    // POLL=true: Polling Mode
    log('Running in Polling Mode.', { type: 'info' });

    // Adjust the number of workers to the minimum of WORKERS and totalTests
    const numWorkers = Math.min(WORKERS, totalTests);
    const queue: string[] = [...testFiles];
    const promises: Promise<CypressResult>[] = [];

    const worker = async (workerIndex: number): Promise<CypressResult> => {
      log(`Worker ${workerIndex + 1} started.`, {
        type: 'info',
        workerId: workerIndex + 1,
      });
      let hasFailed = false;

      while (true) {
        let test: string | undefined;

        // Synchronize access to the queue
        if (queue.length > 0) {
          test = queue.shift();
          if (test) {
            log(`Worker ${workerIndex + 1} picked test: ${test}`, {
              type: 'info',
              workerId: workerIndex + 1,
            });
          }
        }

        if (!test) {
          log(`Worker ${workerIndex + 1} found no more tests to run.`, {
            type: 'info',
            workerId: workerIndex + 1,
          });
          break; // Queue is empty
        }

        const display = BASE_DISPLAY_NUMBER + workerIndex;
        try {
          const result = await runCypress(
            [test],
            workerIndex,
            display,
            COMMAND
          );
          if (result.status === 'fulfilled') {
            completedTests += 1;
            logProgress();
            log(`Worker ${workerIndex + 1} completed test: ${test}`, {
              type: 'info',
              workerId: workerIndex + 1,
            });
          } else {
            hasFailed = true;
            log(
              `Worker ${workerIndex + 1} encountered a failed Cypress run with code ${result.code}.`,
              { type: 'error', workerId: workerIndex + 1 }
            );
          }
        } catch (error) {
          hasFailed = true;
          log(
            `Worker ${workerIndex + 1} encountered a failed Cypress run: ${error}`,
            { type: 'error', workerId: workerIndex + 1 }
          );
        }
      }

      log(
        `Worker ${workerIndex + 1} is finishing with status: ${
          hasFailed ? 'rejected' : 'fulfilled'
        }.`,
        { type: 'info', workerId: workerIndex + 1 }
      );

      return createCypressResult(
        hasFailed ? 'rejected' : 'fulfilled',
        workerIndex,
        hasFailed ? 1 : 0
      );
    };

    // Start only the necessary number of workers
    for (let i = 0; i < numWorkers; i++) {
      promises.push(worker(i));
    }

    try {
      const results: CypressResult[] = await Promise.all(promises);

      let hasFailures = false;
      results.forEach((result) => {
        if (result.status === 'rejected') {
          hasFailures = true;
          log(
            `Worker ${result.index + 1} had at least one failed Cypress run.`,
            { type: 'error', workerId: result.index + 1 }
          );
        } else {
          log(
            `Worker ${result.index + 1} completed all Cypress runs successfully.`,
            { type: 'success', workerId: result.index + 1 }
          );
        }
      });

      if (hasFailures) {
        log('One or more Cypress workers failed.', { type: 'error' });
        // Allow some time for logs to flush before exiting
        setTimeout(() => process.exit(1), 100);
      } else {
        log('All Cypress tests completed successfully.', { type: 'success' });
        // Allow some time for logs to flush before exiting
        setTimeout(() => process.exit(0), 100);
      }
    } catch (overallError) {
      log(
        `An unexpected error occurred during Polling Mode execution: ${overallError}`,
        { type: 'error' }
      );
      // Allow some time for logs to flush before exiting
      setTimeout(() => process.exit(1), 100);
    }
  }
}

// Execute the script
runParallelCypress();

// Handle Unhandled Rejections
process.on('unhandledRejection', (reason) => {
  log(`Unhandled Rejection: ${reason}`, { type: 'error' });
  // Allow some time for logs to flush before exiting
  setTimeout(() => process.exit(1), 100);
});
