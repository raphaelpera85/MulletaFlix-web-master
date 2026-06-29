Feature: Pagination and home media
  As an administrator and common user
  I want to browse recognized media and paged libraries
  So that home, carousels and library pagination match the Playwright coverage

  Scenario: Admin sees media libraries, home carousels and paged library views after recognition
    Given I am logged in as admin
    When I ensure movies and series libraries are recognized
    Then I should see media libraries and home carousels
    And I should page through movies and series when pagination is available
    And I should inspect media metadata, plugin, task and log details

  Scenario: Common user can browse home and page through movies and series
    Given I am logged in as admin
    When I ensure movies and series libraries are recognized
    And I create a temporary common media user
    And I log in as the temporary common media user
    Then I should see media libraries and home carousels
    And I should page through movies and series when pagination is available
