import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitleRow,
  CardIcon,
  CardTitle,
  CardBody,
  TwoColumnLayout,
  SubSection,
  SubSectionTitle,
  NumberedList,
  ScreenshotPlaceholder,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const PageContextElementsSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Globe size={18} /></CardIcon>
          <CardTitle>Page Context & Elements</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <p>
          Use Page Context and Elements together to keep selectors resilient and
          to reduce noisy healing proposals.
        </p>

        <TwoColumnLayout>
          <div>
            <SubSection>
              <SubSectionTitle>Recommended Workflow</SubSectionTitle>
              <NumberedList>
                <li>Capture or verify page context in <code>/app/page-context</code>.</li>
                <li>Review tracked selectors in <code>/app/elements</code>.</li>
                <li>Normalize naming and remove duplicate element definitions.</li>
                <li>Validate high-risk selectors before scheduling large runs.</li>
              </NumberedList>
            </SubSection>

            <SubSection>
              <SubSectionTitle>What to Track Per Element</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Why it matters</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Primary selector</td>
                      <td>Baseline locator used at execution time</td>
                    </tr>
                    <tr>
                      <td>Fallback attributes</td>
                      <td>Improves recovery when UI structure shifts</td>
                    </tr>
                    <tr>
                      <td>Page/flow ownership</td>
                      <td>Helps route review decisions to correct teams</td>
                    </tr>
                    <tr>
                      <td>Stability notes</td>
                      <td>Documents known volatility for policy tuning</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>
          </div>
          <div>
            <ScreenshotPlaceholder>
              Page context and element inventory overview
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

export default PageContextElementsSection;
