import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  TwoColumnLayout,
  NumberedList,
  InfoBox,
  SubSection,
  SubSectionTitle,
  ScreenshotPlaceholder,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const RunnerSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><PlayCircle size={18} /></CardIcon>
          <CardTitle>Runner Setup & Usage</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Runners execute generated test steps in a controlled browser environment.
          Use this section to connect, validate, and operate runners safely.
        </p>

        <SubSection>
          <SubSectionTitle>What a Runner Does</SubSectionTitle>
          <ul>
            <li>Receives execution jobs from the platform</li>
            <li>Launches browser sessions and runs each step in order</li>
            <li>Streams step status, failures, and timing data back to dashboards</li>
            <li>Returns evidence used by failure analysis and review workflows</li>
          </ul>
        </SubSection>

        <TwoColumnLayout>
          <div>
            <SubSectionTitle>Runner Bring-Up Checklist</SubSectionTitle>
            <NumberedList>
              <li>Open the Runners page from the app navigation.</li>
              <li>Confirm the runner is online and marked healthy.</li>
              <li>Verify the target browser profile is available.</li>
              <li>Run a small smoke execution before full suite runs.</li>
              <li>Review run logs for startup or environment warnings.</li>
            </NumberedList>
          </div>
          <div>
            <InfoBox $variant="tip">
              <strong>Operational tip:</strong> keep at least one dedicated runner for
              quick validation jobs and separate runners for heavier suites to reduce queue delays.
            </InfoBox>
            <ScreenshotPlaceholder>
              Runners status and health overview illustration
            </ScreenshotPlaceholder>
          </div>
        </TwoColumnLayout>

        <SubSection>
          <SubSectionTitle>Common Runner Issues</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Likely Cause</th>
                  <th>Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Runner offline</td>
                  <td>Service not started or connectivity interruption</td>
                  <td>Restart runner process and verify network reachability</td>
                </tr>
                <tr>
                  <td>Browser launch fails</td>
                  <td>Browser dependency or profile mismatch</td>
                  <td>Validate runner browser configuration and retry</td>
                </tr>
                <tr>
                  <td>Queue backlog</td>
                  <td>Insufficient runner capacity for active workload</td>
                  <td>Add runner capacity or stagger high-volume jobs</td>
                </tr>
                <tr>
                  <td>Intermittent step timeouts</td>
                  <td>Environment latency or unstable app state</td>
                  <td>Increase step timeout policy and check app-side performance</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
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

export default RunnerSection;
