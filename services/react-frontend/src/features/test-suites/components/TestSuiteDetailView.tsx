import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import { ArrowLeft, Plus, Trash2, Play, Chrome, ExternalLink, Search, Tag, X, Check, Filter, Calendar, Clock } from 'lucide-react';

const Container = styled.div`
  padding: 24px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;

const PageHeader = styled.div`
  margin: -24px -24px 24px -24px;
  padding: 24px 24px 32px 24px;
  background: #185FA5;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: #ffffff;
  }
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  flex: 1;
`;

const ActionButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
  }
`;

const SuiteInfo = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Description = styled.p`
  font-size: 16px;
  color: #718096;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
`;

const StatCard = styled.div`
  background: #f7fafc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #2d3748;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #718096;
  text-transform: uppercase;
  margin-top: 4px;
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 16px 0;
`;

const TestCaseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TestCaseItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: #cbd5e0;
    background: #f7fafc;
  }
`;

const TestCaseName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
`;

const TestCaseId = styled.div`
  font-size: 12px;
  color: #718096;
  margin-top: 4px;
`;

const RemoveButton = styled.button`
  background: transparent;
  border: 2px solid #d47070;
  color: #A32D2D;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover {
    background: #fff5f5;
  }
`;

const ViewButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
`;

const Modal = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 0 32px 32px 32px;
  max-width: 900px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
`;

const ModalHeader = styled.div`
  margin: 0 -32px 24px -32px;
  padding: 20px 32px;
  background: #185FA5;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const SearchWrapper = styled.div`
  position: relative;
  margin-bottom: 16px;
  
  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #a0aec0;
  }
`;

const FilterSection = styled.div`
  margin-bottom: 16px;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
`;

const FilterLabel = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  min-width: 100px;
`;

