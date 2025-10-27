# Database Schema Documentation

This document describes the complete database schema for the Self-Healing Test Framework.

## Overview

The database uses a multi-schema PostgreSQL design with the following main schemas:
- **core**: Core entities (tenants, users, projects, environments)
- **catalog**: Action definitions and aliases
- **repo**: Page and element repository
- **planner**: Prompts and test plans
- **datahub**: Data sources and bindings
- **tests**: Test cases and steps
- **exec**: Test execution runs and results
- **healing**: Self-healing system data
- **analytics**: Analytics and reporting views

## Schema Details

### Core Schema (`core`)

#### Tables:
- `core.tenants` - Multi-tenant organization data
- `core.users` - User accounts
- `core.roles` - Role definitions
- `core.user_tenant_roles` - User-tenant-role associations
- `core.projects` - Projects within tenants
- `core.environments` - Environment configurations per project
- `core.api_keys` - API authentication keys

#### Key Fields:
- All tables use UUID primary keys with `gen_random_uuid()`
- Timestamped with `created_at` and `updated_at`
- Soft delete pattern with `is_active` boolean flags

### Catalog Schema (`catalog`)

#### Tables:
- `catalog.actions` - Available test actions (click, type, etc.)
- `catalog.action_aliases` - Alternative names for actions

#### Purpose:
Defines the vocabulary of actions that can be used in test steps.

### Repository Schema (`repo`)

#### Tables:
- `repo.pages` - Web pages in the application
- `repo.elements` - UI elements on pages
- `repo.element_snapshots` - Historical element captures
- `repo.dom_captures` - Full DOM snapshots
- `repo.page_contexts` - Page metadata for frontend

#### Key Relationships:
- Elements belong to pages (`page_id` → `repo.pages.id`)
- Snapshots track element changes over time
- Uses JSONB for flexible selector and attribute storage

#### Important for API Fixes:
- `repo.elements` stores `primary_selector` and `alt_selectors` as JSONB
- `repo.page_contexts` provides metadata for the frontend Pages screen

### Planner Schema (`planner`)

#### Tables:
- `planner.prompts` - User-submitted prompts/requirements
- `planner.plans` - Generated test plans from prompts

#### Key Fields:
- `planner.prompts.text` - The actual prompt text
- `planner.prompts.intent` - Extracted intent description
- `planner.plans.plan_json` - Generated test plan as JSONB

### Data Hub Schema (`datahub`)

#### Tables:
- `datahub.data_sources` - External data connections
- `datahub.data_tables` - Table definitions in data sources
- `datahub.data_rows` - Actual data rows
- `datahub.credentials` - Encrypted credentials
- `datahub.data_bindings` - Rules for data injection

### Tests Schema (`tests`)

#### Tables:
- `tests.test_cases` - Test case definitions
- `tests.test_steps` - Individual steps within test cases

#### Key Relationships:
- Steps reference actions (`action_key` → `catalog.actions.key`)
- Steps can reference elements (`element_ref` → `repo.elements.id`)
- Uses JSONB for flexible parameter and verification storage

### Execution Schema (`exec`)

#### Tables:
- `exec.runs` - Test execution instances
- `exec.run_steps` - Step execution results
- `exec.artifacts` - Screenshots, logs, etc.
- `exec.assertions` - Verification results

#### Key Fields:
- Tracks execution timing and status
- Links back to test definitions
- Stores artifacts and assertion results

### Healing Schema (`healing`) 🔥

This is the key schema for self-healing functionality:

#### Tables:
- `healing.locator_events` - When element locators fail
- `healing.candidates` - Potential replacement selectors
- `healing.decisions` - Which candidate was chosen
- `healing.review_items` - Items requiring human review
- `healing.review_comments` - Discussion on review items

#### Key Relationships:
- Events link to execution steps (`run_step_id` → `exec.run_steps.id`)
- Candidates provide alternative selectors for failed events
- Review items track suggestions that need approval

#### Important for Healing API:
- `healing.review_items` is where successful healing attempts should be stored
- `healing.locator_events` tracks when selectors fail
- `healing.candidates` stores the alternative selectors that were tried

### Analytics Schema (`analytics`)

#### Materialized Views:
- `analytics.run_summary` - Execution performance metrics
- `analytics.failure_hotspots` - Most problematic elements

## API Schema Mapping Guide

### Current vs. Correct Table Usage:

#### Prompts API  (Fixed)
- **Correct**: `planner.prompts` (text, intent, parsed_plan)
- **Correct**: `planner.plans` (plan_json, status)

#### Healing API 🔄 (Needs Fix)
- **Current**: Saving to files in `healing_data/` directory
- **Should Use**: 
  - `healing.review_items` for successful healing suggestions
  - `healing.locator_events` for recording failures
  - `healing.candidates` for alternative selectors tried

#### SQL Backend API 🔄 (Needs Fix)
- **Current**: Using old schema tables (`recorded_elements`, `test_sessions`)
- **Should Use**:
  - `repo.elements` for element data
  - `repo.pages` for page information
  - `tests.test_cases` for session-like data
  - `exec.runs` for execution tracking

#### Policy Engine API 🔄 (Needs Fix)
- **Current**: Unknown/needs investigation
- **Should Use**:
  - `core.projects` for project-level policies
  - `analytics.run_summary` for execution metrics
  - `analytics.failure_hotspots` for failure analysis

## Column Mapping Reference

### From Old Schema → New Schema:

#### Elements:
- `recorded_elements.element_id` → `repo.elements.element_key`
- `recorded_elements.tag` → `repo.elements.primary_selector`
- `recorded_elements.css_selector` → `repo.elements.primary_selector.css`
- `recorded_elements.xpath` → `repo.elements.primary_selector.xpath`
- `recorded_elements.page` → `repo.pages.name`
- `recorded_elements.selectors` → `repo.elements.alt_selectors`

#### Prompts:
- `prompts.text` → `planner.prompts.text`
- `prompts.intent` → `planner.prompts.intent`
- `prompts.title` → (derived from text or intent)
- `prompts.description` → `planner.prompts.intent`

#### Healing:
- Healing data should go to `healing.review_items` instead of files
- `healing.locator_events.details` can store the original healing attempt data

## Extensions and Features

### Required PostgreSQL Extensions:
- `uuid-ossp` - UUID generation
- `pgcrypto` - Encryption functions
- `btree_gin` - GIN index support
- `btree_gist` - GiST index support  
- `citext` - Case-insensitive text

### JSONB Usage:
- Flexible storage for selectors, parameters, and metadata
- GIN indexes for efficient querying
- Supports complex nested data structures

## Migration Notes

When updating APIs to use this schema:

1. **Replace table names** with the correct schema-prefixed versions
2. **Update column names** according to the mapping above
3. **Convert data types** to match new schema (especially JSONB fields)
4. **Add proper foreign key relationships** using the UUID references
5. **Use schema-qualified table names** in all queries

## Views Available

- `tests.v_steps_with_locators` - Test steps with their element selectors
- `healing.v_review_detail` - Detailed healing review information

This schema provides a robust foundation for the self-healing test framework with proper separation of concerns and rich relationship modeling.