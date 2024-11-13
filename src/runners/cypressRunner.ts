import { spawn, ChildProcess } from 'child_process';
import { startXvfb } from '../utils/xvfb';
import { log } from '../utils/logging';

export interface CypressResult {
  status: 'fulfilled' | 'rejected';
  index: number;
  code?: number;
}

/**
 * Runs Cypress for a set of test files with a unique display.
 * @param {string[]} tests - Array of test file paths.
 * @param {number} index - Index of the parallel process.
 * @param {number} display - Display number for Xvfb.
 * @param {string} command - The Cypress command to execute.
 * @returns {Promise<CypressResult>}
 */
export async function runCypress(
  tests: string[],
  index: number,
  display: number,
  command: string
): Promise<CypressResult> {
  try {
    const isLinux = process.platform === 'linux';

    // Start Xvfb only on Linux
    if (isLinux) {
      await startXvfb(display);
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(isLinux ? { DISPLAY: `:${display}` } : {}),
    };

    const testList: string = tests.join(',');
    log(`Starting Cypress for the following tests:\n${testList}`, {
      type: 'info',
      workerId: index + 1,
    });

    const cypressCommand: string = `${command} --spec "${testList}"`;
    const cypressProcess: ChildProcess = spawn(cypressCommand, {
      shell: true,
      env: env,
      stdio: 'inherit', // Inherit stdio to show Cypress output in real-time
    });

    // Handle Cypress process completion
    const exitCode: number = await new Promise<number>((resolve, reject) => {
      cypressProcess.on('close', (code: number) => {
        resolve(code);
      });

      cypressProcess.on('error', (err: Error) => {
        reject(err);
      });
    });

    if (exitCode !== 0) {
      log(`Cypress process ${index + 1} failed with exit code ${exitCode}.`, {
        type: 'error',
        workerId: index + 1,
      });
      return { status: 'rejected', index, code: exitCode };
    } else {
      log(`Cypress process ${index + 1} completed successfully.`, {
        type: 'success',
        workerId: index + 1,
      });
      return { status: 'fulfilled', index, code: exitCode };
    }
  } catch (error) {
    log(
      `There was a problem running Cypress process ${index + 1}. Error: ${error}`,
      {
        type: 'error',
        workerId: index + 1,
      }
    );
    return { status: 'rejected', index };
  }
}
