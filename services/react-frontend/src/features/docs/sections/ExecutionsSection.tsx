import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  TwoColumnLayout,
  InfoBox,
  SubSection,
  SubSectionTitle,
  ScreenshotPlaceholder,
  MetricPillRow,
  MetricPill,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const ExecutionsSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Activity size={18} /></CardIcon>
          <CardTitle>Executions & Dashboards</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          The execution dashboard shows recent runs and high-level health. Use it to
          navigate into specific runs and to understand overall flakiness across your
          test suite.
        </p>

        <SubSection>
          <SubSectionTitle>Execution Status Reference</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Meaning</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><MetricPill $tone="success">passed</MetricPill></td>
                  <td>All steps executed successfully with no element drift</td>
                  <td>No action needed; monitor for patterns</td>
                </tr>
                <tr>
                  <td><MetricPill $tone="warning">failed</MetricPill></td>
                  <td>One or more steps failed; no healing possible</td>
                  <td>Review logs, update test or app code</td>
                </tr>
                <tr>
                  <td><MetricPill $tone="info">pending_review</MetricPill></td>
                  <td>Steps failed but AI proposed selector fixes</td>
                  <td>Open Review Queue to approve/reject changes</td>
                </tr>
                <tr>
                  <td><MetricPill>healed</MetricPill></td>
                  <td>Previously failed, now passing with new selectors</td>
                  <td>Verify functionality, monitor stability</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
        </SubSection>

        <TwoColumnLayout>
          <div>
            <ScreenshotPlaceholder>
              Execution dashboard with filters and metrics illustration
            </ScreenshotPlaceholder>
            <MetricPillRow>
              <MetricPill $tone="success">Healing success %</MetricPill>
              <MetricPill $tone="warning">Failed steps</MetricPill>
              <MetricPill $tone="info">Pending review items</MetricPill>
            </MetricPillRow>
          </div>
          <div>
            <SubSectionTitle>Key Metrics Explained</SubSectionTitle>
            <ul>
              <li><strong>30-day healing success rate:</strong> Percentage of failed steps
              where AI-proposed selectors were approved and subsequently passed</li>
              <li><strong>Top failure patterns:</strong> Most common locator types or actions
              causing test breaks, grouped by CSS selector, XPath, or interaction type</li>
              <li><strong>Average execution duration:</strong> Mean runtime across all test
              cases, useful for detecting performance regressions</li>
              <li><strong>Element drift frequency:</strong> How often selectors need updating,
              indicating UI volatility</li>
            </ul>
            <InfoBox $variant="tip">
              Use filters at the top of the dashboard to slice by project, tag, or
              timeframe. Selecting a run opens a detailed view with step-by-step
              screenshots and any healing proposals raised for that execution.
            </InfoBox>
            <ScreenshotPlaceholder>
              Sample data visualization
            </ScreenshotPlaceholder>
          </div>
        </TwoColumnLayout>

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

export default ExecutionsSection;
