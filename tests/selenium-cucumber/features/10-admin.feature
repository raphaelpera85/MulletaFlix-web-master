Feature: Admin dashboard
  As an administrator
  I want to inspect the dashboard and manage users
  So that I can verify the full administrative surface

  Scenario: Open dashboard pages and user management tabs
    Given I am logged in as admin
    When I open the dashboard users list
    And I create or reuse a common user
    And I inspect the profile, access, parental control and password tabs
    Then I should remain on the user edit page

  Scenario: Smoke the main dashboard pages and form shells
    Given I am logged in as admin
    When I inspect the dashboard, settings, user, library, playback and branding pages
    Then the admin dashboard shells should be available

  Scenario: Create and delete a disposable user from the add-user form
    Given I am logged in as admin
    When I create a disposable admin-form user
    Then the disposable admin-form user should be removed

  Scenario: Save general, streaming and branding settings shells
    Given I am logged in as admin
    When I save the general, streaming and branding settings shells
    Then the admin dashboard shells should be available

  Scenario: Cover live tv status and recordings settings
    Given I am logged in as admin
    When I inspect live tv status and recordings settings
    Then the admin dashboard shells should be available

  Scenario: Cover api keys, jobs and backups surfaces
    Given I am logged in as admin
    When I inspect api keys, jobs and backup dialogs
    Then the admin dashboard shells should be available

  Scenario: Save networking and library metadata shells
    Given I am logged in as admin
    When I save networking and library metadata shells
    Then the admin dashboard shells should be available

  Scenario: Cover all dashboard management surfaces
    Given I am logged in as admin
    When I inspect every admin management surface
    Then the admin dashboard shells should be available
