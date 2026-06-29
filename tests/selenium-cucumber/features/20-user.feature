Feature: Common user
  As a common user
  I want to log in and register from the login screen
  So that the user path is validated independently from admin flows

  Scenario: Log in as a created user and prove the home session
    Given a shared common user exists
    When I log in as the shared common user
    Then I should see the common user preference menu without admin controls

  Scenario: Open the common user profile and preference menu
    Given a shared common user exists
    When I log in as the shared common user
    And I open the common user profile and preferences
    Then I should see the common user profile and preference links

  Scenario: Register a user with a unique email from the login screen
    Given I am on the login page
    When I register a common user with a unique email
    Then I should log in successfully with that account