const TagPill = styled.button<{ $selected?: boolean; $excluded?: boolean }>`
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  ${props => {
    if (props.$excluded) {
      return `
        background: #fed7d7;
        border-color: #d47070;
        color: #c53030;
        &:hover { background: #feb2b2; }
      `;
    } else if (props.$selected) {
      return `
        background: #c3dafe;
        border-color: #185FA5;
        color: #434190;
        &:hover { background: #a3bffa; }
      `;
    } else {
      return `
        background: #e2e8f0;
        border-color: #cbd5e0;
        color: #4a5568;
        &:hover { background: #cbd5e0; }
      `;
    }
  }}
  &:disabled {
    cursor: default;
    opacity: 0.7;
  }
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
`;

const TestListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  margin: 16px 0;
  padding-right: 8px;
`;

const TestCaseCheckbox = styled.label`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: #185FA5;
    background: #f7fafc;
  }

  input {
    margin-right: 12px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

const TestTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  justify-content: flex-end;
`;

const MiniTag = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #e6fffa;
  color: #234e52;
  border: 1px solid #81e6d9;
  text-transform: capitalize;
`;

const StatsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7fafc;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #4a5568;
`;

const AddAllButton = styled.button`
  padding: 8px 16px;
  background: #185FA5;
  border: none;
  color: #ffffff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

const SecondaryButton = styled.button`
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  color: #185FA5;
  border: 2px solid #185FA5;

  &:hover {
    background: #f7fafc;
  }
`;

const PrimaryButton = styled.button`
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #185FA5;
  color: white;
  border: none;

  &:hover {
    opacity: 0.9;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: #718096;

  h3 {
    margin: 0 0 8px 0;
    color: #4a5568;
  }

  p {
    margin: 0;
  }
  
  .empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    margin: 0 auto 16px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f4f4ff;
    color: #7f9cf5;
  }
`;

const EmptyPrimaryButton = styled.button`
  margin-top: 16px;
  padding: 10px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #185FA5;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(76, 81, 191, 0.25);

  &:hover {
    opacity: 0.92;
    transform: translateY(-1px);
  }
`;

interface TestSuite {
  id: string;
  name: string;
  description: string;
  test_count: number;
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  suite_id?: string;
  tags?: string[] | Array<{ name: string }>;
  step_count?: number;
  prompt_text?: string;
  avg_duration_seconds?: number;
  completed_runs?: number;
  external_id?: string;  // Jira/Xray ID
}

interface Execution {
  run_id: string;
  test_case_id: string;
  test_name: string;
  status: string;
  browser_type: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pending_review_steps: number;
  started_at: string;
  completed_at?: string;
  screenshot_url?: string;
}

export const TestSuiteDetailView: React.FC = () => {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [availableTests, setAvailableTests] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [estimatedRuntime, setEstimatedRuntime] = useState<number>(0);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);

  useEffect(() => {
    loadSuiteData();
  }, [suiteId]);

  const loadSuiteData = async () => {
    try {
      setLoading(true);
      
      // Load suite details
      const suiteResponse = await unifiedApiClient.get(`/api/v1/test-suites/suites`);
      console.log('🔍 Suites response:', suiteResponse);
      // API may return { data: [...] }, { suites: [...] } or just [...]
      const suites = Array.isArray(suiteResponse) ? suiteResponse : (suiteResponse.data || suiteResponse.suites || []);
      console.log('🔍 Parsed suites array:', suites);
      console.log('🔍 Looking for suite with id:', suiteId);
      const currentSuite = suites.find((s: TestSuite) => s.id === suiteId);
      console.log('🔍 Found suite:', currentSuite);
      
      if (!currentSuite) {
        console.error('❌ Suite not found with id:', suiteId);
        console.error('❌ Available suite IDs:', suites.map((s: any) => s.id));
        // Set empty suite to prevent infinite loading
        setSuite({ id: suiteId, name: 'Suite Not Found', description: 'This suite could not be loaded.' } as any);
        setLoading(false);
        return;
      }
      
      setSuite(currentSuite);

      // Load test cases in this suite
      const testsResponse = await unifiedApiClient.get(
        `/api/v1/test-suites/suites/${suiteId}/tests`
      );
      console.log('🔍 Tests response:', testsResponse);
      const tests = Array.isArray(testsResponse) ? testsResponse : (testsResponse.data || testsResponse.tests || []);
      setTestCases(tests);
      // Get estimated runtime from response
      if (testsResponse.total_estimated_seconds !== undefined) {
        setEstimatedRuntime(testsResponse.total_estimated_seconds);
      } else {
        // Calculate from individual tests if not provided
        const totalSeconds = tests.reduce((sum: number, t: any) => sum + (t.avg_duration_seconds || 0), 0);
        setEstimatedRuntime(totalSeconds);
      }

      // Load execution history for the suite (optional, may not exist yet)
      try {
        const executionsResponse = await unifiedApiClient.get(
          `/api/v1/test-suites/suites/${suiteId}/executions`
        );
        const executions = Array.isArray(executionsResponse) ? executionsResponse : (executionsResponse.data || []);
        setExecutions(executions);
      } catch (execError) {
        console.warn('Could not load executions (this is ok if suite has not been run yet):', execError);
        setExecutions([]);
      }

      // Load available test cases (all test cases to allow bulk add)
      const allTestsResponse = await unifiedApiClient.get('/api/v1/prompts');
      console.log('🔍 Available tests response:', allTestsResponse);
      // unifiedApiClient.get returns the parsed JSON directly
      setAvailableTests(allTestsResponse.prompts || []);
      
    } catch (error) {
      console.error('Error loading suite data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTests = async () => {
    try {
      for (const testId of selectedTests) {
        await unifiedApiClient.post(
          `/api/v1/test-suites/suites/${suiteId}/add-test/${testId}`
        );
      }
      
      setShowAddModal(false);
      setSelectedTests([]);
      loadSuiteData();
      alert(`Added ${selectedTests.length} test(s) to suite`);
    } catch (error) {
      console.error('Error adding tests:', error);
      alert('Failed to add tests to suite');
    }
  };

  const loadAvailableTests = async () => {
    try {
      const allTestsResponse = await unifiedApiClient.get('/api/v1/prompts');
      console.log('🔍 Reloading available tests:', allTestsResponse);
      // unifiedApiClient.get returns the parsed JSON directly
      setAvailableTests(allTestsResponse.prompts || []);
    } catch (error) {
      console.error('Error loading available tests:', error);
    }
  };

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setSearchQuery('');
    setIncludeTags([]);
    setExcludeTags([]);
    // Refresh the list of available tests when opening the modal
    await loadAvailableTests();
  };

  const getAllTags = (): string[] => {
    const tagSet = new Set<string>();
    availableTests.forEach(test => {
      if (test.tags && Array.isArray(test.tags)) {
        test.tags.forEach((tag: any) => {
          const tagName = typeof tag === 'string' ? tag : tag.name || tag;
          if (tagName) tagSet.add(tagName);
        });
      }
    });
    return Array.from(tagSet).sort();
  };

  const toggleIncludeTag = (tag: string) => {
    setExcludeTags(prev => prev.filter(t => t !== tag));
    setIncludeTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleExcludeTag = (tag: string) => {
    setIncludeTags(prev => prev.filter(t => t !== tag));
    setExcludeTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const getTestTags = (test: TestCase): string[] => {
    if (!test.tags || !Array.isArray(test.tags)) return [];
    return test.tags.map((tag: any) => 
      typeof tag === 'string' ? tag : tag.name || tag
    ).filter(Boolean);
  };

  const filteredAvailableTests = availableTests.filter(test => {
    // Already in suite check
    if (testCases.some(tc => tc.id === test.id)) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        test.id?.toLowerCase().includes(query) ||
        test.title?.toLowerCase().includes(query) ||
        test.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Tag filters
    const testTags = getTestTags(test);
    
    // Include tags (must have ALL)
    if (includeTags.length > 0) {
      const hasAllIncludeTags = includeTags.every(tag => testTags.includes(tag));
      if (!hasAllIncludeTags) return false;
    }
    
    // Exclude tags (must have NONE)
    if (excludeTags.length > 0) {
      const hasAnyExcludeTag = excludeTags.some(tag => testTags.includes(tag));
      if (hasAnyExcludeTag) return false;
    }
    
    return true;
  });

  const handleAddAllFiltered = () => {
    const testIds = filteredAvailableTests.map(test => test.id);
    setSelectedTests(prev => {
      const newSelection = [...prev];
      testIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      return newSelection;
    });
  };

  const handleRemoveTest = async (testId: string) => {
    if (!confirm('Remove this test from the suite?')) return;
    
    try {
      await unifiedApiClient.post(
        `/api/v1/test-suites/suites/${suiteId}/remove-test/${testId}`
      );
      loadSuiteData();
      alert('Test removed from suite');
    } catch (error) {
      console.error('Error removing test:', error);
      alert('Failed to remove test from suite');
    }
  };

  const handleRunSuite = async () => {
    try {
      const response = await unifiedApiClient.post(
        `/api/v1/test-suites/suites/${suiteId}/execute`
      );
      alert(response.message);
    } catch (error) {
      console.error('Error running suite:', error);
      alert('Failed to run test suite');
    }
  };

  const toggleTestSelection = (testId: string) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#718096', marginBottom: '16px' }}>
            Loading suite details...
          </div>
          <div style={{ fontSize: '14px', color: '#a0aec0' }}>
            Suite ID: {suiteId}
          </div>
        </div>
      </Container>
    );
  }

  if (!suite) {
    return (
      <Container>
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#A32D2D', marginBottom: '16px' }}>
            ⚠️ Suite not found
          </div>
          <div style={{ fontSize: '14px', color: '#718096', marginBottom: '24px' }}>
            The test suite with ID "{suiteId}" could not be found.
          </div>
          <button
            onClick={() => navigate('/app/test-suites')}
            style={{
              background: '#185FA5',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Back to Test Suites
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader>
        <Header>
          <BackButton onClick={() => navigate('/app/test-suites')}>
            <ArrowLeft size={18} />
            Back
          </BackButton>
          <Title>{suite.name}</Title>
          <ActionButton onClick={handleRunSuite}>
            <Play size={18} />
            Run Suite
          </ActionButton>
        </Header>
      </PageHeader>

      <SuiteInfo>
        <Description>{suite.description || 'No description provided'}</Description>
        <Stats>
          <StatCard>
            <StatValue>{testCases.length}</StatValue>
            <StatLabel>Test Cases</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>
              {estimatedRuntime > 0 
                ? estimatedRuntime >= 60 
                  ? `${Math.floor(estimatedRuntime / 60)}m ${Math.round(estimatedRuntime % 60)}s`
                  : `${Math.round(estimatedRuntime)}s`
                : '--'}
            </StatValue>
            <StatLabel>Est. Runtime</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{testCases.reduce((sum, t) => sum + (t.step_count || 0), 0)}</StatValue>
            <StatLabel>Total Steps</StatLabel>
          </StatCard>
        </Stats>
      </SuiteInfo>

      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <SectionTitle>Test Cases</SectionTitle>
          <ActionButton onClick={handleOpenAddModal}>
            <Plus size={18} />
            Add Tests
          </ActionButton>
        </div>

        {testCases.length === 0 ? (
          <EmptyState>
            <div className="empty-icon">
              <Calendar size={24} />
            </div>
            <h3>No test cases in this suite</h3>
            <p>Add tests to start running and tracking results.</p>
            <EmptyPrimaryButton onClick={handleOpenAddModal}>
              <Plus size={16} />
              Add your first test
            </EmptyPrimaryButton>
          </EmptyState>
        ) : (
          <TestCaseList>
            {testCases.map(test => (
              <TestCaseItem key={test.id}>
                <div style={{ flex: 1 }}>
                  <TestCaseName>{test.title}</TestCaseName>
                  <TestCaseId>
                    {test.step_count !== undefined && test.step_count > 0 
                      ? `${test.step_count} steps` 
                      : 'No steps generated'}
                    {test.avg_duration_seconds !== undefined && test.avg_duration_seconds > 0 && 
                      ` • ~${test.avg_duration_seconds >= 60 
                        ? `${Math.floor(test.avg_duration_seconds / 60)}m ${Math.round(test.avg_duration_seconds % 60)}s` 
                        : `${Math.round(test.avg_duration_seconds)}s`}`}
                    {test.description && ` • ${test.description.substring(0, 40)}${test.description.length > 40 ? '...' : ''}`}
                  </TestCaseId>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {test.avg_duration_seconds !== undefined && test.avg_duration_seconds > 0 && (
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#f0f4ff',
                      color: '#4c51bf',
                      border: '1px solid #a3bffa'
                    }}>
                      {test.avg_duration_seconds >= 60 
                        ? `${Math.floor(test.avg_duration_seconds / 60)}m ${Math.round(test.avg_duration_seconds % 60)}s` 
                        : `${Math.round(test.avg_duration_seconds)}s`}
                    </div>
                  )}
                  {test.step_count !== undefined && test.step_count > 0 && (
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: '#e6fffa',
                      color: '#234e52',
                      border: '1px solid #81e6d9'
                    }}>
                      {test.step_count} steps
                    </div>
                  )}
                  <RemoveButton onClick={() => handleRemoveTest(test.id)}>
                    <Trash2 size={14} />
                    Remove
                  </RemoveButton>
                </div>
              </TestCaseItem>
            ))}
          </TestCaseList>
        )}
      </Section>

      <Section>
        <SectionTitle>Execution History</SectionTitle>
        {executions.length === 0 ? (
          <EmptyState>
            <div className="empty-icon">
              <Clock size={24} />
            </div>
            <h3>No executions yet</h3>
            <p>Run this suite to start seeing execution history here.</p>
          </EmptyState>
        ) : (
          <TestCaseList>
            {executions.map(exec => (
              <TestCaseItem key={exec.run_id}>
                <div>
                  <TestCaseName>{exec.test_name}</TestCaseName>
                  <TestCaseId>
                    Browser: {exec.browser_type} • Status: {exec.status} • {exec.passed_steps}/{exec.total_steps} steps passed
                  </TestCaseId>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: exec.status === 'completed' ? '#c6f6d5' : exec.status === 'failed' ? '#fed7d7' : '#feebc8',
                    color: exec.status === 'completed' ? '#22543d' : exec.status === 'failed' ? '#742a2a' : '#7c2d12'
                  }}>
                    {exec.status}
                  </div>
                  <ViewButton onClick={() => navigate(`/app/dashboard/execution/${exec.run_id}`)}>
                    <ExternalLink size={14} />
                    View
                  </ViewButton>
                </div>
              </TestCaseItem>
            ))}
          </TestCaseList>
        )}
      </Section>

      <Modal $isOpen={showAddModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add Tests to Suite</ModalTitle>
          </ModalHeader>
          
          <SearchWrapper>
            <Search size={16} />
            <SearchInput
              placeholder="Search tests by ID, title, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchWrapper>

          <FilterSection>
            <FilterRow>
              <FilterLabel>
                <Tag size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Include Tags:
              </FilterLabel>
              <TagsContainer>
                  {getAllTags().length > 0 ? (
                    getAllTags().map(tag => (
                      <TagPill
                        key={`include-${tag}`}
                        $selected={includeTags.includes(tag)}
                        onClick={() => toggleIncludeTag(tag)}
                        type="button"
                      >
                        {includeTags.includes(tag) && <Check size={12} />}
                        {tag}
                      </TagPill>
                    ))
                  ) : (
                    <TagPill type="button" disabled>
                      No tags
                    </TagPill>
                  )}
              </TagsContainer>
            </FilterRow>
            
            <FilterRow>
              <FilterLabel>
                <X size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Exclude Tags:
              </FilterLabel>
              <TagsContainer>
                  {getAllTags().length > 0 ? (
                    getAllTags().map(tag => (
                      <TagPill
                        key={`exclude-${tag}`}
                        $excluded={excludeTags.includes(tag)}
                        onClick={() => toggleExcludeTag(tag)}
                        type="button"
                      >
                        {excludeTags.includes(tag) && <X size={12} />}
                        {tag}
                      </TagPill>
                    ))
                  ) : (
                    <TagPill type="button" disabled>
                      No tags
                    </TagPill>
                  )}
              </TagsContainer>
            </FilterRow>
          </FilterSection>

          <StatsBar>
            <div>
              <strong>{filteredAvailableTests.length}</strong> tests available
              {selectedTests.length > 0 && (
                <span> · <strong>{selectedTests.length}</strong> selected</span>
              )}
            </div>
            <AddAllButton 
              onClick={handleAddAllFiltered}
              disabled={filteredAvailableTests.length === 0}
              type="button"
            >
              <Plus size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Add All Filtered
            </AddAllButton>
          </StatsBar>

          <TestListContainer>
            {availableTests.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#718096' }}>
                No test cases available. Create some test cases first in the Prompts section.
              </div>
            ) : filteredAvailableTests.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#718096' }}>
                <Filter size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>No tests match your filters</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Try adjusting your search or tag filters</div>
              </div>
            ) : (
              filteredAvailableTests.map(test => (
                <TestCaseCheckbox key={test.id}>
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={() => toggleTestSelection(test.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, color: '#2d3748' }}>{test.title}</div>
                      <div style={{ fontSize: '10px', color: '#a0aec0', fontFamily: 'monospace', padding: '2px 6px', background: '#f7fafc', borderRadius: '4px' }}>
                        {test.external_id || `${test.id.substring(0, 8)}...`}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                      {test.description || 'No description'}
                    </div>
                    {getTestTags(test).length > 0 && (
                      <TestTags>
                        {getTestTags(test).map((tag, idx) => (
                          <MiniTag key={idx}>{tag}</MiniTag>
                        ))}
                      </TestTags>
                    )}
                  </div>
                </TestCaseCheckbox>
              ))
            )}
          </TestListContainer>

          <ModalActions>
            <SecondaryButton onClick={() => {
              setShowAddModal(false);
              setSelectedTests([]);
              setSearchQuery('');
              setIncludeTags([]);
              setExcludeTags([]);
            }}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleAddTests} disabled={selectedTests.length === 0}>
              Add {selectedTests.length} Test{selectedTests.length !== 1 ? 's' : ''}
            </PrimaryButton>
          </ModalActions>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default TestSuiteDetailView;
