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
 * Runs Cypress for a set of test files.
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
    const { CYPRESS_LOG, IS_LINUX } = getConfig();

    // Start Xvfb only on Linux
    if (IS_LINUX) {
      await startXvfb(display);
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(IS_LINUX ? { DISPLAY: `:${display}` } : {}),
    };

    const testList: string = tests.join(',');
    log(
      `Starting Cypress for the following test(s):\n${tests.map((test) => `- ${test}`).join('\n')}`,
      {
        type: 'info',
        workerId: index + 1,
      }
    );

    const cypressCommand: string = `${command} --spec "${testList}"`;
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
      log(`Cypress process failed with exit code ${exitCode}.`, {
        type: 'error',
        workerId: index + 1,
      });
      return { status: 'rejected', index, code: exitCode };
    } else {
      log(`Cypress process completed successfully.`, {
        type: 'success',
        workerId: index + 1,
      });
      return { status: 'fulfilled', index, code: exitCode };
    }
  } catch (error) {
    log(
      `There was a problem running Cypress process for worker ${index + 1}. Error: ${error}`,
      {
        type: 'error',
        workerId: index + 1,
      }
    );
    return { status: 'rejected', index };
  }
}
