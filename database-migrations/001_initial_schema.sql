-- Complete database schema for Self-Healing Test Framework
-- This script creates ALL necessary schemas, tables and initial data used by the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create all schemas used by the application
CREATE SCHEMA IF NOT EXISTS core;           -- Core entities (users, tenants, projects)
CREATE SCHEMA IF NOT EXISTS catalog;        -- Action definitions and element catalog
CREATE SCHEMA IF NOT EXISTS repo;          -- Repository for pages and elements
CREATE SCHEMA IF NOT EXISTS planner;       -- AI planning and prompt management
CREATE SCHEMA IF NOT EXISTS datahub;       -- Data management and bindings
CREATE SCHEMA IF NOT EXISTS tests;         -- Test definitions and cases
CREATE SCHEMA IF NOT EXISTS exec;          -- Test execution tracking
CREATE SCHEMA IF NOT EXISTS healing;       -- Self-healing functionality
CREATE SCHEMA IF NOT EXISTS analytics;     -- Performance analytics and reporting

-- =============================================================================
-- CORE SCHEMA - Core entities (users, tenants, projects, roles)
-- =============================================================================

-- Create tenants table (for multi-tenancy support and organization details)
CREATE TABLE IF NOT EXISTS core.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    
    -- Organization-specific details
    industry VARCHAR(100),
    company_size VARCHAR(50),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS core.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user-tenant-role relationships
CREATE TABLE IF NOT EXISTS core.user_tenant_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id, role_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS core.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

-- Create elements table (for page elements and selectors)
CREATE TABLE IF NOT EXISTS repo.elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    page_name VARCHAR(255),
    css_selector TEXT,
    xpath_selector TEXT,
    element_type VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_sessions table (for test execution sessions)
CREATE TABLE IF NOT EXISTS core.test_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    prompt TEXT,
    ai_generated_plan JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    total_steps INTEGER DEFAULT 0,
    successful_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_steps table (individual steps within a test session)
CREATE TABLE IF NOT EXISTS core.test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES core.test_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    element_name VARCHAR(255),
    element_selector TEXT,
    input_value TEXT,
    expected_result TEXT,
    actual_result TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    execution_time_ms INTEGER,
    screenshot_path VARCHAR(500),
    error_message TEXT,
    healing_applied BOOLEAN DEFAULT false,
    healing_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CATALOG SCHEMA - Action definitions and element catalog
-- =============================================================================

-- Create actions table (available actions for test automation)
CREATE TABLE IF NOT EXISTS catalog.actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    parameters_schema JSONB,
    example_usage JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create element_types table (catalog of element types)
CREATE TABLE IF NOT EXISTS catalog.element_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    common_selectors JSONB,
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- REPOSITORY SCHEMA - Pages and elements repository
-- =============================================================================

-- Create pages table (page definitions)
CREATE TABLE IF NOT EXISTS repo.pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url_pattern VARCHAR(500),
    route_hint VARCHAR(500),
    page_type VARCHAR(100),
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

-- Create page_contexts table (page analysis and context)
CREATE TABLE IF NOT EXISTS repo.page_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES repo.pages(id) ON DELETE CASCADE,
    context_type VARCHAR(100) NOT NULL,
    analysis_data JSONB,
    confidence_score DECIMAL(3,2),
    last_analysis_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create elements repository table (enhanced element storage)
CREATE TABLE IF NOT EXISTS repo.elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES repo.pages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    element_type VARCHAR(100),
    primary_selector JSONB NOT NULL,
    fallback_selectors JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    description TEXT,
    confidence_score DECIMAL(3,2),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PLANNER SCHEMA - AI planning and prompt management
-- =============================================================================

-- Create prompts table (user prompts for test generation)
CREATE TABLE IF NOT EXISTS planner.prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    intent VARCHAR(255),
    parsed_plan JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create plans table (AI-generated test plans)
CREATE TABLE IF NOT EXISTS planner.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID NOT NULL REFERENCES planner.prompts(id) ON DELETE CASCADE,
    plan_json JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    model_used VARCHAR(100),
    generation_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'draft',
    approved_by UUID REFERENCES core.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- DATAHUB SCHEMA - Data management and bindings
-- =============================================================================

-- Create data_bindings table (test data bindings)
CREATE TABLE IF NOT EXISTS datahub.data_bindings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    binding_type VARCHAR(100) NOT NULL,
    source_config JSONB NOT NULL,
    schema_definition JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

-- Create data_sources table (external data sources)
CREATE TABLE IF NOT EXISTS datahub.data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(100) NOT NULL,
    connection_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TESTS SCHEMA - Test definitions and cases
-- =============================================================================

