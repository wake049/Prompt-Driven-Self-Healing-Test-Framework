import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
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
  FlowDiagram,
  FlowRow,
  Arrow,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const ReviewQueueSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><ClipboardList size={18} /></CardIcon>
          <CardTitle>Review Queue Workflow</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          The review queue is where proposed healing decisions are approved or rejected
          before they affect future runs.
        </p>

        <SubSection>
          <SubSectionTitle>Decision Process</SubSectionTitle>
          <NumberedList>
            <li>Open pending items from <code>/app/review</code>.</li>
            <li>Inspect failing step evidence and candidate selector.</li>
            <li>Validate uniqueness and business intent.</li>
            <li>Approve safe candidates or reject risky matches.</li>
            <li>Track post-decision run results to confirm stability.</li>
          </NumberedList>
        </SubSection>

        <FlowDiagram>
          <FlowRow>
            <span>Execution failure</span>
            <Arrow>→</Arrow>
            <span>Proposal generated</span>
            <Arrow>→</Arrow>
            <span>Human review</span>
            <Arrow>→</Arrow>
            <span>Approve / Reject</span>
            <Arrow>→</Arrow>
            <span>Audit trail updated</span>
          </FlowRow>
        </FlowDiagram>

        <InfoBox $variant="warning">
          <strong>Guardrail:</strong> Require reviewer ownership for high-risk flows
          (billing, permissions, destructive actions) and avoid bulk approvals without evidence checks.
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

export default ReviewQueueSection;
