# FluxTest Feature Guide (Detailed)

This document gives a detailed breakdown of FluxTest features across the public product, authenticated app, execution engine, AI/policy layer, and enterprise operations.

## 1) Natural Language Prompt Generation

### What it does
Converts plain-language test intent into structured test plans and executable browser steps.

### Why it matters
Reduces manual scripting effort and makes test authoring accessible to QA, PM, and engineering teams.

### Key capabilities
- Prompt-based test authoring from business language.
- Generated plan structures that can be reviewed before execution.
- Prompt detail views for iteration and refinement.
- Version and activity tracking in collaborative workflows.

### Primary surfaces
- App routes: `/prompts`, `/prompts/:id`
- Docs section: Prompt Generation

## 2) Execution Dashboard and Run History

### What it does
Runs generated plans, tracks live/complete run states, and exposes run-level details and history.

### Why it matters
Provides operational visibility into pass/fail status, trends, and execution reliability.

### Key capabilities
- Central execution dashboard.
- Run detail inspection by execution ID.
- Historical views for test case outcomes.
- Summary cards and status badges for fast triage.

### Primary surfaces
- App routes: `/execution`, `/execution-dashboard`, `/execution/:executionId`
- Docs section: Executions and Dashboards

## 3) Self-Healing and Element Drift Recovery

### What it does
Detects broken selectors at runtime and proposes or applies alternatives based on policy and confidence.

### Why it matters
Keeps automated tests resilient as UI changes over time.

### Key capabilities
- Healing event capture during execution.
- Suggested locator alternatives.
- Confidence-based review requirements.
- Post-run healing success analytics.

### Primary surfaces
- App routes: `/review`, `/review/:id`, `/analytics/healing-success`
- Docs section: Element Review and Self-Healing

## 4) Review Queue Workflow

### What it does
Creates a human-in-the-loop review process for selector updates, healing suggestions, and policy-gated decisions.

### Why it matters
Balances autonomous healing with safety and auditability.

### Key capabilities
- Queue-based pending decision list.
- Approve/reject/inspect flow per review item.
- Decision history and governance alignment.

### Primary surfaces
- App routes: `/review`, `/review/:id`
- Docs section: Review Queue Workflow

## 5) Page Context and Element Inventory

### What it does
Stores page-level context and element metadata to improve selector quality and AI-assisted decisions.

### Why it matters
Improves healing reliability and selector relevance through richer context.

### Key capabilities
- Page context registration and management.
- Element inventory browsing and filtering.
- Context usage tracking for healing and generation.

### Primary surfaces
- App routes: `/page-context`, `/elements`
- Docs section: Page Context and Elements

## 6) Policy Engine and Safety Controls

### What it does
Applies configurable rules for execution safety, auto-healing thresholds, and approval behavior.

### Why it matters
Provides predictable guardrails for enterprise-grade automation.

### Key capabilities
- Central policy dashboard and policy engine UI.
- Safety rules (including destructive action controls).
- Confidence thresholds and escalation behavior.
- Decision logs for governance and audit.

### Primary surfaces
- App routes: `/policy`, `/policy-engine`
- Docs section: Policies and Safety Controls

## 7) Analytics and AI Insights

### What it does
Aggregates execution and healing telemetry into trends, summaries, and AI-assisted insights.

### Why it matters
Helps teams improve stability, detect risk areas, and prioritize automation work.

### Key capabilities
- Trend widgets and analytics dashboards.
- AI insight panels (basic and enhanced).
- Healing success visualization.

### Primary surfaces
- App routes: `/analytics`, `/analytics/trends`, `/analytics/ai-insights`, `/analytics/ai-insights-basic`
- Docs section: Analytics and AI Insights

## 8) Multi-Browser Execution

### What it does
Runs tests across browser targets with browser-aware execution metadata.

### Why it matters
Improves confidence in cross-browser compatibility.

### Key capabilities
- Browser-aware run records.
- Browser selection and multi-select surfaces.
- Browser-specific trend and success tracking.

### Primary surfaces
- Runner and execution flows; browser selection UI components
- Docs section: Runner Setup and Usage

## 9) Runner Fleet and Agent Mode

### What it does
Supports both push execution and agent/poll-based execution through registered runners.

### Why it matters
Improves scalability and control for distributed execution environments.

### Key capabilities
- Runner registration and heartbeat lifecycle.
- Queued dispatch and assigned runner execution.
- Runner logs and operations views.

### Primary surfaces
- App route: `/runners`
- Docs section: Runner Setup and Usage

## 10) Test Suites and Structured Test Organization

### What it does
Groups related tests into suites and supports suite-level management workflows.

### Why it matters
Enables maintainable organization of large automation portfolios.

### Key capabilities
- Suite list and suite detail views.
- Add/remove test membership workflows.
- Browser config integration at suite/test scope.

### Primary surfaces
- App routes: `/test-suites`, `/test-suites/:suiteId`
- Docs section: Test Suites and Data Sources

