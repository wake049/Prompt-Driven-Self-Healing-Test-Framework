import React, { useState } from 'react';
import { Settings } from 'lucide-react';
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
  SubSection,
  SubSectionTitle,
  ScreenshotPlaceholder,
  FlowDiagram,
  FlowRow,
  Arrow,
  TableWrapper,
  DataTable,
  FeedbackRow,
  FeedbackButtons,
  FeedbackButton,
} from '../docs.styles';

const SelfHealingSection: React.FC = () => {
  const [feedback, setFeedback] = useState<'yes' | 'no' | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitleRow>
          <CardIcon><Settings size={18} /></CardIcon>
          <CardTitle>Element Review & Self-Healing</CardTitle>
        </CardTitleRow>
      </CardHeader>
      <CardBody>
        <TwoColumnLayout>
          <div>
            <p>
              When locators drift, the system can propose new selectors using collected
              element context. You review those proposals before they become the new
              source of truth.
            </p>
            <p>
              Each proposal bundles together the failing selector, the candidate
              replacement, and evidence like text content, attributes, and DOM position
              so you can decide whether the suggestion is safe.
            </p>

            <SubSection>
              <SubSectionTitle>How Self-Healing Works</SubSectionTitle>
              <NumberedList>
                <li><strong>Detection:</strong> Selenium fails to find element with original selector</li>
                <li><strong>Analysis:</strong> MCP server inspects page context, extracts element attributes,
                text, position, and adjacent elements</li>
                <li><strong>Generation:</strong> AI proposes alternative selectors (CSS, XPath, text-based)
                ranked by stability and specificity</li>
                <li><strong>Validation:</strong> System tests candidate selectors against current page state</li>
                <li><strong>Review:</strong> Human approves or rejects via Review Queue UI</li>
                <li><strong>Application:</strong> Approved selector updates test plan for future runs</li>
              </NumberedList>
            </SubSection>

            <SubSection>
              <SubSectionTitle>Selector Strategy Comparison</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Pros</th>
                      <th>Cons</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>ID</td>
                      <td>Fast, unique</td>
                      <td>Fragile if IDs change</td>
                    </tr>
                    <tr>
                      <td>CSS Class</td>
                      <td>Readable, reusable</td>
                      <td>May match multiple elements</td>
                    </tr>
                    <tr>
                      <td>XPath</td>
                      <td>Powerful traversal</td>
                      <td>Verbose, breaks with structure changes</td>
                    </tr>
                    <tr>
                      <td>Text Content</td>
                      <td>User-centric, robust</td>
                      <td>Fails with i18n or dynamic text</td>
                    </tr>
                    <tr>
                      <td>data-testid</td>
                      <td>Explicit, stable</td>
                      <td>Requires developer cooperation</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>

            <FlowDiagram>
              <FlowRow>
                <span>Test run fails</span>
                <Arrow>→</Arrow>
                <span>Element analysis</span>
                <Arrow>→</Arrow>
                <span>Healing proposal</span>
                <Arrow>→</Arrow>
                <span>Human review</span>
                <Arrow>→</Arrow>
                <span>Approved selector</span>
              </FlowRow>
            </FlowDiagram>
          </div>
          <div>
            <ScreenshotPlaceholder>
              Before/after selector example
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

export default SelfHealingSection;
