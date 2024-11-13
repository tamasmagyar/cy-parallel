// src/utils/__tests__/envUtils.test.ts

import { getConfig, Config } from './envUtils';
import os from 'os';

describe('getConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clears the cache
    process.env = { ...ORIGINAL_ENV }; // Make a copy
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV; // Restore original environment
    jest.restoreAllMocks();
  });

  /**
   * Helper function to mock process.platform
   * @param platform The platform string to mock
   */
  const mockPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, 'platform', {
      value: platform,
      configurable: true,
    });
  };

  it('should return default configuration when no environment variables are set', () => {
    // Mock os.cpus() to return a specific number of CPUs
    const mockCpus = [{}, {}, {}, {}]; // 4 CPUs
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    // Mock process.platform to 'linux' for IS_LINUX
    mockPlatform('linux');

    const config: Config = getConfig();

    expect(config).toEqual({
      WEIGHT_PER_TEST: 1,
      BASE_WEIGHT: 1,
      WORKERS: 4, // min(WORKERS env var or default to os.cpus().length) without env var
      DIR: 'cypress/e2e',
      COMMAND: 'npx cypress run',
      POLL: false,
      BASE_DISPLAY_NUMBER: 99,
      VERBOSE: true,
      CYPRESS_LOG: true,
      IS_LINUX: true,
    });
  });

  it('should override default values with environment variables', () => {
    process.env.WEIGHT_PER_TEST = '5';
    process.env.BASE_WEIGHT = '10';
    process.env.WORKERS = '2';
    process.env.DIR = 'tests/cypress';
    process.env.COMMAND = 'npm run cypress';
    process.env.POLL = 'true';
    process.env.BASE_DISPLAY_NUMBER = '100';
    process.env.VERBOSE = 'false';
    process.env.CYPRESS_LOG = 'false';

    // Mock os.cpus() to return a specific number of CPUs
    const mockCpus = [{}, {}, {}, {}]; // 4 CPUs
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    // Mock process.platform to 'darwin' for IS_LINUX
    mockPlatform('darwin');

    const config: Config = getConfig();

    expect(config).toEqual({
      WEIGHT_PER_TEST: 5,
      BASE_WEIGHT: 10,
      WORKERS: 2, // from environment variable, min(2, 4)
      DIR: 'tests/cypress',
      COMMAND: 'npm run cypress',
      POLL: true,
      BASE_DISPLAY_NUMBER: 100,
      VERBOSE: false,
      CYPRESS_LOG: false,
      IS_LINUX: false, // process.platform is 'darwin'
    });
  });

  it('should use default value when WORKERS exceeds number of CPUs', () => {
    process.env.WORKERS = '10'; // More than available CPUs

    // Mock os.cpus() to return a specific number of CPUs
    const mockCpus = [{}, {}, {}, {}]; // 4 CPUs
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    const config: Config = getConfig();

    expect(config.WORKERS).toBe(4); // Should not exceed os.cpus().length
  });

  it('should parse numeric environment variables correctly', () => {
    process.env.WEIGHT_PER_TEST = '3';
    process.env.BASE_WEIGHT = '7';
    process.env.BASE_DISPLAY_NUMBER = '150';

    // Mock os.cpus()
    const mockCpus = [{}, {}, {}]; // 3 CPUs
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    const config: Config = getConfig();

    expect(config.WEIGHT_PER_TEST).toBe(3);
    expect(config.BASE_WEIGHT).toBe(7);
    expect(config.BASE_DISPLAY_NUMBER).toBe(150);
  });

  it('should fallback to default number when numeric parsing fails', () => {
    process.env.WEIGHT_PER_TEST = 'invalid';
    process.env.BASE_WEIGHT = 'NaN';
    process.env.WORKERS = 'invalid';

    // Mock os.cpus() to return 4 CPUs
    const mockCpus = [{}, {}, {}, {}];
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    const config: Config = getConfig();

    expect(config.WEIGHT_PER_TEST).toBe(1); // Default
    expect(config.BASE_WEIGHT).toBe(1); // Default
    expect(config.WORKERS).toBe(4); // Default to os.cpus().length
  });

  it('should parse boolean environment variables correctly', () => {
    process.env.POLL = 'true';
    process.env.VERBOSE = 'false';
    process.env.CYPRESS_LOG = 'true';

    const config: Config = getConfig();

    expect(config.POLL).toBe(true);
    expect(config.VERBOSE).toBe(false);
    expect(config.CYPRESS_LOG).toBe(true);
  });

  it('should interpret any non-"true" string as false for boolean variables', () => {
    process.env.POLL = 'yes';
    process.env.VERBOSE = 'no';
    process.env.CYPRESS_LOG = '1';

    const config: Config = getConfig();

    expect(config.POLL).toBe(false);
    expect(config.VERBOSE).toBe(false);
    expect(config.CYPRESS_LOG).toBe(false);
  });

  it('should set IS_LINUX based on process.platform', () => {
    // Mock process.platform to 'linux'
    mockPlatform('linux');
    let config: Config = getConfig();
    expect(config.IS_LINUX).toBe(true);

    // Mock process.platform to 'darwin'
    mockPlatform('darwin');
    config = getConfig();
    expect(config.IS_LINUX).toBe(false);

    // Mock process.platform to 'win32'
    mockPlatform('win32');
    config = getConfig();
    expect(config.IS_LINUX).toBe(false);
  });

  it('should default WORKERS to os.cpus().length when WORKERS is not set', () => {
    // Ensure WORKERS is not set
    delete process.env.WORKERS;

    // Mock os.cpus() to return 6 CPUs
    const mockCpus = [{}, {}, {}, {}, {}, {}];
    jest.spyOn(os, 'cpus').mockReturnValue(mockCpus as unknown as os.CpuInfo[]);

    const config: Config = getConfig();

    expect(config.WORKERS).toBe(6);
  });
});
