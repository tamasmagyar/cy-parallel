// src/utils/__tests__/weightUtils.test.ts

import fs from 'fs';
import { getFileInfo } from './weightUtils';
import { FileInfo } from './../types';

// Mock the 'fs' module
jest.mock('fs');

describe('weightUtils', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;

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

  describe('getFileInfo', () => {
    const baseWeight = 10;
    const weightPerTest = 5;

    it('should return correct weight for a file with only active "it" blocks', () => {
      const filePath = '/tests/activeIt.test.ts';
      const fileContent = `
        describe('Active Tests', () => {
          it('should do something', () => {});
          it('should do something else', () => {});
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 2; // 10 + 5*2 = 20

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should correctly handle skipped "it" blocks', () => {
      const filePath = '/tests/skippedIt.test.ts';
      const fileContent = `
        describe('Skipped Tests', () => {
          it.skip('should not run this test', () => {});
          it('should run this test', () => {});
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 1; // 10 + 5*1 = 15

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should correctly handle skipped "describe" blocks', () => {
      const filePath = '/tests/skippedDescribe.test.ts';
      const fileContent = `
        describe.skip('Skipped Suite', () => {
          it('should not run this test', () => {});
        });
        describe('Active Suite', () => {
          it('should run this test', () => {});
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 1; // Only one active test

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should correctly handle nested "describe" blocks with skips', () => {
      const filePath = '/tests/nestedDescribe.test.ts';
      const fileContent = `
        describe('Outer Suite', () => {
          it('should run this test', () => {});

          describe.skip('Inner Skipped Suite', () => {
            it('should not run this test', () => {});
          });

          describe('Inner Active Suite', () => {
            it('should run this test', () => {});
          });
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 2; // Two active tests

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should return base weight when there are no active "it" blocks', () => {
      const filePath = '/tests/noItBlocks.test.ts';
      const fileContent = `
        describe('No It Blocks', () => {
          // No tests here
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight; // No active tests

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should handle multiple nested "describe" blocks with mixed skips', () => {
      const filePath = '/tests/mixedNestedDescribe.test.ts';
      const fileContent = `
        describe('Suite 1', () => {
          it('should run test 1', () => {});

          describe.skip('Suite 1.1 Skipped', () => {
            it('should not run test 2', () => {});
          });

          describe('Suite 1.2', () => {
            it('should run test 3', () => {});

            describe.skip('Suite 1.2.1 Skipped', () => {
              it('should not run test 4', () => {});
            });

            describe('Suite 1.2.2', () => {
              it('should run test 5', () => {});
            });
          });
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 3; // Tests 1, 3, 5

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should handle files with no "describe" blocks but multiple "it" blocks', () => {
      const filePath = '/tests/multipleIt.test.ts';
      const fileContent = `
        it('should run test 1', () => {});
        it.skip('should not run test 2', () => {});
        it('should run test 3', () => {});
        it('should run test 4', () => {});
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight + weightPerTest * 3; // Tests 1, 3, 4

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should return null and log error when file read fails', () => {
      const filePath = '/tests/nonExistent.test.ts';
      const error = new Error('ENOENT: no such file or directory');

      mockedFs.readFileSync.mockImplementation(() => {
        throw error;
      });

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      expect(result).toBeNull();

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error processing file ${filePath}: ${error}`
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle complex test files with mixed "describe" and "it" blocks', () => {
      const filePath = '/tests/complex.test.ts';
      const fileContent = `
        describe('Suite A', () => {
          it('should run test 1', () => {});

          describe('Suite B', () => {
            it.skip('should not run test 2', () => {});

            describe.skip('Suite C Skipped', () => {
              it('should not run test 3', () => {});
            });

            describe('Suite D', () => {
              it('should run test 4', () => {});
              it('should run test 5', () => {});
            });
          });
        });

        describe.skip('Suite E Skipped', () => {
          it('should not run test 6', () => {});
        });

        it('should run test 7', () => {});
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      // Active tests: 1, 4, 5, 7 => 4 tests
      const expectedWeight = baseWeight + weightPerTest * 4; // 10 + 5*4 = 30

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should handle files with nested skipped "describe" blocks affecting multiple "it" blocks', () => {
      const filePath = '/tests/nestedSkippedDescribe.test.ts';
      const fileContent = `
        describe.skip('Suite A Skipped', () => {
          it('should not run test 1', () => {});

          describe('Suite B', () => {
            it('should not run test 2', () => {});
          });

          describe.skip('Suite C Skipped', () => {
            it('should not run test 3', () => {});
          });
        });

        describe('Suite D', () => {
          it('should run test 4', () => {});
          it.skip('should not run test 5', () => {});
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      // Active tests: 4 => 1 test
      const expectedWeight = baseWeight + weightPerTest * 1; // 10 + 5*1 = 15

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });

    it('should handle files with only skipped "it" blocks', () => {
      const filePath = '/tests/onlySkippedIt.test.ts';
      const fileContent = `
        describe('Suite A', () => {
          it.skip('should not run test 1', () => {});
          it.skip('should not run test 2', () => {});
        });
      `;

      mockedFs.readFileSync.mockReturnValue(fileContent);

      const result = getFileInfo(filePath, baseWeight, weightPerTest);

      const expectedWeight = baseWeight; // No active tests

      expect(result).toEqual({
        file: filePath,
        weight: expectedWeight,
      } as FileInfo);

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
    });
  });
});
