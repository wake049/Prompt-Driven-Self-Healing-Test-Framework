import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
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
  InfoBox,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const OrganizationSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Building2 size={18} /></CardIcon>
          <CardTitle>Organization & Workspace Settings</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Organization controls define workspace ownership, access policies, and
          operating boundaries for teams.
        </p>

        <SubSection>
          <SubSectionTitle>Core Responsibilities</SubSectionTitle>
          <NumberedList>
            <li>Manage organization identity and ownership.</li>
            <li>Set role-based permissions for contributors and reviewers.</li>
            <li>Align policy defaults to risk tolerance.</li>
            <li>Review usage and entitlement state for planning.</li>
          </NumberedList>
        </SubSection>

        <InfoBox $variant="warning">
          <strong>Governance:</strong> Restrict admin-level actions to trusted operators
          and review role assignments regularly as teams change.
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

export default OrganizationSection;
