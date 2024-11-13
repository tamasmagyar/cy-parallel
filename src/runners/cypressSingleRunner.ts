import { spawn, ChildProcess } from 'child_process';
import { startXvfb } from '../utils/xvfb';

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
    const isLinux = process.platform === 'linux';

    // Start Xvfb only on Linux
    if (isLinux) {
      await startXvfb(display);
      console.log(
        `\nXvfb started on display :${display} for worker ${index + 1}.\n`
      );
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...(isLinux ? { DISPLAY: `:${display}` } : {}),
    };

    const cypressCommand: string = `${command} --spec "${test}"`;
    console.log(`\nWorker ${index + 1} starting Cypress for test:\n${test}\n`);

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
      console.error(
        `\nWorker ${index + 1} Cypress failed with exit code ${exitCode}.\n`
      );
      return { status: 'rejected', index, code: exitCode };
    } else {
      console.log(`\nWorker ${index + 1} Cypress completed successfully.\n`);
      return { status: 'fulfilled', index, code: exitCode };
    }
  } catch (error) {
    console.error(
      `\nThere was a problem running Cypress for worker ${index + 1}.\n`,
      error
    );
    return { status: 'rejected', index };
  }
}
