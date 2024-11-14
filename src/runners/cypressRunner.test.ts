// runCypress.test.ts

import { runCypress, CypressResult } from './cypressRunner';
import { spawn, ChildProcess } from 'child_process';
import { startXvfb } from '../utils/xvfb';
import { log } from '../utils/logging';
import { getConfig } from '../utils/envUtils';
import { EventEmitter } from 'events';

// Jest provides automatic type definitions for Jest functions

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../utils/xvfb', () => ({
  startXvfb: jest.fn(),
}));

jest.mock('../utils/logging', () => ({
  log: jest.fn(),
}));

jest.mock('../utils/envUtils', () => ({
  getConfig: jest.fn(),
}));

describe('runCypress', () => {
  const mockSpawn = spawn as jest.Mock;
  const mockStartXvfb = startXvfb as jest.Mock;
  const mockLog = log as jest.Mock;
  const mockGetConfig = getConfig as jest.Mock;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  /**
   * Helper function to create a mock ChildProcess using EventEmitter
   */
  const createMockChildProcess = (
    exitCode: number | null = 0,
    error?: Error
  ): ChildProcess => {
    const emitter = new EventEmitter() as ChildProcess;

    // Mock necessary ChildProcess properties and methods
    emitter.stdout = null;
    emitter.stderr = null;
    emitter.stdin = null;
    emitter.kill = jest.fn();

    // Simulate process events
    process.nextTick(() => {
      if (error) {
        emitter.emit('error', error);
      } else {
        emitter.emit('close', exitCode);
      }
    });

    return emitter;
  };

  test('should run Cypress successfully with exit code 0', async () => {
    // Arrange
    const tests = ['test1.spec.js', 'test2.spec.js'];
    const index = 0;
    const display = 99;
    const command = 'cypress run';

    mockGetConfig.mockReturnValue({
      CYPRESS_LOG: false,
      IS_LINUX: true,
    });

    mockStartXvfb.mockResolvedValue(undefined);

    const mockChildProcess = createMockChildProcess(0);
    mockSpawn.mockReturnValue(mockChildProcess);

    // Act
    const result: CypressResult = await runCypress(
      tests,
      index,
      display,
      command
    );

    // Assert
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockStartXvfb).toHaveBeenCalledWith(display);
    expect(mockSpawn).toHaveBeenCalledWith(
      `${command} --spec "${tests.join(',')}"`,
      {
        shell: true,
        env: {
          ...process.env,
          DISPLAY: `:${display}`,
        },
        stdio: 'ignore',
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Starting Cypress for the following test(s):\n- test1.spec.js\n- test2.spec.js`,
      {
        type: 'info',
        workerId: index + 1,
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Cypress process completed successfully.`,
      {
        type: 'success',
        workerId: index + 1,
      }
    );

    expect(result).toEqual({
      status: 'fulfilled',
      index,
      code: 0,
    });
  });

  test('should handle Cypress run with non-zero exit code', async () => {
    // Arrange
    const tests = ['test1.spec.js'];
    const index = 1;
    const display = 100;
    const command = 'cypress run';

    mockGetConfig.mockReturnValue({
      CYPRESS_LOG: true,
      IS_LINUX: true,
    });

    mockStartXvfb.mockResolvedValue(undefined);

    const mockChildProcess = createMockChildProcess(1);
    mockSpawn.mockReturnValue(mockChildProcess);

    // Act
    const result: CypressResult = await runCypress(
      tests,
      index,
      display,
      command
    );

    // Assert
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockStartXvfb).toHaveBeenCalledWith(display);
    expect(mockSpawn).toHaveBeenCalledWith(
      `${command} --spec "${tests.join(',')}"`,
      {
        shell: true,
        env: {
          ...process.env,
          DISPLAY: `:${display}`,
        },
        stdio: 'inherit',
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Starting Cypress for the following test(s):\n- test1.spec.js`,
      {
        type: 'info',
        workerId: index + 1,
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Cypress process failed with exit code 1.`,
      {
        type: 'error',
        workerId: index + 1,
      }
    );

    expect(result).toEqual({
      status: 'rejected',
      index,
      code: 1,
    });
  });

  test('should handle error during Cypress process spawning', async () => {
    // Arrange
    const tests = ['test3.spec.js'];
    const index = 2;
    const display = 101;
    const command = 'cypress run';

    const spawnError = new Error('Failed to spawn process');

    mockGetConfig.mockReturnValue({
      CYPRESS_LOG: false,
      IS_LINUX: true,
    });

    mockStartXvfb.mockResolvedValue(undefined);

    const mockChildProcess = createMockChildProcess(undefined, spawnError);
    mockSpawn.mockReturnValue(mockChildProcess);

    // Act
    const result: CypressResult = await runCypress(
      tests,
      index,
      display,
      command
    );

    // Assert
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockStartXvfb).toHaveBeenCalledWith(display);
    expect(mockSpawn).toHaveBeenCalledWith(
      `${command} --spec "${tests.join(',')}"`,
      {
        shell: true,
        env: {
          ...process.env,
          DISPLAY: `:${display}`,
        },
        stdio: 'ignore',
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Starting Cypress for the following test(s):\n- test3.spec.js`,
      {
        type: 'info',
        workerId: index + 1,
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `There was a problem running Cypress process for worker ${index + 1}. Error: Error: Failed to spawn process`,
      {
        type: 'error',
        workerId: index + 1,
      }
    );

    expect(result).toEqual({
      status: 'rejected',
      index,
    });
  });

  test('should start Xvfb only on Linux environments', async () => {
    // Arrange
    const tests = ['test4.spec.js'];
    const index = 3;
    const display = 102;
    const command = 'cypress run';

    mockGetConfig.mockReturnValue({
      CYPRESS_LOG: false,
      IS_LINUX: false, // Non-Linux environment
    });

    // No need to mock startXvfb since IS_LINUX is false

    const mockChildProcess = createMockChildProcess(0);
    mockSpawn.mockReturnValue(mockChildProcess);

    // Act
    const result: CypressResult = await runCypress(
      tests,
      index,
      display,
      command
    );

    // Assert
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockStartXvfb).not.toHaveBeenCalled();

    expect(mockSpawn).toHaveBeenCalledWith(
      `${command} --spec "${tests.join(',')}"`,
      {
        shell: true,
        env: {
          ...process.env,
        },
        stdio: 'ignore',
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Starting Cypress for the following test(s):\n- test4.spec.js`,
      {
        type: 'info',
        workerId: index + 1,
      }
    );

    expect(mockLog).toHaveBeenCalledWith(
      `Cypress process completed successfully.`,
      {
        type: 'success',
        workerId: index + 1,
      }
    );

    expect(result).toEqual({
      status: 'fulfilled',
      index,
      code: 0,
    });
  });

  test('should handle CYPRESS_LOG being true by setting stdio to inherit', async () => {
    // Arrange
    const tests = ['test5.spec.js'];
    const index = 4;
    const display = 103;
    const command = 'cypress run';

    mockGetConfig.mockReturnValue({
      CYPRESS_LOG: true,
      IS_LINUX: true,
    });

    mockStartXvfb.mockResolvedValue(undefined);

    const mockChildProcess = createMockChildProcess(0);
    mockSpawn.mockReturnValue(mockChildProcess);

    // Act
    const result: CypressResult = await runCypress(
      tests,
      index,
      display,
      command
    );

    // Assert
    expect(mockGetConfig).toHaveBeenCalledTimes(1);
    expect(mockStartXvfb).toHaveBeenCalledWith(display);
    expect(mockSpawn).toHaveBeenCalledWith(
      `${command} --spec "${tests.join(',')}"`,
      {
        shell: true,
        env: {
          ...process.env,
          DISPLAY: `:${display}`,
        },
        stdio: 'inherit',
      }
    );

    expect(result).toEqual({
      status: 'fulfilled',
      index,
      code: 0,
    });
  });
});