## 11) Document-to-Tests Generation

### What it does
Transforms uploaded product documentation into structured test scenario candidates.

### Why it matters
Accelerates test coverage creation from existing product artifacts.

### Key capabilities
- Document ingestion and parsing pipeline.
- Scenario suggestion and generation flow.
- Integration with prompt/test creation paths.

### Primary surfaces
- App route: `/document-to-tests`
- Docs section: Test Suites and Data Sources

## 12) API Test Data Preconditions

### What it does
Builds API-based setup workflows that create data prerequisites before UI test execution.

### Why it matters
Improves deterministic test setup and reduces flaky precondition handling in UI steps.

### Key capabilities
- Endpoint and template management.
- Dataset/test-data setup orchestration.
- Execution history and extracted output variables.

### Primary surfaces
- App route: `/api-test-data`
- Docs section: Test Suites and Data Sources

## 13) Chrome Extension Integration

### What it does
Captures interactions and selectors from live pages to feed the platform element and prompt workflows.

### Why it matters
Shortens the path from manual exploration to reusable automation assets.

### Key capabilities
- Selector and action capture from browser context.
- Integration with MCP/backend services.
- Extension onboarding and in-app notifications.

### Primary surfaces
- App route: `/chrome-extension`
- Docs section: Chrome Extension Integration

## 14) MCP Integration and Real-Time Bridge

### What it does
Uses MCP server connectivity for tooling/resources and near real-time integration workflows.

### Why it matters
Enables synchronized frontend-backend interactions for advanced automation tooling.

### Key capabilities
- MCP provider context in frontend.
- Sync diagnostics and test utilities.
- Extension/backend bridge support.

### Primary surfaces
- App routes: `/sync-test`, `/sync-debug`
- Platform service: MCP server

## 15) Authentication, Onboarding, and Access Control

### What it does
Manages user registration/login, onboarding flow, and protected route access.

### Why it matters
Supports secure multi-user operation with controlled workspace entry.

### Key capabilities
- Login/register flows.
- Guided onboarding experience.
- Protected app routes under `/app/*`.
- Subscription gate for feature access control.

### Primary surfaces
- Public routes: `/login`, `/register`, `/onboarding`
- Protected app wrapper
- Docs section: Getting Access

## 16) Organization and Workspace Management

### What it does
Supports multi-tenant organization setup, workspace configuration, and role-based collaboration.

### Why it matters
Enables team operation at enterprise scale.

### Key capabilities
- Organization settings and workspace controls.
- Team/member lifecycle support.
- Invitation and membership records.

### Primary surfaces
- App route: `/organization`
- Docs section: Organization and Workspace

## 17) Subscription, Billing, and Licensing

### What it does
Adds subscription enforcement, billing integrations, and self-host licensing controls.

### Why it matters
Supports SaaS and self-host commercial deployment models.

### Key capabilities
- Subscription-tier based limits.
- Billing and checkout endpoints.
- Self-host license issue/validate workflows.

### Primary surfaces
- Onboarding subscription flow components.
- Billing/licensing APIs and docs.
- Public pages: licensing/legal pages.

## 18) Public Product Website and Go-to-Market Content

### What it does
Provides public pages for product messaging, trust, legal, tutorials, and docs.

### Why it matters
Supports acquisition, onboarding, and customer education.

### Key capabilities
- Landing page sections (problem, solution, pricing, CTA).
- Public docs with routed sections.
- Demo videos catalog.
- Legal/trust pages (privacy, terms, security, cookies, licensing).

### Primary surfaces
- Public routes: `/`, `/docs/*`, `/demo-videos`, `/about`, `/contact`, `/roadmap`, `/changelog`, `/security`, `/privacy`, `/terms`, `/cookies`, `/licensing`

## 19) SEO and Discoverability Foundations

### What it does
Adds public indexing controls and metadata for discoverability.

### Why it matters
Improves search engine visibility for product and documentation pages.

### Key capabilities
- Per-page metadata handling.
- `robots.txt` and sitemap support.
- Structured data usage on core public pages.

### Primary surfaces
- Frontend public pages and shared SEO metadata component.

## 20) Operational and Release Quality Gates

### What it does
Implements release-phase smoke/integration/performance workflows and migration/contract checks.

### Why it matters
Improves confidence before rollout and during production operation.

### Key capabilities
- Phase-based CI workflows.
- Contract and migration validation scripts.
- Monitoring, rollback, and stability drills.

### Primary surfaces
- `.github/workflows/phase*.yml`
- `tests/` quality and release scripts

## 21) Requirement Traceability and Compliance Mapping

### What it does
Maintains a source-to-test lineage between uploaded requirement documents and generated test cases, then surfaces that lineage directly in the UI.

### Why it matters
Transforms generated tests into auditable evidence. Teams can prove exactly which requirement section each test validates, which is critical for regulated industries such as fintech, healthcare, and government.