-- Create test_cases table (test case definitions)
CREATE TABLE IF NOT EXISTS tests.test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES planner.plans(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    tags JSONB DEFAULT '[]',
    preconditions JSONB,
    expected_results JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create test_steps table (individual test steps)
CREATE TABLE IF NOT EXISTS tests.test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES tests.test_cases(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    action_key VARCHAR(100) NOT NULL REFERENCES catalog.actions(key),
    element_ref UUID REFERENCES repo.elements(id),
    parameters JSONB DEFAULT '{}',
    verification JSONB,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- EXECUTION SCHEMA - Test execution tracking
-- =============================================================================

-- Create runs table (test execution instances)
CREATE TABLE IF NOT EXISTS exec.runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID REFERENCES tests.test_cases(id),
    session_id UUID REFERENCES core.test_sessions(id),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    runner_meta JSONB DEFAULT '{}',
    environment_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create step_results table (individual step execution results)
CREATE TABLE IF NOT EXISTS exec.step_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
    test_step_id UUID REFERENCES tests.test_steps(id),
    step_order INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    action_data JSONB,
    result_data JSONB,
    error_details JSONB,
    screenshot_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create artifacts table (screenshots, logs, etc.)
CREATE TABLE IF NOT EXISTS exec.artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
    step_result_id UUID REFERENCES exec.step_results(id),
    artifact_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create execution summaries table (AI-generated summaries)
CREATE TABLE IF NOT EXISTS exec.execution_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(100),
    confidence_score DECIMAL(3,2),
    key_insights JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create binding usage table (data binding usage tracking)
CREATE TABLE IF NOT EXISTS exec.binding_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
    binding_name VARCHAR(255) NOT NULL,
    binding_scope VARCHAR(255),
    binding_value JSONB,
    usage_context JSONB,
    step_order INTEGER,
    action_type VARCHAR(100),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id)
);

-- =============================================================================
-- HEALING SCHEMA - Self-healing functionality
-- =============================================================================

-- Create locator_events table (element locator failures)
CREATE TABLE IF NOT EXISTS healing.locator_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_step_id UUID REFERENCES exec.step_results(id),
    element_id UUID REFERENCES repo.elements(id),
    event_type VARCHAR(50) NOT NULL,
    original_selector JSONB NOT NULL,
    failure_reason TEXT,
    page_url VARCHAR(500),
    page_context JSONB,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create candidates table (potential replacement selectors)
CREATE TABLE IF NOT EXISTS healing.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    locator_event_id UUID NOT NULL REFERENCES healing.locator_events(id) ON DELETE CASCADE,
    selector JSONB NOT NULL,
    selector_type VARCHAR(50),
    score DECIMAL(5,4) DEFAULT 0.0,
    rationale TEXT,
    validation_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create decisions table (healing decisions made)
CREATE TABLE IF NOT EXISTS healing.decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    locator_event_id UUID NOT NULL REFERENCES healing.locator_events(id),
    chosen_candidate_id UUID REFERENCES healing.candidates(id),
    decision_type VARCHAR(50) NOT NULL,
    rationale TEXT,
    success BOOLEAN,
    automated BOOLEAN DEFAULT false,
    decided_by UUID REFERENCES core.users(id),
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create review_items table (items requiring human review)
CREATE TABLE IF NOT EXISTS healing.review_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES core.projects(id),
    element_id UUID REFERENCES repo.elements(id),
    locator_event_id UUID REFERENCES healing.locator_events(id),
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    suggestion JSONB,
    rationale TEXT,
    assigned_to UUID REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create review_comments table (discussion on review items)
CREATE TABLE IF NOT EXISTS healing.review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_item_id UUID NOT NULL REFERENCES healing.review_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id),
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'comment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- LEGACY COMPATIBILITY TABLES (for backward compatibility)
-- =============================================================================

-- Create legacy tables for backward compatibility with existing code
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    page_name VARCHAR(255),
    css_selector TEXT,
    xpath_selector TEXT,
    element_type VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    prompt TEXT,
    ai_generated_plan JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    total_steps INTEGER DEFAULT 0,
    successful_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    element_name VARCHAR(255),
    element_selector TEXT,
    input_value TEXT,
    expected_result TEXT,
    actual_result TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    execution_time_ms INTEGER,
    screenshot_path VARCHAR(500),
    error_message TEXT,
    healing_applied BOOLEAN DEFAULT false,
    healing_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS healing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    element_name VARCHAR(255) NOT NULL,
    original_selector TEXT NOT NULL,
    fallback_selectors JSONB,
    healing_strategy VARCHAR(100),
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core schema indexes
CREATE INDEX IF NOT EXISTS idx_core_users_email ON core.users(email);
CREATE INDEX IF NOT EXISTS idx_core_tenants_slug ON core.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_core_user_tenant_roles_user ON core.user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_core_user_tenant_roles_tenant ON core.user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_core_projects_tenant ON core.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repo_elements_project ON repo.elements(project_id);
CREATE INDEX IF NOT EXISTS idx_core_test_sessions_project ON core.test_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_core_test_sessions_user ON core.test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_core_test_steps_session ON core.test_steps(session_id);

