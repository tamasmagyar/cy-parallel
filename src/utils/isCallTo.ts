import ts from 'typescript';
/**
 * Checks if a node represents a call to a testific method.
 * @param {ts.Node} node - The node to check.
 * @param {string|null} objectName - The object name (e.g., 'describe') or null if not applicable.
 * @param {string} methodName - The method name (e.g., 'it', 'skip').
 * @returns {boolean} - True if the node is a call to the testified method.
 */
export const isCallTo = (
  node: ts.Node,
  objectName: string | null,
  methodName: string
): boolean => {
  if (ts.isCallExpression(node) && node.expression) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      const { expression, name } = node.expression;
      const objName = expression.getText();
      const method = name.getText();
      return objName === objectName && method === methodName;
    } else if (ts.isIdentifier(node.expression)) {
      const method = node.expression.getText();
      return objectName === null && method === methodName;
    }
  }
  return false;
};
