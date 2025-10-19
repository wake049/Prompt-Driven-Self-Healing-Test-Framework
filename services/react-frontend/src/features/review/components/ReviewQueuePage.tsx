import React from "react";
import styled from 'styled-components';
import { ReviewItem, ReviewStatus, SuggestAlternative } from "../types";
import { ReviewAPI } from "../api";

// ================================
// Styled Components
// ================================

const Container = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  background-color: #f8f9fa;
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
`;

const Stats = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const StatBadge = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 8px 16px;
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: #007bff;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  text-transform: uppercase;
  font-weight: 600;
`;

const RefreshButton = styled.button`
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #218838;
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  font-size: 1.1rem;
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  
  h3 {
    margin: 0 0 16px 0;
    color: #495057;
  }
  
  p {
    margin: 0 0 24px 0;
    line-height: 1.5;
  }
`;

const ReviewGrid = styled.div`
  display: grid;
  gap: 20px;
`;

const ReviewCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

const ReviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const ReviewInfo = styled.div`
  flex: 1;
`;

const PageBadge = styled.div`
  background-color: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 8px;
  display: inline-block;
`;

const ElementId = styled.h3`
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
`;

const CodeBlock = styled.code`
  background-color: #f1f3f4;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  color: #495057;
  word-break: break-all;
`;

const LocatorSection = styled.div`
  margin: 12px 0;
  
  & > div {
    margin-bottom: 8px;
    font-size: 0.9rem;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const SectionLabel = styled.span`
  font-weight: 600;
  color: #495057;
  margin-right: 8px;
`;

const AIReasoning = styled.div`
  margin: 16px 0;
  padding: 12px;
  background-color: #e3f2fd;
  border-radius: 6px;
  border-left: 4px solid #2196f3;
  
  .label {
    font-weight: 600;
    color: #1976d2;
    font-size: 0.85rem;
    margin-bottom: 4px;
  }
  
  .text {
    color: #0d47a1;
    font-size: 0.9rem;
    line-height: 1.4;
  }
`;

const MetaInfo = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
  font-size: 0.8rem;
  color: #6c757d;
  
  .confidence {
    display: inline-block;
    margin-right: 16px;
  }
  
  .timestamp {
    display: inline-block;
  }
`;

const ReviewActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch (props.status) {
      case 'pending':
        return 'background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7;';
      case 'approved':
        return 'background-color: #d1ecf1; color: #0c5460; border: 1px solid #b8daff;';
      case 'rejected':
        return 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
      case 'verified_fail':
        return 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
      default:
        return 'background-color: #e2e3e5; color: #383d41; border: 1px solid #ced4da;';
    }
  }}
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'success' | 'danger' | 'secondary' }>`
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  ${props => {
    switch (props.variant) {
      case 'success':
        return `
          background-color: #28a745;
          color: white;
          &:hover:not(:disabled) { background-color: #218838; }
        `;
      case 'danger':
        return `
          background-color: #dc3545;
          color: white;
          &:hover:not(:disabled) { background-color: #c82333; }
        `;
      case 'primary':
        return `
          background-color: #007bff;
          color: white;
          &:hover:not(:disabled) { background-color: #0056b3; }
        `;
      default:
        return `
          background-color: #f8f9fa;
          color: #495057;
          border: 1px solid #ced4da;
          &:hover:not(:disabled) { background-color: #e2e6ea; }
        `;
    }
  }}
`;

const AlternativesSection = styled.div`
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
`;

const AlternativesTitle = styled.div`
  font-weight: 600;
  color: #495057;
  margin-bottom: 12px;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const AlternativesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const AlternativeItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const AlternativeInfo = styled.div`
  flex: 1;
  
  .selector {
    margin-bottom: 4px;
  }
  
  .meta {
    font-size: 0.8rem;
    color: #6c757d;
    
    .confidence {
      margin-right: 12px;
    }
  }
`;

const UseButton = styled.button`
  padding: 6px 12px;
  background-color: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #138496;
  }
`;

// ================================
// Badge Component
// ================================



function Badge({ ok }: { ok: boolean }) {
  return (
    <StatusBadge status={ok ? 'approved' : 'rejected'}>
      {ok ? "PASS" : "FAIL"}
    </StatusBadge>
  );
}

// ================================
// Component
// ================================

export default function ReviewQueuePage() {
  const [items, setItems] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [verifying, setVerifying] = React.useState<string | null>(null);
  const [suggesting, setSuggesting] = React.useState<string | null>(null);
  const [alts, setAlts] = React.useState<Record<string, SuggestAlternative[]>>({});
  const [error, setError] = React.useState<string | null>(null);
  localStorage.setItem("auth_token", "your-secret-token-here");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ReviewAPI.listPending(1, 50);
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load review items");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("auth_token", "your-secret-token-here"); // temp
    console.log("🔵 ReviewQueuePage mounted");
    (async () => {
      try {
        console.log("🟣 listPending() firing…");
        const data = await ReviewAPI.listPending(1, 50);
        console.log("📡 Pending reviews:", data);
        setItems(data);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load review items");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleStatus(id: string, status: ReviewStatus) {
    try {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      await ReviewAPI.updateStatus(id, { status });
    } catch (e: any) {
      setError(e?.message ?? "Failed to update status");
      fetchData();
    }
  }

  async function handleVerify(id: string) {
    try {
      setVerifying(id);
      const res = await ReviewAPI.verify(id, {});
      const ok = res.heuristic_pass && res.functional_pass;
      alert(
        `Heuristic: ${res.heuristic_pass ? "PASS" : "FAIL"}\nFunctional: ${
          res.functional_pass ? "PASS" : "FAIL"
        }`
      );
      if (!ok) await ReviewAPI.updateStatus(id, { status: "verified_fail" });
    } catch (e: any) {
      setError(e?.message ?? "Verify failed");
    } finally {
      setVerifying(null);
      fetchData();
    }
  }

  async function handleSuggest(id: string, page: string, oldLocator?: string) {
    try {
      setSuggesting(id);
      const res = await ReviewAPI.suggest(
        { page, old_locator: oldLocator, max_alternatives: 3 },
        3
      );
      setAlts((prev) => ({ ...prev, [id]: res.alternatives }));
    } catch (e: any) {
      setError(e?.message ?? "Suggest failed");
    } finally {
      setSuggesting(null);
    }
  }

  async function handleBatchApproveHealing() {
    try {
      const healingItems = items.filter(
        item => item.suggested_by === "java_self_healing_engine" && item.status === "pending"
      );
      
      if (healingItems.length === 0) {
        alert("No pending self-healing items to approve");
        return;
      }
      
      const confirmMessage = `Are you sure you want to approve all ${healingItems.length} self-healing items?`;
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Approve each healing item
      for (const item of healingItems) {
        await handleStatus(item.id, "approved");
      }
      
      alert(`Successfully approved ${healingItems.length} self-healing items!`);
      fetchData(); // Refresh the list
      
    } catch (e: any) {
      setError(e?.message ?? "Failed to batch approve healing items");
    }
  }

  const pendingCount = items.filter(item => item.status === 'pending').length;
  const approvedCount = items.filter(item => item.status === 'approved').length;
  const rejectedCount = items.filter(item => item.status === 'rejected').length;

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Loading review items...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>
          <strong>Error:</strong> {error}
        </ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <div>
          <Title>Review Queue</Title>
          <Stats>
            <StatBadge>
              <StatNumber>{items.length}</StatNumber>
              <StatLabel>Total Items</StatLabel>
            </StatBadge>
            <StatBadge>
              <StatNumber>{pendingCount}</StatNumber>
              <StatLabel>Pending</StatLabel>
            </StatBadge>
            <StatBadge>
              <StatNumber>{approvedCount}</StatNumber>
              <StatLabel>Approved</StatLabel>
            </StatBadge>
            <StatBadge>
              <StatNumber>{rejectedCount}</StatNumber>
              <StatLabel>Rejected</StatLabel>
            </StatBadge>
          </Stats>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {items.filter(item => item.suggested_by === "java_self_healing_engine" && item.status === "pending").length > 0 && (
            <RefreshButton 
              onClick={() => handleBatchApproveHealing()}
              style={{ backgroundColor: '#28a745' }}
            >
              ✅ Approve All Self-Healing
            </RefreshButton>
          )}
          <RefreshButton onClick={fetchData} disabled={loading}>
            🔄 {loading ? 'Loading...' : 'Refresh'}
          </RefreshButton>
        </div>
      </Header>

      {items.length === 0 && (
        <EmptyMessage>
          <h3>No review items found</h3>
          <p>🎉 All caught up! No pending reviews at the moment.</p>
        </EmptyMessage>
      )}

      {items.length > 0 && (
        <ReviewGrid>
          {items.map((item) => (
            <ReviewCard key={item.id}>
              <ReviewHeader>
                <ReviewInfo>
                  <PageBadge>{item.page}</PageBadge>
                  <ElementId>
                    {item.element_id}
                    {item.suggested_by === "java_self_healing_engine" && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '0.7rem', 
                        background: '#28a745', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        fontWeight: 'normal'
                      }}>
                        SELF-HEALED
                      </span>
                    )}
                  </ElementId>
                  
                  <LocatorSection>
                    <div>
                      <SectionLabel>Suggested:</SectionLabel>
                      <CodeBlock>{item.suggested_locator}</CodeBlock>
                    </div>
                    {item.old_locator && (
                      <div>
                        <SectionLabel>Previous:</SectionLabel>
                        <CodeBlock>{item.old_locator}</CodeBlock>
                      </div>
                    )}
                  </LocatorSection>

                  {item.ai_reasoning && (
                    <AIReasoning>
                      <div className="label">AI Reasoning</div>
                      <div className="text">{item.ai_reasoning}</div>
                    </AIReasoning>
                  )}

                  <MetaInfo>
                    <span className="confidence">
                      Confidence: {(item.confidence_score ?? 0).toFixed(2)}
                    </span>
                    <span className="timestamp">
                      Created {new Date(item.created_at).toLocaleString()}
                    </span>
                    {item.suggested_by === "java_self_healing_engine" && item.action_payload && (
                      <>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: '#28a745' }}>
                          🔧 Auto-healed during test execution
                        </span>
                        {item.action_payload.healing_timestamp && (
                          <span style={{ marginLeft: '12px', fontSize: '0.75rem' }}>
                            Healed: {new Date(item.action_payload.healing_timestamp as string).toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  </MetaInfo>
                </ReviewInfo>

                <ReviewActions>
                  <StatusBadge status={item.status}>{item.status}</StatusBadge>
                  
                  <ActionButtonGroup>
                    <ActionButton
                      onClick={() => handleVerify(item.id)}
                      disabled={verifying === item.id}
                      variant="primary"
                    >
                      {verifying === item.id ? "Verifying..." : "Verify"}
                    </ActionButton>
                    <ActionButton
                      onClick={() => handleStatus(item.id, "approved")}
                      variant="success"
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      onClick={() => handleStatus(item.id, "rejected")}
                      variant="danger"
                    >
                      Reject
                    </ActionButton>
                  </ActionButtonGroup>

                  <ActionButton
                    onClick={() =>
                      handleSuggest(
                        item.id,
                        item.page,
                        item.old_locator ?? item.suggested_locator
                      )
                    }
                    disabled={suggesting === item.id}
                  >
                    {suggesting === item.id ? "Suggesting..." : "🔍 Suggest Alternatives"}
                  </ActionButton>
                </ReviewActions>
              </ReviewHeader>

              {/* Healing attempts display */}
              {item.suggested_by === "java_self_healing_engine" && item.action_payload && 
               Array.isArray((item.action_payload as any).attempted_alternatives) && (
                <AlternativesSection>
                  <AlternativesTitle>Attempted Healing Alternatives</AlternativesTitle>
                  <AlternativesList>
                    {((item.action_payload as any).attempted_alternatives as string[]).map((alt: string, idx: number) => (
                      <AlternativeItem key={idx}>
                        <AlternativeInfo>
                          <div className="selector">
                            <CodeBlock>{alt}</CodeBlock>
                          </div>
                          <div className="meta">
                            <span className="result">
                              {alt === item.suggested_locator ? "✅ SUCCESS" : "❌ FAILED"}
                            </span>
                          </div>
                        </AlternativeInfo>
                      </AlternativeItem>
                    ))}
                  </AlternativesList>
                </AlternativesSection>
              )}
              
              {/* Alternative suggestions */}
              {alts[item.id]?.length ? (
                <AlternativesSection>
                  <AlternativesTitle>Alternative Suggestions</AlternativesTitle>
                  <AlternativesList>
                    {alts[item.id].map((alt, idx) => (
                      <AlternativeItem key={idx}>
                        <AlternativeInfo>
                          <div className="selector">
                            <CodeBlock>{alt.selector}</CodeBlock>
                          </div>
                          <div className="meta">
                            <span className="confidence">
                              Confidence: {(alt.confidence * 100).toFixed(0)}%
                            </span>
                            {alt.ai_reasoning && (
                              <span className="reasoning">{alt.ai_reasoning}</span>
                            )}
                          </div>
                        </AlternativeInfo>
                        <UseButton
                          onClick={() => {
                            setItems((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      suggested_locator: alt.selector,
                                      confidence_score: alt.confidence,
                                      ai_reasoning: alt.ai_reasoning ?? i.ai_reasoning,
                                    }
                                  : i
                              )
                            );
                          }}
                        >
                          Use This
                        </UseButton>
                      </AlternativeItem>
                    ))}
                  </AlternativesList>
                </AlternativesSection>
              ) : null}
            </ReviewCard>
          ))}
        </ReviewGrid>
      )}
    </Container>
  );
}
