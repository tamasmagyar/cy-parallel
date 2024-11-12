// src/utils/weightUtils.ts
import fs from 'fs';
import ts from 'typescript';
import { FileInfo } from '../types';
import { isCallTo } from './isCallTo';

/**
 * Calculates the weight of a test file based on the number of active (non-skipped) 'it' blocks.
 * Accounts for skipped 'describe' blocks and nested structures.
 * @param {string} filePath - The path to the test file.
 * @param {number} baseWeight - The base weight to add.
 * @param {number} weightPerTest - The weight per active test.
 * @returns {FileInfo | null} - An object containing the file path and its weight, or null if an error occurs.
 */
export function getFileInfo(
  filePath: string,
  baseWeight: number,
  weightPerTest: number
): FileInfo | null {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');

    let testCount = 0;
    const skippedDescribeStack: boolean[] = [];

    // Parse the file using TypeScript
    const sourceFile = ts.createSourceFile(
      filePath,
      contents,
      ts.ScriptTarget.Latest,
      true
    );

    // Traverse the AST
    const visit = (node: ts.Node) => {
      let isEnteringDescribe = false;

      if (ts.isCallExpression(node)) {
        // Check for 'describe.skip' and 'describe'
        if (isCallTo(node, 'describe', 'skip')) {
          skippedDescribeStack.push(true); // Entering a skipped describe
          isEnteringDescribe = true;
        } else if (isCallTo(node, null, 'describe')) {
          skippedDescribeStack.push(false); // Entering a regular describe
          isEnteringDescribe = true;
        }

        // Check for 'it.skip' and 'it'
        if (isCallTo(node, null, 'it.skip') || isCallTo(node, null, 'it')) {
          const isSkippedIt = isCallTo(node, null, 'it.skip');
          const isSkipped = skippedDescribeStack.includes(true) || isSkippedIt;
          if (!isSkipped) {
            testCount += 1; // Count active test cases
          }
        }
      }

      // Recursively visit children nodes
      ts.forEachChild(node, visit);

      // Pop from the stack when leaving a 'describe' block
      if (isEnteringDescribe) {
        skippedDescribeStack.pop();
      }
    };

    ts.forEachChild(sourceFile, visit);

    // Calculate the total weight, including the base weight if there are active tests
    const weight =
      testCount > 0 ? baseWeight + weightPerTest * testCount : baseWeight;

    return {
      file: filePath,
      weight,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}: ${error}`);
    return null;
  }
}
