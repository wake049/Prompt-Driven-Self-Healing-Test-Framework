import React, { useState } from 'react';
import { Package } from 'lucide-react';
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
  NumberedList,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const TestSuitesDataSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Package size={18} /></CardIcon>
          <CardTitle>Test Suites & Data Sources</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Build reliable suites by combining prompt generation with structured document
          parsing and API-backed test data.
        </p>

        <SubSection>
          <SubSectionTitle>Authoring Surface</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Use case</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>/app/prompts</td>
                  <td>Create and refine prompt-driven test plans</td>
                </tr>
                <tr>
                  <td>/app/test-suites</td>
                  <td>Group tests, manage suites, and run by suite scope</td>
                </tr>
                <tr>
                  <td>/app/document-to-tests</td>
                  <td>Generate tests from requirement or flow documents</td>
                </tr>
                <tr>
                  <td>/app/api-test-data</td>
                  <td>Manage data payloads and seeded test inputs</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
        </SubSection>

        <SubSection>
          <SubSectionTitle>Recommended Pipeline</SubSectionTitle>
          <NumberedList>
            <li>Create first-pass cases via prompts or document conversion.</li>
            <li>Attach stable input datasets for repeatable execution.</li>
            <li>Group into suites by business flow and risk level.</li>
            <li>Run smoke suite first, then full regression suite.</li>
          </NumberedList>
        </SubSection>

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

export default TestSuitesDataSection;
