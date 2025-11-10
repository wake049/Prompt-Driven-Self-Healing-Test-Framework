-- Sample data creation script for new user registration
-- This script creates sample project and test data for new users

-- Function to create sample project for new user
CREATE OR REPLACE FUNCTION create_sample_project_for_user(p_user_id UUID, p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_project_id UUID;
    v_session_id UUID;
BEGIN
    -- Create sample project
    INSERT INTO projects (id, tenant_id, user_id, name, description, base_url)
    VALUES (
        uuid_generate_v4(),
        p_tenant_id,
        p_user_id,
        'Sample Project',
        'A sample project with demo test cases to help you get started',
        'https://demo.testapp.com'
    )
    RETURNING id INTO v_project_id;

    -- Create sample elements
    INSERT INTO elements (project_id, name, page_name, css_selector, xpath_selector, element_type, description) VALUES
    (v_project_id, 'username_field', 'login', '#username', '//input[@id="username"]', 'input', 'Username input field'),
    (v_project_id, 'password_field', 'login', '#password', '//input[@id="password"]', 'input', 'Password input field'),
    (v_project_id, 'login_button', 'login', '#login-btn', '//button[@id="login-btn"]', 'button', 'Login submit button'),
    (v_project_id, 'dashboard_title', 'dashboard', '.dashboard-title', '//h1[@class="dashboard-title"]', 'heading', 'Dashboard page title'),
    (v_project_id, 'search_box', 'main', '#search', '//input[@placeholder="Search..."]', 'input', 'Main search box'),
    (v_project_id, 'user_menu', 'main', '.user-menu', '//div[@class="user-menu"]', 'menu', 'User dropdown menu');

    -- Create sample test session with AI-generated plan
    INSERT INTO test_sessions (id, project_id, user_id, session_name, prompt, ai_generated_plan, status, total_steps, successful_steps)
    VALUES (
        uuid_generate_v4(),
        v_project_id,
        p_user_id,
        'Login Test - Demo',
        'Test the login functionality with valid credentials and verify the user reaches the dashboard',
        '{"steps": [
            {
                "step": 1,
                "action": "navigate",
                "target": "login_page",
                "url": "https://demo.testapp.com/login",
                "description": "Navigate to the login page"
            },
            {
                "step": 2,
                "action": "fill",
                "target": "username_field",
                "value": "demo_user",
                "description": "Enter username in the username field"
            },
            {
                "step": 3,
                "action": "fill",
                "target": "password_field",
                "value": "demo_password",
                "description": "Enter password in the password field"
            },
            {
                "step": 4,
                "action": "click",
                "target": "login_button",
                "description": "Click the login button to submit credentials"
            },
            {
                "step": 5,
                "action": "verify",
                "target": "dashboard_title",
                "expected": "Dashboard",
                "description": "Verify that the dashboard page loads and shows the correct title"
            }
        ],
        "metadata": {
            "estimated_duration": "30 seconds",
            "complexity": "low",
            "browser_required": "chrome",
            "ai_confidence": 0.95
        }}',
        'ready',
        5,
        0
    )
    RETURNING id INTO v_session_id;

    -- Create sample test steps
    INSERT INTO test_steps (session_id, step_number, action_type, element_name, element_selector, input_value, expected_result, status) VALUES
    (v_session_id, 1, 'navigate', 'login_page', 'https://demo.testapp.com/login', NULL, 'Page loads successfully', 'pending'),
    (v_session_id, 2, 'fill', 'username_field', '#username', 'demo_user', 'Username entered successfully', 'pending'),
    (v_session_id, 3, 'fill', 'password_field', '#password', 'demo_password', 'Password entered successfully', 'pending'),
    (v_session_id, 4, 'click', 'login_button', '#login-btn', NULL, 'Login button clicked', 'pending'),
    (v_session_id, 5, 'verify', 'dashboard_title', '.dashboard-title', NULL, 'Dashboard title is visible', 'pending');

    -- Create sample healing rules
    INSERT INTO healing_rules (project_id, element_name, original_selector, fallback_selectors, healing_strategy) VALUES
    (v_project_id, 'username_field', '#username', 
     '[{"selector": "input[name=\"username\"]", "type": "css"}, {"selector": "//input[@placeholder=\"Username\"]", "type": "xpath"}, {"selector": "[data-testid=\"username\"]", "type": "css"}]',
     'cascade_fallback'),
    (v_project_id, 'password_field', '#password',
     '[{"selector": "input[name=\"password\"]", "type": "css"}, {"selector": "//input[@type=\"password\"]", "type": "xpath"}, {"selector": "[data-testid=\"password\"]", "type": "css"}]',
     'cascade_fallback'),
    (v_project_id, 'login_button', '#login-btn',
     '[{"selector": "button[type=\"submit\"]", "type": "css"}, {"selector": "//button[contains(text(), \"Login\")]", "type": "xpath"}, {"selector": ".login-button", "type": "css"}]',
     'cascade_fallback');

    RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- Create another sample test session for search functionality
CREATE OR REPLACE FUNCTION create_additional_sample_session(p_project_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO test_sessions (id, project_id, user_id, session_name, prompt, ai_generated_plan, status, total_steps)
    VALUES (
        uuid_generate_v4(),
        p_project_id,
        p_user_id,
        'Search Functionality Test',
        'Test the search feature by entering a search term and verifying results are displayed',
        '{"steps": [
            {
                "step": 1,
                "action": "navigate",
                "target": "main_page",
                "url": "https://demo.testapp.com/dashboard",
                "description": "Navigate to the main dashboard page"
            },
            {
                "step": 2,
                "action": "fill",
                "target": "search_box",
                "value": "test query",
                "description": "Enter search term in the search box"
            },
            {
                "step": 3,
                "action": "press_key",
                "target": "search_box",
                "value": "ENTER",
                "description": "Press Enter to execute search"
            },
            {
                "step": 4,
                "action": "verify",
                "target": "search_results",
                "expected": "Results found",
                "description": "Verify that search results are displayed"
            }
        ],
        "metadata": {
            "estimated_duration": "20 seconds",
            "complexity": "low",
            "browser_required": "chrome",
            "ai_confidence": 0.92
        }}',
        'ready',
        4
    )
    RETURNING id INTO v_session_id;

    -- Create test steps for search test
    INSERT INTO test_steps (session_id, step_number, action_type, element_name, element_selector, input_value, expected_result, status) VALUES
    (v_session_id, 1, 'navigate', 'main_page', 'https://demo.testapp.com/dashboard', NULL, 'Dashboard page loads', 'pending'),
    (v_session_id, 2, 'fill', 'search_box', '#search', 'test query', 'Search term entered', 'pending'),
    (v_session_id, 3, 'press_key', 'search_box', '#search', 'ENTER', 'Search executed', 'pending'),
    (v_session_id, 4, 'verify', 'search_results', '.search-results', NULL, 'Results displayed', 'pending');

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;