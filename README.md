# Usage

```
yarn add cy-parallel
COMMAND="npx run cypress" yarn cy-parallel

```

# Environment Variables

- `DIR`: Directory of tests (default: `cypress/e2e`).
- `COMMAND`: Cypress command (default: `npx cypress run`).
- `WORKERS`: Number of workers (default: CPU cores).
- `POLL`: true for Polling Mode; else Weighted Bucketing.
- `WEIGHT_PER_TEST`: Test weight (default: `1`).
- `BASE_WEIGHT`: Base weight (default: `1`).

## Modes

Weighted Bucketing (default) `(POLL=false)`: Distributes tests evenly.
Polling `(POLL=true)`: Start workers, worker get tests from a test file queue.

# Reporting

- Merging report can be done with mochawesome
- Install dependencies
  `yarn add -D mochawesome mochawesome-merge mochawesome-report-generator`

Example:

- Setup mochawesome in cypress config

```
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    reporter: 'mochawesome',
    video: true,
    reporterOptions: {
      reportDir: 'cypress/reports',
      overwrite: false,
      json: true,
      reportFilename: '[name]-[datetime]',
    },
  },
});
```

- Merge reports
  `mochawesome-merge cypress/reports/*.json > cypress/reports/merged-report.json`

- generate html report
  `npx mochawesome-report-generator cypress/reports/merged-report.json -o cypress/reports/merged-html-report`
