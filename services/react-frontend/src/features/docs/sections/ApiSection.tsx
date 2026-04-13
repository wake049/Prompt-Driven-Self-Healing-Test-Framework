import React, { useMemo, useState } from 'react';
import { Code2 } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  SubSection,
  SubSectionTitle,
  TableWrapper,
  DataTable,
  TabsHeader,
  TabButton,
  CodeContainer,
  CodeBlockInner,
  CopyButton,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

interface CodeSample {
  id: string;
  label: string;
  code: string;
}

const CodeSampleTabs: React.FC<{ samples: CodeSample[] }> = ({ samples }) => {
  const [activeId, setActiveId] = useState(samples[0]?.id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeSample = useMemo(
    () => samples.find(s => s.id === activeId) ?? samples[0],
    [samples, activeId]
  );

  const handleCopy = async () => {
    try {
      if (!activeSample) return;
      await navigator.clipboard?.writeText(activeSample.code);
      setCopiedId(activeSample.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard errors in restricted browser contexts.
    }
  };

  if (!activeSample) return null;

  return (
    <div>
      <TabsHeader>
        {samples.map(s => (
          <TabButton key={s.id} $active={s.id === activeId} onClick={() => setActiveId(s.id)}>
            {s.label}
          </TabButton>
        ))}
      </TabsHeader>
      <CodeContainer>
        <CopyButton type="button" onClick={handleCopy}>
          {copiedId === activeSample.id ? 'Copied!' : 'Copy'}
        </CopyButton>
        <CodeBlockInner>{activeSample.code}</CodeBlockInner>
      </CodeContainer>
    </div>
  );
};

const ApiSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Code2 size={18} /></CardIcon>
          <CardTitle>API Reference</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Core endpoints for driving the self-healing workflow programmatically. These
          examples assume you are talking to a local unified API at
          <code> https://your-domain.com</code>.
        </p>

        <SubSection>
          <SubSectionTitle>Endpoint Reference</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Method</th>
                  <th>Purpose</th>
                  <th>Auth Required</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>/api/v1/plan</td>
                  <td>POST</td>
                  <td>Generate test plan from NL prompt</td>
                  <td>Yes (Bearer token)</td>
                </tr>
                <tr>
                  <td>/api/v1/dashboard/executions</td>
                  <td>GET</td>
                  <td>List all executions for org</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>/api/v1/dashboard/execution/:id</td>
                  <td>GET</td>
                  <td>Fetch single execution with steps</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>/api/v1/review/queue</td>
                  <td>GET</td>
                  <td>Get pending healing decisions</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>/api/v1/review/decision/:id</td>
                  <td>POST</td>
                  <td>Approve or reject a healing proposal</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>/api/v1/policy/dashboard/config</td>
                  <td>GET</td>
                  <td>View current policy settings</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>/api/v1/policy/update</td>
                  <td>PUT</td>
                  <td>Modify healing policy thresholds</td>
                  <td>Yes (admin only)</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
        </SubSection>

        <SubSection>
          <SubSectionTitle>Example Request & Response</SubSectionTitle>
          <p>The <code>/api/v1/plan</code> endpoint expects a JSON body with a prompt field
          and returns a structured test plan with steps, assertions, and metadata:</p>
        </SubSection>

        <CodeSampleTabs
          samples={[
            {
              id: 'curl',
              label: 'curl',
              code: 'curl -X POST https://your-domain.com/api/v1/plan \\\n  -H "Content-Type: application/json" \\\n  -d "{\\"prompt\\": \\"login to the app\\"}"',
            },
            {
              id: 'python',
              label: 'Python',
              code: 'import requests\n\nresp = requests.post(\n    "https://your-domain.com/api/v1/plan",\n    json={"prompt": "login to the app"},\n)\nprint(resp.json())',
            },
            {
              id: 'js',
              label: 'JavaScript',
              code: 'const resp = await fetch("https://your-domain.com/api/v1/plan", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ prompt: "login to the app" }),\n});\nconst data = await resp.json();\nconsole.log(data);',
            },
          ]}
        />

        <FeedbackRow>
          <span>Was this helpful?</span>
          <FeedbackButtons>
            <FeedbackButton type="button" $active={feedback === 'yes'} onClick={() => setFeedback('yes')}>
              <ThumbsUp size={14} /> Yes
            </FeedbackButton>
            <FeedbackButton type="button" $active={feedback === 'no'} onClick={() => setFeedback('no')}>
              <ThumbsDown size={14} /> No
            </FeedbackButton>
          </FeedbackButtons>
        </FeedbackRow>
      </CardBody>
    </Card>
  );
};

export default ApiSection;
