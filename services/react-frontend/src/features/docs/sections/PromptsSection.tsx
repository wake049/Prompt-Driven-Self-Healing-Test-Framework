import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  TwoColumnLayout,
  FlowDiagram,
  CodeContainer,
  CodeBlockInner,
  PromptExampleGrid,
  PromptExampleCard,
  PromptExampleLabel,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const PromptsSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><BookOpen size={18} /></CardIcon>
          <CardTitle>Prompt Generation</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <TwoColumnLayout>
          <div>
            <p>
              This UI talks to a planning API that turns natural language
              into executable test plans. The quality of those plans depends
              heavily on how you phrase your prompt.
            </p>
            <FlowDiagram>
              <p style={{ marginBottom: 4, fontWeight: 600 }}>Structure of a strong prompt</p>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                <li><strong>Context</strong>: which app area, environment, and user role.</li>
                <li><strong>Goal</strong>: what behavior or path you want validated.</li>
                <li><strong>Constraints</strong>: data, safety, or policy limits.</li>
                <li><strong>Output</strong>: level of detail (short plan vs. full steps).</li>
              </ul>
            </FlowDiagram>
            <p style={{ marginTop: 10 }}>Aim for one focused task per prompt. If you need
              onboarding, dashboards, and policies tested, send separate prompts so
              each plan stays readable and safe to review.</p>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Good vs. bad prompts</p>
            <PromptExampleGrid>
              <PromptExampleCard>
                <PromptExampleLabel $tone="bad">Weak prompt</PromptExampleLabel>
                <CodeContainer>
                  <CodeBlockInner>
{`Test everything in the app
and fix whatever is broken.`}
                  </CodeBlockInner>
                </CodeContainer>
                <p style={{ marginTop: 6 }}>
                  No page, role, or safety limits. The system cannot tell what is in
                  scope or how risky changes might be.
                </p>
              </PromptExampleCard>
              <PromptExampleCard>
                <PromptExampleLabel $tone="improved">Improved but incomplete</PromptExampleLabel>
                <CodeContainer>
                  <CodeBlockInner>
{`Run regression tests for login
and basic navigation.`}
                  </CodeBlockInner>
                </CodeContainer>
                <p style={{ marginTop: 6 }}>
                  Better goal, but still missing environment, concrete checks, and what
                  must not change.
                </p>
              </PromptExampleCard>
              <PromptExampleCard>
                <PromptExampleLabel $tone="good">High-quality prompt</PromptExampleLabel>
                <CodeContainer>
                  <CodeBlockInner>
{`Plan a test for the primary workspace environment.
- Start on /login as a standard user.
- Use an approved non-admin test account.
- Verify we land on the execution dashboard with at least one recent run.
- Do not edit policies or billing settings.
- Return 5–8 clear steps with assertions.`}
                  </CodeBlockInner>
                </CodeContainer>
                <p style={{ marginTop: 6 }}>
                  Explicit context, goal, constraints, and output instructions produce a
                  reviewable plan aligned with production workflows.
                </p>
              </PromptExampleCard>
            </PromptExampleGrid>
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

export default PromptsSection;
