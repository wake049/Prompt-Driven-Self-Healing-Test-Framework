import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  InfoBox,
  SubSection,
  SubSectionTitle,
  CodeContainer,
  CodeBlockInner,
  AccordionItem,
  AccordionHeader,
  AccordionContent,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const ISSUES = [
  'I cannot reach the API',
  'Executions are empty',
  'Healing decisions never appear',
  'The UI looks different from the screenshots',
];

const TroubleshootingSection: React.FC = () => {
  const [openTrouble, setOpenTrouble] = useState<number | null>(0);
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><AlertTriangle size={18} /></CardIcon>
          <CardTitle>Troubleshooting</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        {ISSUES.map((q, idx) => (
          <AccordionItem key={q}>
            <AccordionHeader
              type="button"
              $open={openTrouble === idx}
              onClick={() => setOpenTrouble(openTrouble === idx ? null : idx)}
            >
              <span>{q}</span>
              <span>{openTrouble === idx ? '−' : '+'}</span>
            </AccordionHeader>
            <AccordionContent $open={openTrouble === idx}>
              {idx === 0 && (
                <div>
                  <ul>
                    <li>Confirm Docker services are running.</li>
                    <li>Check that port 8000 is not blocked or in use.</li>
                  </ul>
                  <SubSection>
                    <SubSectionTitle>Diagnostic Commands</SubSectionTitle>
                    <CodeContainer>
                      <CodeBlockInner>
{`# Check if API container is running
docker ps | grep unified-api

# View API logs
docker logs <unified-api-container-name>

# Test API health endpoint
curl https://your-domain.com/health`}
                      </CodeBlockInner>
                    </CodeContainer>
                  </SubSection>
                </div>
              )}
              {idx === 1 && (
                <div>
                  <ul>
                    <li>Verify that sample runs have been created or triggered.</li>
                    <li>Inspect backend logs for any execution errors.</li>
                  </ul>
                  <InfoBox $variant="tip">
                    <strong>Quick fix:</strong> Run the sample data script to populate test executions:
                    <CodeContainer>
                      <CodeBlockInner>
{`psql -h localhost -U testuser -d testdb -f database-migrations/002_sample_data_functions.sql`}
                      </CodeBlockInner>
                    </CodeContainer>
                  </InfoBox>
                </div>
              )}
              {idx === 2 && (
                <div>
                  <ul>
                    <li>Ensure policies allow automatic healing in some scenarios.</li>
                    <li>Confirm that the Java runner and MCP server are communicating.</li>
                  </ul>
                  <SubSection>
                    <SubSectionTitle>Check MCP Server Connection</SubSectionTitle>
                    <CodeContainer>
                      <CodeBlockInner>
{`# Verify MCP server is running
curl https://your-domain.com:8001/health

# Check Java runner logs
tail -f services/java-runner/healing_log.json

# Test policy endpoint
curl https://your-domain.com/api/v1/policy/dashboard/config`}
                      </CodeBlockInner>
                    </CodeContainer>
                  </SubSection>
                </div>
              )}
              {idx === 3 && (
                <div>
                  <ul>
                    <li>
                      Check that you have pulled the latest frontend changes; older builds
                      may not include new documentation or layouts.
                    </li>
                    <li>
                      Clear your browser cache and hard-reload if components appear
                      misaligned or stale.
                    </li>
                  </ul>
                  <InfoBox $variant="info">
                    <strong>Frontend rebuild:</strong> If you've updated code, rebuild the React app:
                    <CodeContainer>
                      <CodeBlockInner>
{`cd services/react-frontend
npm install
npm run build
# Or use the provided script
./start-react-frontend.bat`}
                      </CodeBlockInner>
                    </CodeContainer>
                  </InfoBox>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}

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

export default TroubleshootingSection;
