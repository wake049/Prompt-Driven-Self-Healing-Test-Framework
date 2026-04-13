import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
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
  InfoBox,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const AnalyticsInsightsSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><TrendingUp size={18} /></CardIcon>
          <CardTitle>Analytics & AI Insights</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Analytics modules surface health trends, failure clusters, and healing outcomes
          so teams can prioritize reliability work.
        </p>

        <SubSection>
          <SubSectionTitle>Available Views</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>/app/analytics</td>
                  <td>Overview dashboard across projects and time ranges</td>
                </tr>
                <tr>
                  <td>/app/analytics/trends</td>
                  <td>Trend analysis for pass/fail, drift, and regression velocity</td>
                </tr>
                <tr>
                  <td>/app/analytics/ai-insights</td>
                  <td>AI-derived failure patterns and likely root causes</td>
                </tr>
                <tr>
                  <td>/app/analytics/healing-success</td>
                  <td>Healing effectiveness and post-approval outcomes</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
        </SubSection>

        <InfoBox $variant="tip">
          <strong>Operational tip:</strong> Combine trend filters with review queue labels
          to measure whether policy changes reduce repeat selector failures.
        </InfoBox>

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

export default AnalyticsInsightsSection;
