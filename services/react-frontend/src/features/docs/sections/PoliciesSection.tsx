import React, { useState } from 'react';
import { Shield } from 'lucide-react';
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
  FlowDiagram,
  MetricPill,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const PoliciesSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Shield size={18} /></CardIcon>
          <CardTitle>Policies & Safety Controls</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <TwoColumnLayout>
          <div>
            <p>
              Policies decide how much autonomy self-healing is allowed. You can
              configure thresholds, allowed actions, and review requirements.
            </p>

            <SubSection>
              <SubSectionTitle>Policy Decision Matrix</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Flow Type</th>
                      <th>Risk Level</th>
                      <th>Recommended Policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Public landing pages</td>
                      <td><MetricPill>Low</MetricPill></td>
                      <td>Auto-heal with logging</td>
                    </tr>
                    <tr>
                      <td>User profile, settings</td>
                      <td><MetricPill $tone="info">Medium</MetricPill></td>
                      <td>Require approval for data fields</td>
                    </tr>
                    <tr>
                      <td>Checkout, payments</td>
                      <td><MetricPill $tone="warning">High</MetricPill></td>
                      <td>Always require human review</td>
                    </tr>
                    <tr>
                      <td>Admin destructive actions</td>
                      <td><MetricPill $tone="warning">Critical</MetricPill></td>
                      <td>Disable auto-healing entirely</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>

            <FlowDiagram>
              <p style={{ marginBottom: 4 }}><strong>Configuration Best Practices:</strong></p>
              <ul>
                <li>
                  Start conservative: require review on high-risk flows such as
                  checkout, billing, or destructive actions.
                </li>
                <li>
                  Relax policies only for low-risk UI changes like labels or layout
                  shifts on non-critical pages.
                </li>
                <li>
                  Keep an audit trail: always prefer policies that log why a selector
                  changed and who approved it.
                </li>
                <li>
                  Set confidence thresholds: only auto-heal if AI confidence score exceeds
                  85% and element uniqueness is verified.
                </li>
              </ul>
            </FlowDiagram>

            <InfoBox $variant="warning">
              <strong>Important:</strong> Policies are evaluated at runtime. If you change
              a policy, it affects all new healing proposals immediately but does not
              retroactively modify already-approved decisions.
            </InfoBox>
          </div>
          <div>
            <ScreenshotPlaceholder>
              Policy configuration overview
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

export default PoliciesSection;
