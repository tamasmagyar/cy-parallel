/* eslint-disable no-undef */
// scripts/check-branch-name.js
import { execSync } from 'child_process';

try {
  // Get the current branch name
  const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

  // Define the regex pattern for allowed branch names
  const pattern = /^(feature|bugfix|hotfix)|chore|test\/[a-z0-9\-]+$/;

  if (!pattern.test(branchName)) {
    console.error(`\n✖ Invalid branch name "${branchName}".\n`);
    console.error('Branch name must follow the pattern: type/description');
    console.error('Types: feature, bugfix, hotfix');
    console.error('Example: feature/add-login, bugfix/fix-crash\n');
    process.exit(1);
  }

  console.log(`✔ Branch name "${branchName}" is valid.`);
} catch (error) {
  console.error('Error checking branch name:', error);
  process.exit(1);
}
