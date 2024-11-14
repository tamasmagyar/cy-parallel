# cy-parallel

A powerful tool to run Cypress tests in parallel, optimizing test execution time.

## Table of Contents

- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Modes](#modes)
- [Reporting](#reporting)
- [Examples](#examples)
  - [Basic Usage](#basic-usage)

# [Usage](#usage)

```
DIR="cypress/e2e" COMMAND="npx run cypress" yarn cy-parallel
```

# [Environment Variables](#environment-variables)

- `DIR`: Directory of tests (default: `cypress/e2e`).
- `COMMAND`: Cypress command (default: `npx cypress run`).
- `WORKERS`: Number of workers (default: `CPU cores`).
- `POLL`: Set to true for Polling Mode; otherwise, Weighted Bucketing is used.
- `WEIGHT_PER_TEST`: Weight assigned to each test (default: `1`). (Only for Weighted Bucketing)
- `BASE_WEIGHT`: Base weight value (default: `1`). (Only for Weighted Bucketing)
- `VERBOSE`: Enable logging for `cy-parallel` (default: `true`).
- `CYPRESS_LOG`: Enable Cypress-specific logging (default: `true`).

## Modes

Feel free to experiment and measure which option is faster in your case. You can use `time <your_command>` to measure run durations.

- Weighted Bucketing (default) `(POLL=false)`: Distributes tests evenly on workers.
- Polling `(POLL=true)`: Start workers, worker get tests from a test file queue.

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

```

```

# [Examples](#examples)

## [Basic Usage](#basic-usage)

```
CYPRESS_LOG=false WORKERS=2 POLL=true yarn cy-parallel
```

- Don't log Cypress logs to stdout
- Only 2 parallel processes (Workers)
- Use POLL mode. 2 workers pulling tests from a queue
