import React, { useState } from 'react';
import { BookOpen, PlayCircle, ArrowRight } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  TwoColumnLayout,
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardMeta,
  CardBody,
  NumberedList,
  ScreenshotPlaceholder,
  InfoBox,
  SubSection,
  SubSectionTitle,
  StepBadge,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
  RelatedRow,
  RelatedLink,
  VideoPlaceholder,
} from '../docs.styles';

const QuickStartSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <TwoColumnLayout>
      <Card>
        <CardHeader>
          <CardTitleRow>
            <CardIcon><BookOpen size={18} /></CardIcon>
            <CardTitle>Quick Start Guide</CardTitle>
          </CardTitleRow>
          <CardMeta>Approx. 5 minutes</CardMeta>
        </CardHeader>
        <CardBody>
          <p>
            Use this flow when you want to go from a fresh browser window
            to inspecting real healing decisions as quickly as possible.
            It assumes you are running the full docker stack locally.
          </p>
          <InfoBox $variant="info">
            <strong>Prerequisites:</strong> Docker Desktop running, ports 3000/8000/5432 available,
            and the full stack started via <code>docker-compose up</code> or the local start script.
          </InfoBox>

          <SubSection>
            <SubSectionTitle><StepBadge>1</StepBadge>Launch Onboarding</SubSectionTitle>
            <p>Navigate to <code>https://your-domain.com</code> and click "Get Started".
            This begins the multi-step registration wizard that handles account creation,
            organization setup, and plan selection in one flow.</p>
          </SubSection>

          <SubSection>
            <SubSectionTitle><StepBadge>2</StepBadge>Create Account & Organization</SubSectionTitle>
            <p>Fill in your name, email, and password. Choose the plan that fits your team.
            The system will create:</p>
            <ul>
              <li>A new user account</li>
              <li>An organization record with your user as owner</li>
              <li>A subscription entry for entitlement and usage tracking</li>
            </ul>
          </SubSection>

          <SubSection>
            <SubSectionTitle><StepBadge>3</StepBadge>Explore Execution Dashboard</SubSectionTitle>
            <p>After onboarding completes (~30 seconds), you'll land on the execution dashboard.
            Recent test runs appear in the dashboard, including examples of passed,
            failed, and pending review scenarios for healing workflows.</p>
          </SubSection>

          <SubSection>
            <SubSectionTitle><StepBadge>4</StepBadge>Inspect Healing Decisions</SubSectionTitle>
            <p>Click any run with "pending_review" status. You'll see:</p>
            <ul>
              <li>Step-by-step execution timeline with screenshots</li>
              <li>Element context snapshots (attributes, text, position)</li>
              <li>AI-proposed selector changes with confidence scores</li>
              <li>Request/response payloads for API-driven steps</li>
            </ul>
          </SubSection>

          <SubSection>
            <SubSectionTitle><StepBadge>5</StepBadge>Review & Approve Changes</SubSectionTitle>
            <p>Navigate to the Review Queue from the sidebar. Each pending item shows
            before/after selector comparisons. Approve to update the test plan, or reject
            to keep the original selector and flag the element for manual investigation.</p>
          </SubSection>

          <InfoBox $variant="tip">
            <strong>Pro tip:</strong> Try the "Prompts" page to generate new test plans via
            natural language. The AI will create executable Selenium steps that automatically
            feed into this same healing workflow.
          </InfoBox>
          <ScreenshotPlaceholder>
            Onboarding wizard overview illustration
          </ScreenshotPlaceholder>
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
          <RelatedRow>
            <RelatedLink type="button">
              <ArrowRight size={12} /> View onboarding visuals
            </RelatedLink>
          </RelatedRow>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitleRow>
            <CardIcon><PlayCircle size={18} /></CardIcon>
            <CardTitle>Video Tutorial</CardTitle>
          </CardTitleRow>
          <CardMeta>Video library</CardMeta>
        </CardHeader>
        <CardBody>
          <VideoPlaceholder>
            <PlayCircle size={24} />
            <span>Walkthrough video library</span>
          </VideoPlaceholder>
        </CardBody>
      </Card>
    </TwoColumnLayout>
  );
};

export default QuickStartSection;
