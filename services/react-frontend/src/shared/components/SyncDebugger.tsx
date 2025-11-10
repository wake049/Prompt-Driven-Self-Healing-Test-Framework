/**
 * Sync Debugger Component
 * 
 * This component helps debug sync relationship issues by showing
 * actual data from elements, prompts, and the sync service.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { sqlApiClient } from '../utils/sqlApiClient';
import elementPromptSyncService from '../services/elementPromptSyncService';
const Card = styled.div`
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
`;
const CardHeader = styled.div`
  background: #f8f9fa;
  padding: 16px;
  border-bottom: 1px solid #ddd;
`;
const CardTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
`;
const CardContent = styled.div`
  padding: 16px;
`;
const Button = styled.button`
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: #0056b3;
  }
  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;
const DebugContainer = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;
const DataSection = styled.div`
  margin-bottom: 20px;
`;
const DataGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
`;
const DataList = styled.pre`
  background: #f5f5f5;
  padding: 10px;
  border-radius: 5px;
  overflow: auto;
  max-height: 300px;
  font-size: 12px;
`;
const SyncDebugger: React.FC = () => {
  const [elements, setElements] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [testPlans, setTestPlans] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  const loadData = async () => {
    setLoading(true);
    setLogs([]);
    addLog('🔄 Loading debug data...');
    try {
      // Load elements
      addLog('📦 Loading elements...');
      const elementsResponse = await sqlApiClient.getAllElements();
      const elementsData = (elementsResponse.data || []).map(dbElement => ({
        id: dbElement.logical_key || dbElement.id,
        dbId: dbElement.id,
        tag: dbElement.tag || 'unknown',
        text: dbElement.text_content || '',
        cssSelector: dbElement.css_selector || '',
        xpath: dbElement.xpath || '',
        href: '', // Not in DB schema
        src: '', // Not in DB schema
        page: dbElement.page || 'unknown',
        isActive: dbElement.is_active !== false,
        selectors: dbElement.selectors || [],
        attributes: dbElement.attributes || {},
        timestamp: new Date(dbElement.timestamp_recorded).getTime()
      }));
      setElements(elementsData);
      addLog(`✅ Loaded ${elementsData.length} elements`);
      // Load prompts
      addLog('📝 Loading prompts...');
      const token = localStorage.getItem('auth_token');
      const promptsResponse = await fetch('https://testhelix.comapi/v1/prompts?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (promptsResponse.ok) {
        const promptsData = await promptsResponse.json();
        setPrompts(promptsData.data || []);
        addLog(`✅ Loaded ${promptsData.data?.length || 0} prompts`);
        // Load test plans for each prompt
        addLog('🧪 Loading test plans...');
        const testPlansData = [];
        for (const prompt of promptsData.data || []) {
          try {
            const testPlanResponse = await fetch(`https://testhelix.com/generated-test-plans/by-prompt/${prompt.id}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (testPlanResponse.ok) {
              const testPlan = await testPlanResponse.json();
              if (testPlan) {
                testPlansData.push({
                  promptId: prompt.id,
                  promptTitle: prompt.title,
                  testPlan
                });
              }
            }
          } catch (error) {
            addLog(`⚠️ Failed to load test plan for prompt ${prompt.id}`);
          }
        }
        setTestPlans(testPlansData);
        addLog(`✅ Loaded ${testPlansData.length} test plans`);
      }
      // Reinitialize sync service and get relationships
      addLog('🔄 Reinitializing sync service...');
      await elementPromptSyncService.reinitialize();
      const syncRelationships = await elementPromptSyncService.getRelationships();
      setRelationships(syncRelationships);
      addLog(`✅ Found ${syncRelationships.size} sync relationships`);
    } catch (error) {
      addLog(`❌ Error loading data: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  const analyzeSelector = (selector: string, elements: any[]) => {
    addLog(`🔍 Analyzing selector: "${selector}"`);
    for (const element of elements) {
      const matches = [];
      if (element.cssSelector === selector) matches.push('exact CSS match');
      if (element.xpath === selector) matches.push('exact XPath match');
      if (element.id === selector) matches.push('exact ID match');
      if (selector.includes(element.cssSelector) && element.cssSelector) {
        matches.push('contains CSS selector');
      }
      if (element.cssSelector?.includes(selector) && selector) {
        matches.push('CSS selector contains this');
      }
      if (matches.length > 0) {
        addLog(`  ✅ Element ${element.id} (${element.name || 'unnamed'}): ${matches.join(', ')}`);
      }
    }
  };
  const analyzeTestPlan = (testPlan: any) => {
    addLog(`🧪 Analyzing test plan for prompt ${testPlan.promptId} (${testPlan.promptTitle})`);
    try {
      let planData = testPlan.testPlan.plan_data;
      if (typeof planData === 'string') {
        planData = JSON.parse(planData);
      }
      const actions = planData.actions || planData;
      if (Array.isArray(actions)) {
        addLog(`  📋 Found ${actions.length} actions`);
        actions.forEach((action: any, index: number) => {
          const params = action.params || {};
          const selectorKeys = ['selector', 'elementId', 'target', 'locator', 'element', 'css_selector', 'xpath'];
          for (const key of selectorKeys) {
            if (params[key]) {
              addLog(`    Step ${index}: ${key} = "${params[key]}"`);
              analyzeSelector(params[key], elements);
            }
          }
        });
      } else {
        addLog(`  ⚠️ Actions is not an array: ${typeof actions}`);
      }
    } catch (error) {
      addLog(`  ❌ Failed to parse test plan: ${error}`);
    }
  };
  const runAnalysis = () => {
    setLogs([]);
    addLog('🔍 Running detailed analysis...');
    addLog(`\n📊 SUMMARY:`);
    addLog(`  Elements: ${elements.length}`);
    addLog(`  Prompts: ${prompts.length}`);
    addLog(`  Test Plans: ${testPlans.length}`);
    addLog(`  Relationships: ${relationships.size}`);
    addLog(`\n🧩 ELEMENTS:`);
    elements.forEach(element => {
      addLog(`  ${element.id}: "${element.name || 'unnamed'}" - CSS: "${element.cssSelector || 'none'}" XPath: "${element.xpath || 'none'}"`);
    });
    addLog(`\n🧪 TEST PLAN ANALYSIS:`);
    testPlans.forEach(analyzeTestPlan);
    addLog(`\n🔗 RELATIONSHIPS:`);
    if (relationships.size === 0) {
      addLog(`  ❌ No relationships found!`);
      addLog(`  This could mean:`);
      addLog(`    - Selectors don't match exactly`);
      addLog(`    - Test plans use different parameter names`);
      addLog(`    - Data format is unexpected`);
    } else {
      relationships.forEach((rel, elementId) => {
        addLog(`  Element ${elementId}: ${rel.promptRefs.length} prompt references`);
        rel.promptRefs.forEach((ref: any) => {
          addLog(`    → Prompt ${ref.promptId} step ${ref.stepIndex}.${ref.parameterKey} = "${ref.currentValue}"`);
        });
      });
    }
  };
  useEffect(() => {
    loadData();
  }, []);
  return (
    <DebugContainer>
      <Card>
        <CardHeader>
          <CardTitle>🔧 Sync Service Debugger</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ marginBottom: '20px' }}>
            <Button onClick={loadData} disabled={loading}>
              {loading ? 'Loading...' : 'Reload Data'}
            </Button>
            <Button onClick={runAnalysis} style={{ marginLeft: '10px' }}>
              Run Analysis
            </Button>
          </div>
          <DataGrid>
            <DataSection>
              <h3>Elements ({elements.length})</h3>
              <DataList>
                {JSON.stringify(elements.slice(0, 3), null, 2)}
                {elements.length > 3 && '\n... and more'}
              </DataList>
            </DataSection>
            <DataSection>
              <h3>Test Plans ({testPlans.length})</h3>
              <DataList>
                {JSON.stringify(testPlans.slice(0, 2), null, 2)}
                {testPlans.length > 2 && '\n... and more'}
              </DataList>
            </DataSection>
          </DataGrid>
          <DataSection>
            <h3>Relationships ({relationships.size})</h3>
            <DataList>
              {Array.from(relationships.entries()).map(([elementId, rel]) => 
                `Element ${elementId}: ${rel.promptRefs.length} references\n`
              ).join('')}
            </DataList>
          </DataSection>
          <DataSection>
            <h3>Debug Log</h3>
            <DataList>
              {logs.join('\n')}
            </DataList>
          </DataSection>
        </CardContent>
      </Card>
    </DebugContainer>
  );
};
export default SyncDebugger;