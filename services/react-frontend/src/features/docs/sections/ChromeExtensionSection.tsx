import React, { useState } from 'react';
import { Chrome } from 'lucide-react';
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

const ChromeExtensionSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Chrome size={18} /></CardIcon>
          <CardTitle>Chrome Extension Integration</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          The extension helps with browser-assisted capture and streamlined workflow
          handoff into the application.
        </p>

        <SubSection>
          <SubSectionTitle>Setup Checklist</SubSectionTitle>
          <NumberedList>
            <li>Open extension setup in <code>/app/chrome-extension</code>.</li>
            <li>Install and enable the extension in Chrome.</li>
            <li>Confirm extension connection status from the app.</li>
            <li>Run a quick capture/validation flow before team rollout.</li>
          </NumberedList>
        </SubSection>

        <InfoBox $variant="info">
          <strong>Tip:</strong> If capture actions fail, verify Chrome profile permissions
          and extension enablement after browser updates.
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

export default ChromeExtensionSection;
