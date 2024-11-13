import os from 'os';

export type Config = {
  WEIGHT_PER_TEST: number;
  BASE_WEIGHT: number;
  WORKERS: number;
  DIR: string;
  COMMAND: string;
  POLL: boolean;
  BASE_DISPLAY_NUMBER: number;
};

/**
 * Retrieves and parses an environment variable based on the type of the default value.
 * @param {string} key - The environment variable key.
 * @param {string | number | boolean} defaultValue - The default value if the variable is not set.
 * @returns {string | number | boolean} - The processed environment variable value.
 */
function getEnvVar(key: string, defaultValue: string): string;
function getEnvVar(key: string, defaultValue: number): number;
function getEnvVar(key: string, defaultValue: boolean): boolean;
function getEnvVar(
  key: string,
  defaultValue: string | number | boolean
): string | number | boolean {
  const value = process.env[key];

  if (value === undefined) {
    return defaultValue;
  }

  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  } else if (typeof defaultValue === 'boolean') {
    return value === 'true';
  }

  return value;
}

/**
 * Retrieves and parses all environment variables into a configuration object.
 * @returns {Config} - Configuration object with environment variables.
 */
export function getConfig(): Config {
  // Gather configuration values
  return {
    WEIGHT_PER_TEST: getEnvVar('WEIGHT_PER_TEST', 1),
    BASE_WEIGHT: getEnvVar('BASE_WEIGHT', 1),
    WORKERS: Math.min(getEnvVar('WORKERS', os.cpus().length), os.cpus().length),
    DIR: getEnvVar('DIR', 'cypress/e2e'),
    COMMAND: getEnvVar('COMMAND', 'npx cypress run'),
    POLL: getEnvVar('POLL', false) as boolean,
    BASE_DISPLAY_NUMBER: getEnvVar('BASE_DISPLAY_NUMBER', 99),
  };
}
