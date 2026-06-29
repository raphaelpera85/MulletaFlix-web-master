Feature: Wizard
  As a maintainer
  I want to validate the first-run wizard
  So that a clean stage can bootstrap the admin and system settings

  Scenario: Complete the wizard from a clean stage
    Given the stage is clean
    When I open the wizard start page
    Then I should see the wizard form controls
    When I complete the wizard with the admin user
    Then I should reach the login page

  Scenario: Wizard can be completed end-to-end
    Given the wizard has been completed with the admin user
    Then I should reach the login page
