// src/utils/__tests__/fileUtils.test.ts

import fs, { Dirent } from 'fs';
import path from 'path';
import * as fileUtils from './fileUtils'; // Adjusted import path
import { log } from './logging'; // Adjusted import path

// Mock the 'fs' module and '../logging' module
jest.mock('fs');
jest.mock('./logging', () => ({
  log: jest.fn(),
}));

describe('fileUtils', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedLog = log as jest.Mock;

  /**
   * Helper function to create mock Dirent objects
   */
  const createMockDirent = (name: string, isDirectory: boolean): Dirent =>
    ({
      name,
      isBlockDevice: jest.fn().mockReturnValue(false),
      isCharacterDevice: jest.fn().mockReturnValue(false),
      isDirectory: jest.fn().mockReturnValue(isDirectory),
      isFIFO: jest.fn().mockReturnValue(false),
      isFile: jest.fn().mockReturnValue(!isDirectory),
      isSocket: jest.fn().mockReturnValue(false),
      isSymbolicLink: jest.fn().mockReturnValue(false),
    }) as unknown as Dirent;

  /**
   * Define a local type for readdirSync options to avoid using 'any'
   */
  type MockReaddirOptions =
    | BufferEncoding
    | {
        encoding?: BufferEncoding | null;
        withFileTypes?: boolean;
      };

  /**
   * Mock process.exit to prevent actual exiting during tests
   * Adjusted the parameter type to match the expected signature
   */
  const mockProcessExit = jest
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    });

  afterAll(() => {
    mockProcessExit.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDir', () => {
    const validDir = './validDir';
    const invalidDir = './nonExistentDir';
    const notADir = './fileInsteadOfDir';
    const resolvedValidPath = path.resolve(validDir);
    const resolvedInvalidPath = path.resolve(invalidDir);
    const resolvedNotADirPath = path.resolve(notADir);

    it('should return the resolved path for a valid directory', () => {
      mockedFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(true),
        // Mock other necessary properties/methods if needed
      } as unknown as fs.Stats);

      const result = fileUtils.validateDir(validDir);

      expect(mockedFs.statSync).toHaveBeenCalledWith(resolvedValidPath);
      expect(result).toBe(resolvedValidPath);
      expect(mockedLog).not.toHaveBeenCalled();
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should log an error and exit if the directory does not exist', () => {
      const error = new Error('ENOENT: no such file or directory');
      mockedFs.statSync.mockImplementation(() => {
        throw error;
      });

      expect(() => fileUtils.validateDir(invalidDir)).toThrow(
        `process.exit: 1`
      );

      expect(mockedFs.statSync).toHaveBeenCalledWith(resolvedInvalidPath);
      expect(mockedLog).toHaveBeenCalledWith(
        `Error accessing DIR directory: ${resolvedInvalidPath}. Error: ${error}`,
        { type: 'error' }
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should log an error and exit if the path is not a directory', () => {
      mockedFs.statSync.mockReturnValue({
        isDirectory: jest.fn().mockReturnValue(false),
        // Mock other necessary properties/methods if needed
      } as unknown as fs.Stats);

      expect(() => fileUtils.validateDir(notADir)).toThrow(`process.exit: 1`);

      expect(mockedFs.statSync).toHaveBeenCalledWith(resolvedNotADirPath);
      expect(mockedLog).toHaveBeenCalledWith(
        `Provided DIR is not a directory: ${resolvedNotADirPath}`,
        { type: 'error' }
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('getTestFiles', () => {
    const rootDir = '/root';
    const emptyDir = '/emptyDir';

    const directoryStructure: Record<string, Dirent[]> = {
      '/root': [
        createMockDirent('file1.test.ts', false),
        createMockDirent('file2.test.tsx', false),
        createMockDirent('file3.ts', false),
        createMockDirent('subdir1', true),
        createMockDirent('subdir2', true),
      ],
      '/root/subdir1': [
        createMockDirent('file4.test.ts', false),
        createMockDirent('file5.js', false),
      ],
      '/root/subdir2': [createMockDirent('subsubdir1', true)],
      '/root/subdir2/subsubdir1': [createMockDirent('file6.test.ts', false)],
    };

    beforeEach(() => {
      mockedFs.readdirSync.mockImplementation(
        (dirPath: fs.PathLike, options?: MockReaddirOptions) => {
          const pathStr = dirPath.toString();
          if (
            typeof options === 'object' &&
            options !== null &&
            'withFileTypes' in options &&
            options.withFileTypes
          ) {
            return directoryStructure[pathStr] || [];
          }
          return [];
        }
      );
    });

    it('should collect all *.test.ts and *.test.tsx files recursively', () => {
      const expectedFiles = [
        path.join(rootDir, 'file1.test.ts'),
        path.join(rootDir, 'file2.test.tsx'),
        path.join(rootDir, 'file3.ts'),
        path.join(rootDir, 'subdir1', 'file4.test.ts'),
        path.join(rootDir, 'subdir1', 'file5.js'),
        path.join(rootDir, 'subdir2', 'subsubdir1', 'file6.test.ts'),
      ];

      const result = fileUtils.getTestFiles(rootDir);

      expect(result).toEqual(expectedFiles);
    });

    it('should return an empty array when no test files are found', () => {
      mockedFs.readdirSync.mockImplementation(() => []);

      const result = fileUtils.getTestFiles(emptyDir);

      expect(result).toEqual([]);
    });
  });

  describe('collectTestFiles', () => {
    const e2eDir = '/cypress/e2e';
    const noTestsDir = '/noTests';

    const directoryStructure: Record<string, Dirent[]> = {
      '/cypress/e2e': [
        createMockDirent('file1.test.ts', false),
        createMockDirent('file2.test.tsx', false),
        createMockDirent('file3.ts', false),
        createMockDirent('subdir1', true),
        createMockDirent('subdir2', true),
      ],
    };

    beforeEach(() => {
      mockedFs.readdirSync.mockImplementation(
        (dirPath: fs.PathLike, options?: MockReaddirOptions) => {
          const pathStr = dirPath.toString();
          if (
            typeof options === 'object' &&
            options !== null &&
            'withFileTypes' in options &&
            options.withFileTypes
          ) {
            return directoryStructure[pathStr] || [];
          }
          return [];
        }
      );
    });

    it('should collect and return test files when they are present', () => {
      const expectedFiles = [
        path.join(e2eDir, 'file1.test.ts'),
        path.join(e2eDir, 'file2.test.tsx'),
        path.join(e2eDir, 'file3.ts'),
      ];

      const result = fileUtils.collectTestFiles(e2eDir);

      expect(mockedLog).toHaveBeenCalledWith(
        `Found ${expectedFiles.length} test files in '${e2eDir}'.`,
        { type: 'info' }
      );
      expect(result).toEqual(expectedFiles);
    });

    it('should log an error and exit when no test files are found', () => {
      expect(() => fileUtils.collectTestFiles(noTestsDir)).toThrow(
        'process.exit: 1'
      );

      expect(mockedLog).toHaveBeenCalledWith(
        'No test files found in the provided DIR directory.',
        { type: 'error' }
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
