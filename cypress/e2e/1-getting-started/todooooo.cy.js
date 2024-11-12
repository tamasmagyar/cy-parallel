describe('Local HTML Page Test', () => {
  beforeEach(() => {
    cy.visit('cypress/fixtures/index.html');
  });

  it('should display the greeting message when the button is clicked', () => {
    cy.get('#greetingMessage').should('not.be.visible');
    cy.get('#greetButton').click();
    cy.get('#greetingMessage').should('be.visible').and('contain', 'Hello, Cypress!');
  });
});
