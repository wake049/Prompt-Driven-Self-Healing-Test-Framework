import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  InfoBox,
  CodeContainer,
  CodeBlockInner,
  AccordionItem,
  AccordionHeader,
  AccordionContent,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const FAQS = [
  'Is this a production service?',
  'Do I need real credentials or data?',
  'Can I reset environment data?',
  'How should I report issues or bugs?',
];

const FaqsSection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><HelpCircle size={18} /></CardIcon>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        {FAQS.map((q, idx) => (
          <AccordionItem key={q}>
            <AccordionHeader
              type="button"
              $open={openFaq === idx}
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <span>{q}</span>
              <span>{openFaq === idx ? '−' : '+'}</span>
            </AccordionHeader>
            <AccordionContent $open={openFaq === idx}>
              {idx === 0 && (
                <div>
                  <p>Yes. FluxTest is intended for production test operations and governed automation workflows.</p>
                  <InfoBox $variant="info">
                    <strong>Recommended practice:</strong>
                    <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
                      <li>Use role-based access controls for operational safety</li>
                      <li>Apply policy thresholds before enabling broad auto-healing</li>
                      <li>Keep environment and data segmentation aligned to your governance model</li>
                      <li>Establish backup and incident response processes</li>
                    </ul>
                  </InfoBox>
                </div>
              )}
              {idx === 1 && (
                <div>
                  <p>Use controlled test accounts and least-privilege credentials for automation runs.</p>
                  <InfoBox $variant="warning">
                    <strong>Data Safety:</strong> Avoid production secrets in test steps,
                    rotate credentials regularly, and align retention policies with your
                    security and compliance requirements.
                  </InfoBox>
                </div>
              )}
              {idx === 2 && (
                <div>
                  <p>
                    If your deployment supports resets, use your approved operational
                    runbook to restore known-good state and reapply required migrations.
                  </p>
                  <CodeContainer>
                    <CodeBlockInner>
{`# Example reset flow (environment-specific)
docker-compose down -v
docker-compose up -d postgres
# Reapply baseline migrations according to your runbook`}
                    </CodeBlockInner>
                  </CodeContainer>
                </div>
              )}
              {idx === 3 && (
                <p>
                  Report issues through your standard support channel with reproduction
                  steps, timestamps, and affected run IDs so engineering can triage quickly.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}

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

export default FaqsSection;
