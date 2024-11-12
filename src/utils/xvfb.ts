// src/utils/xvfb.ts
import { spawn, ChildProcess } from 'child_process';

/**
 * Starts an Xvfb instance on the specified display.
 * @param {number} display - The display number to use (e.g., 99 for :99).
 * @returns {Promise<ChildProcess>} - The spawned Xvfb process.
 */
export async function startXvfb(display: number): Promise<ChildProcess> {
  const xvfbProcess: ChildProcess = spawn('Xvfb', [`:${display}`], {
    stdio: 'ignore', // Ignore stdio since we don't need to interact with Xvfb
    detached: true, // Run Xvfb in its own process group
  });

  xvfbProcess.unref(); // Allow the parent process to exit independently of the Xvfb process

  // Give Xvfb some time to start
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve();
      } catch (err) {
        reject(
          new Error(
            `Failed to start Xvfb on display :${display}, error: ${err}`
          )
        );
      }
    }, 1000); // Wait 1 second
  });

  return xvfbProcess;
}
