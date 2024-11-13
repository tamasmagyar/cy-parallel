import { getConfig } from './envUtils';

// logging.ts
type LogType = 'info' | 'error' | 'warn' | 'success';

interface LogOptions {
  workerId?: number;
  type?: LogType;
}

async function log(message: string, options: LogOptions = {}): Promise<void> {
  const { workerId, type = 'info' } = options;
  const { VERBOSE } = getConfig();

  if (!VERBOSE) {
    return;
  }

  // Dynamically import chalk
  const chalk = await import('chalk');

  // Prefix formatting based on type
  let prefix: string;
  switch (type) {
    case 'error':
      prefix = chalk.default.red('cy-parallel(error)');
      break;
    case 'success':
      prefix = chalk.default.greenBright('cy-parallel(success)');
      break;
    case 'warn':
      prefix = chalk.default.yellow('cy-parallel(warn)');
      break;
    case 'info':
    default:
      prefix = chalk.default.blue('cy-parallel(info)');
      break;
  }

  // Worker ID inclusion in log if provided
  const workerPart = workerId !== undefined ? `Worker ${workerId} ` : '';
  console.log(`${prefix}: ${workerPart}${message}`);
}

export { log };