-- Repository schema indexes
CREATE INDEX IF NOT EXISTS idx_repo_pages_project ON repo.pages(project_id);
CREATE INDEX IF NOT EXISTS idx_repo_elements_page ON repo.elements(page_id);
CREATE INDEX IF NOT EXISTS idx_repo_page_contexts_page ON repo.page_contexts(page_id);

-- Execution schema indexes
CREATE INDEX IF NOT EXISTS idx_exec_runs_test_case ON exec.runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_session ON exec.runs(session_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_status ON exec.runs(status);
CREATE INDEX IF NOT EXISTS idx_exec_step_results_run ON exec.step_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_exec_artifacts_run ON exec.artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_exec_execution_summaries_execution ON exec.execution_summaries(execution_id);
CREATE INDEX IF NOT EXISTS idx_exec_binding_usage_execution ON exec.binding_usage(execution_id);
CREATE INDEX IF NOT EXISTS idx_exec_binding_usage_binding_name ON exec.binding_usage(binding_name);

-- Healing schema indexes
CREATE INDEX IF NOT EXISTS idx_healing_locator_events_run_step ON healing.locator_events(run_step_id);
CREATE INDEX IF NOT EXISTS idx_healing_locator_events_element ON healing.locator_events(element_id);
CREATE INDEX IF NOT EXISTS idx_healing_candidates_event ON healing.candidates(locator_event_id);
CREATE INDEX IF NOT EXISTS idx_healing_decisions_event ON healing.decisions(locator_event_id);
CREATE INDEX IF NOT EXISTS idx_healing_review_items_project ON healing.review_items(project_id);
CREATE INDEX IF NOT EXISTS idx_healing_review_items_status ON healing.review_items(status);

-- Legacy compatibility indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_elements_project_id ON elements(project_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_project_id ON test_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_steps_session_id ON test_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_analytics_session_id ON execution_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_healing_rules_project_id ON healing_rules(project_id);

-- =============================================================================
-- INITIAL DATA SETUP
-- =============================================================================

-- Insert default tenant
INSERT INTO tenants (id, name, description) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'Default tenant for all users')
ON CONFLICT (id) DO NOTHING;

-- Insert default tenant in core schema
INSERT INTO core.tenants (id, name, slug, description) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default-org', 'Default organization for all users')
ON CONFLICT (id) DO NOTHING;

-- Insert default roles
INSERT INTO core.roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000002', 'Admin', 'Administrator role with full access'),
('00000000-0000-0000-0000-000000000003', 'User', 'Standard user role')
ON CONFLICT (id) DO NOTHING;

-- Insert common actions into catalog
INSERT INTO catalog.actions (key, name, description, category, parameters_schema) VALUES
('navigate', 'Navigate to URL', 'Navigate to a specific URL', 'navigation', '{"url": {"type": "string", "required": true}}'),
('click', 'Click Element', 'Click on a page element', 'interaction', '{"selector": {"type": "string", "required": true}}'),
('fill', 'Fill Input', 'Fill an input field with text', 'interaction', '{"selector": {"type": "string", "required": true}, "value": {"type": "string", "required": true}}'),
('verify', 'Verify Element', 'Verify element presence or content', 'validation', '{"selector": {"type": "string", "required": true}, "expected": {"type": "string"}}'),
('wait', 'Wait for Element', 'Wait for element to be visible/present', 'timing', '{"selector": {"type": "string", "required": true}, "timeout": {"type": "number", "default": 5000}}'),
('press_key', 'Press Key', 'Press a keyboard key', 'interaction', '{"key": {"type": "string", "required": true}}')
ON CONFLICT (key) DO NOTHING;

-- Insert common element types
INSERT INTO catalog.element_types (name, description, common_selectors) VALUES
('button', 'Button elements', '["button", "input[type=''button'']", "input[type=''submit'']", "[role=''button'']"]'),
('input', 'Input field elements', '["input[type=''text'']", "input[type=''email'']", "input[type=''password'']", "textarea"]'),
('link', 'Link elements', '["a", "[role=''link'']"]'),
('heading', 'Heading elements', '["h1", "h2", "h3", "h4", "h5", "h6"]'),
('menu', 'Menu and navigation elements', '["nav", ".menu", ".navigation", "[role=''menu'']"]')
ON CONFLICT (name) DO NOTHING;