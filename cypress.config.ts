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
