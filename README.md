# cy-parallel

```
yarn add cy-parallel
CYPRESS_COMMAND="npx run cypress" yarn cy-parallel
```

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