### Key capabilities
- Requirement-to-test linkage at generation time (document section -> test).
- UI labels on generated tests (for example: Generated from: Section 3.2 - Login Flow).
- Filter and search by source requirement section.
- Exportable traceability view for audits and compliance reviews.
- Impact analysis support when requirements are updated.

### Primary surfaces
- Document-to-tests flow and generated test detail views.
- Prompt/test detail pages and suite-level test listings.
- Compliance/report export surfaces.

## 22) Mobile and Responsive Testing

### What it does
Runs tests against mobile and tablet device profiles using Chrome DevTools mobile emulation, providing viewport simulation, touch input, device-scale-factor rendering, and device-specific user agents.

### Why it matters
Ensures applications work correctly across device form factors without requiring physical device labs. Catches responsive layout issues, touch interaction bugs, and mobile-specific regressions early.

### Key capabilities
- Built-in device profiles for popular phones and tablets (iPhone 14, Galaxy S23, Pixel 7, iPad Air, iPad Pro, Galaxy Tab S9).
- Custom device profile creation with configurable viewport, DPR, user agent, touch, and landscape settings.
- Organization-scoped and built-in profile management.
- Mobile/tablet execution via Chrome DevTools Protocol mobile emulation.
- Browser type extensions: `chrome-mobile` and `chrome-tablet` for targeted execution.
- Device-aware execution records with `device_config` metadata on run history.
- Device profile selection at execution time via API parameter or runner dispatch.
- Updated browser usage analytics with device breakdowns.
- Runner capability registration for mobile-capable agents.

### Primary surfaces
- App route: `/mobile-testing`
- Execution API: `?device_profile_id=...` parameter on execute-prompt
- Device Profile API: `/api/v1/device-profiles` (CRUD)
- Policy Engine: browser multi-select includes mobile and tablet options
- Runner registration: capabilities array supports `chrome-mobile`, `chrome-tablet`

## 23) Appium Testing (Real Devices, Native Apps, and Desktop)

### What it does
Extends the execution engine to support Appium-based testing across Android and iOS real devices/emulators, native mobile apps, Flutter apps, and Windows/Mac desktop applications. Provides a unified configuration management layer and native-gesture step execution alongside the existing Selenium browser testing.

### Why it matters
Moves the platform beyond browser-only testing into true cross-platform coverage. Teams can test native mobile apps, hybrid WebView apps, Flutter apps, and desktop applications using the same natural-language prompt workflow, self-healing engine, and analytics pipeline.

### Key capabilities
- Seven Appium execution targets: Android Web, iOS Web, Android Native, iOS Native, Flutter, Windows Desktop, Mac Desktop.
- Appium configuration management — server URL, platform capabilities, app paths, cloud provider credentials (BrowserStack, Sauce Labs).
- Organisation-scoped and built-in template configurations with CRUD API.
- AppiumDriverFactory supporting UiAutomator2, XCUITest, Flutter, Windows, and Mac2 automation engines.
- Native mobile gesture step actions: tap, long_press, swipe (up/down/left/right), pinch, spread, hide_keyboard, press_back, press_home, set_orientation.
- App lifecycle actions: launch_app, close_app, background_app, activate_app, terminate_app.
- Hybrid app context switching: switch_to_webview, switch_to_native for WebView-based hybrid apps.
- Appium-specific locator support: accessibility ID, Android UIAutomator selector, iOS class chain, iOS predicate string.
- Browser multi-select UI includes all Appium targets grouped under "Appium (Real Devices & Desktop)".
- Execution API accepts `appium_config_id` parameter for automatic browser type and capability resolution.
- Runner agent ZIP includes Appium configuration properties and documentation.
- Runner poll response includes `appiumConfig` for agent-mode dispatch.

### Primary surfaces
- App route: `/appium-testing`
- Execution API: `?appium_config_id=...` parameter on execute-prompt
- Appium Config API: `/api/v1/appium-configs` (CRUD)
- Browser multi-select: Appium section with 7 targets
- Runner registration: capabilities array supports `appium-android-web`, `appium-ios-web`, `appium-android-native`, `appium-ios-native`, `appium-flutter`, `appium-windows`, `appium-mac`

---

## Feature Group Summary

### Test Authoring and Design
- Natural Language Prompt Generation
- Document-to-Tests Generation
- Requirement Traceability and Compliance Mapping
- Page Context and Element Inventory

### Execution and Reliability
- Execution Dashboard and Run History
- Multi-Browser Execution
- Mobile and Responsive Testing
- Appium Testing (Real Devices, Native Apps, and Desktop)
- Runner Fleet and Agent Mode
- Self-Healing and Review Queue

### Governance and Enterprise Controls
- Policy Engine and Safety Controls
- Requirement Traceability and Compliance Mapping
- Organization and Workspace Management
- Subscription, Billing, and Licensing

### Platform and Integrations
- API Test Data Preconditions
- Chrome Extension Integration
- MCP Integration and Real-Time Bridge

### Product Experience and Operations
- Public Website and Documentation
- SEO and Discoverability
- Operational Quality Gates
