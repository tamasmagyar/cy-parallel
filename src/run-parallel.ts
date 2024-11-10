import { exec, ExecException } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const maxCpuCores = os.cpus().length;
const numWorkers = Math.min(
  parseInt(process.env.WORKERS || maxCpuCores.toString()),
  maxCpuCores
);
const cypressCommand = process.env.CYPRESS_COMMAND || 'npx cypress run';

// Directory where Cypress spec files are stored
const specsDir = process.env.DIR || './cypress/e2e';

function getSpecFiles(dir: string = specsDir): string[] {
  let specFiles: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      specFiles = specFiles.concat(getSpecFiles(fullPath));
    } else {
      specFiles.push(fullPath);
    }
  }

  return specFiles;
}

function runCypressParallel(specFiles: string[]): void {
  const specChunks = chunkArray(specFiles, numWorkers);

  const promises = specChunks
    .filter((specChunk) => specChunk.length > 0) // Only include non-empty chunks
    .map((specChunk, index) => {
      return new Promise<void>((resolve, reject) => {
        // Create a command with all specs for this worker
        const specs = specChunk.join(',');
        const command = `${cypressCommand} --spec "${specs}"`;
        console.log(`Worker ${index + 1}: ${command}`);

        // Execute the command
        exec(
          command,
          (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) {
              console.error(`Worker ${index + 1} failed:`, stderr);
              reject(error);
            } else {
              console.log(`Worker ${index + 1} output:`, stdout);
              resolve();
            }
          }
        );
      });
    });

  Promise.all(promises)
    .then(() => {
      console.log('All tests completed!');
    })
    .catch((err) => {
      console.error('Some tests failed:', err);
      process.exit(1); // Exit with code 1 if there was a test failure
    });
}

function chunkArray<T>(arr: T[], chunks: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < chunks; i++) {
    result.push([]);
  }
  arr.forEach((item, index) => {
    result[index % chunks].push(item);
  });
  return result;
}

const specFiles = getSpecFiles();
console.log(specFiles);
runCypressParallel(specFiles);
