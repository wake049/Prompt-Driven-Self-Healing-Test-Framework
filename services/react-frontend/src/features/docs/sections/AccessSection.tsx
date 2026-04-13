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
  NumberedList,
  InfoBox,
  SubSection,
  SubSectionTitle,
  FlowDiagram,
  FlowRow,
  Arrow,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const AccessSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Activity size={18} /></CardIcon>
          <CardTitle>Getting Access</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Access is managed through onboarding and standard sign-in flows. Users can
          create a new account or sign in with an existing workspace account.
        </p>

        <InfoBox $variant="warning">
          <strong>Security Notice:</strong> Use strong credentials, enforce role-based access,
          and follow your organization's identity and data governance policies.
        </InfoBox>

        <SubSection>
          <SubSectionTitle>Authentication Flow</SubSectionTitle>
          <TableWrapper>
            <DataTable>
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Action</th>
                  <th>Backend</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. Registration</td>
                  <td>POST user credentials</td>
                  <td>/api/v1/auth/register</td>
                </tr>
                <tr>
                  <td>2. Token Generation</td>
                  <td>Server issues JWT</td>
                  <td>Returns token in response</td>
                </tr>
                <tr>
                  <td>3. Session Storage</td>
                  <td>Token saved to localStorage</td>
                  <td>Included in all subsequent requests</td>
                </tr>
                <tr>
                  <td>4. Dashboard Redirect</td>
                  <td>Navigate to /app</td>
                  <td>Protected route validates token</td>
                </tr>
              </tbody>
            </DataTable>
          </TableWrapper>
        </SubSection>

        <TwoColumnLayout>
          <div>
            <SubSectionTitle>Step-by-Step Guide</SubSectionTitle>
            <NumberedList>
              <li>Open the landing page and click "Get Started".</li>
              <li>Provide your name, email, and password.</li>
              <li>
                Complete organization and plan details to align workspace access,
                limits, and governance behavior.
              </li>
              <li>
                Finish setup to be redirected into the app. Your browser session will
                remain active until sign-out or token expiration.
              </li>
            </NumberedList>
          </div>
          <FlowDiagram>
            <FlowRow>
              <span>Landing Page</span>
              <Arrow>→</Arrow>
              <span>Onboarding Wizard</span>
            </FlowRow>
            <FlowRow>
              <span>Account Step</span>
              <Arrow>→</Arrow>
              <span>Org & Plan</span>
              <Arrow>→</Arrow>
              <span>Dashboard</span>
            </FlowRow>
          </FlowDiagram>
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

export default AccessSection;
