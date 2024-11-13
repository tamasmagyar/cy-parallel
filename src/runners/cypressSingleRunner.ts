import { spawn, ChildProcess } from 'child_process';
import { startXvfb } from '../utils/xvfb';
import { log } from '../utils/logging';
import { getConfig } from '../utils/envUtils';

export interface CypressResult {
  status: 'fulfilled' | 'rejected';
  index: number;
  code?: number;
}

/**
 * Runs a single Cypress test file.
 * @param {string} test - The test file path.
 * @param {number} index - The worker index.
 * @param {number} display - Display number for Xvfb.
 * @param {string} command - The Cypress command to execute.
 * @returns {Promise<CypressResult>}
 */
export async function runCypressSingle(
  test: string,
  index: number,
  display: number,
  command: string
): Promise<CypressResult> {
  try {
    const { CYPRESS_LOG, IS_LINUX } = getConfig();
    // Start Xvfb only on Linux
    if (IS_LINUX) {
      await startXvfb(display);
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(IS_LINUX ? { DISPLAY: `:${display}` } : {}),
    };

    const cypressCommand: string = `${command} --spec "${test}"`;
    log(`Starting Cypress for the following test:\n${test}`, {
      type: 'info',
      workerId: index + 1,
    });

    const cypressProcess: ChildProcess = spawn(cypressCommand, {
      shell: true,
      env: env,
      stdio: CYPRESS_LOG ? 'inherit' : 'ignore',
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
      log(`Cypress failed with exit code ${exitCode}.`, {
        type: 'error',
        workerId: index + 1,
      });
      return { status: 'rejected', index, code: exitCode };
    } else {
      log(`Cypress completed successfully.`, {
        type: 'success',
        workerId: index + 1,
      });
      return { status: 'fulfilled', index, code: exitCode };
    }
  } catch (error) {
    log(`There was a problem running worker ${index + 1}. Error: ${error}`, {
      type: 'error',
      workerId: index + 1,
    });
    return { status: 'rejected', index };
  }
}
