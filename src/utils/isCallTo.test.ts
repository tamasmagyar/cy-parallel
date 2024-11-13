import { isCallTo } from './isCallTo';
import ts from 'typescript';

describe('isCallTo', () => {
  it('should return true for a matching property access call', () => {
    const source = `describe.skip('Test Suite', () => {});`;
    const sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const callExpr = sourceFile.statements[0] as ts.ExpressionStatement;

    expect(isCallTo(callExpr.expression, 'describe', 'skip')).toBe(true);
  });

  it('should return true for a matching identifier call', () => {
    const source = `it('should do something', () => {});`;
    const sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const callExpr = sourceFile.statements[0] as ts.ExpressionStatement;

    expect(isCallTo(callExpr.expression, null, 'it')).toBe(true);
  });

  it('should return false for non-matching property access call', () => {
    const source = `describe.only('Test Suite', () => {});`;
    const sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const callExpr = sourceFile.statements[0] as ts.ExpressionStatement;

    expect(isCallTo(callExpr.expression, 'describe', 'skip')).toBe(false);
  });

  it('should return false for non-matching identifier call', () => {
    const source = `beforeEach(() => {});`;
    const sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const callExpr = sourceFile.statements[0] as ts.ExpressionStatement;

    expect(isCallTo(callExpr.expression, null, 'it')).toBe(false);
  });

  it('should return false for non-call expressions', () => {
    const source = `const a = 5;`;
    const sourceFile = ts.createSourceFile(
      'test.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const variableStmt = sourceFile.statements[0] as ts.VariableStatement;

    expect(
      isCallTo(
        variableStmt.declarationList.declarations[0].initializer as ts.Node,
        null,
        'it'
      )
    ).toBe(false);
  });
});
