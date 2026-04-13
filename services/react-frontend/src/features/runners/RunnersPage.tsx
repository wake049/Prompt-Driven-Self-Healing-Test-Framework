import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import {
  Monitor,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Wifi,
  WifiOff,
  Chrome,
  Globe,
  Terminal,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { config } from '../../app/config';

const apiBase = config.apiBaseUrl;

// ---------- Types ----------

interface Runner {
  id: string;
  runner_name: string;
  capabilities: string[] | string;
  hostname: string | null;
  os_name: string | null;
  status: 'online' | 'offline';
  last_heartbeat: string | null;
  registered_at: string;
  organization_id?: string;
}

interface LogEntry {
  id: number;
  execution_id: string | null;
  level: string;
  message: string;
  timestamp: string | null;
}

// ---------- Styled Components ----------

const Container = styled.div`
  padding: 32px 40px;
  max-width: 1200px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Subtitle = styled.p`
  color: #6c757d;
  margin: 4px 0 0;
  font-size: 14px;
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  color: #495057;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  &:hover { background: #e9ecef; }
`;

const StatsRow = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
`;

const StatCard = styled.div<{ $color?: string }>`
  flex: 1;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px 24px;
  border-left: 4px solid ${props => props.$color || '#0066cc'};
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: #6c757d;
  margin-top: 4px;
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6c757d;
  border-bottom: 2px solid #e9ecef;
`;

const Td = styled.td`
  padding: 14px 16px;
  font-size: 14px;
  color: #495057;
  border-bottom: 1px solid #f1f3f5;
`;

const StatusBadge = styled.span<{ $online?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.$online ? '#d4edda' : '#f8d7da'};
  color: ${props => props.$online ? '#155724' : '#721c24'};
`;

const CapBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  background: #e3f2fd;
  color: #1565c0;
  margin-right: 4px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
`;

const SetupCard = styled.div`
  background: #f8f9fa;
  border: 1px dashed #ced4da;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const SetupTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SetupSteps = styled.ol`
  margin: 0;
  padding-left: 20px;
  color: #495057;
  line-height: 2;
  font-size: 14px;
`;

const CodeBlock = styled.code`
  background: #1a1a2e;
  color: #a8e6cf;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Fira Code', monospace;
`;

const DownloadRunnerButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #185FA5;
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #124a82;
  }
`;

const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  color: #495057;
  cursor: pointer;
  font-size: 12px;
  margin-left: 8px;
  transition: all 0.2s;
  &:hover { background: #e9ecef; }
`;

const TimeAgo = styled.span`
  color: #868e96;
  font-size: 13px;
`;

const RunnerRow = styled.tr<{ $selected?: boolean }>`
  cursor: pointer;
  transition: background 0.15s;
  background: ${props => props.$selected ? '#e3f2fd' : 'transparent'};
  &:hover { background: ${props => props.$selected ? '#e3f2fd' : '#f8f9fa'}; }
`;

const LogPanel = styled.div`
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
  max-height: 420px;
  overflow-y: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  position: relative;
`;

const LogPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const LogPanelTitle = styled.span`
  color: #a8e6cf;
  font-weight: 600;
  font-size: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LogControls = styled.div`
  display: flex;
  gap: 8px;
`;

const LogControlButton = styled.button<{ $active?: boolean }>`
  padding: 4px 10px;
  background: ${props => props.$active ? '#0066cc' : '#2a2a4a'};
  border: 1px solid ${props => props.$active ? '#0066cc' : '#3a3a5a'};
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 11px;
  &:hover { background: ${props => props.$active ? '#0055aa' : '#3a3a5a'}; }
`;

const LogLine = styled.div<{ $level?: string }>`
  color: ${props => {
    switch (props.$level) {
      case 'ERROR': return '#ff6b6b';
      case 'WARN': return '#ffd93d';
      case 'DEBUG': return '#868e96';
      default: return '#c3c3c3';
    }
  }};
  white-space: pre-wrap;
  word-break: break-all;
`;

const LogTimestamp = styled.span`
  color: #6c757d;
  margin-right: 8px;
`;

const LogLevel = styled.span<{ $level?: string }>`
  font-weight: 600;
  margin-right: 8px;
  color: ${props => {
    switch (props.$level) {
      case 'ERROR': return '#ff6b6b';
      case 'WARN': return '#ffd93d';
      case 'DEBUG': return '#868e96';
      default: return '#a8e6cf';
    }
  }};
`;

const EmptyLogs = styled.div`
  color: #6c757d;
  text-align: center;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
`;

const CloseLogButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  color: #868e96;
  cursor: pointer;
  padding: 4px;
  &:hover { color: #e0e0e0; }
`;

// ---------- Helpers ----------

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const d = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function parseCapabilities(caps: string[] | string): string[] {
  if (Array.isArray(caps)) return caps;
  try { return JSON.parse(caps); } catch { return [String(caps)]; }
}

const browserIcon = (cap: string) => {
  if (cap.includes('chrome')) return <Chrome size={12} />;
  if (cap.includes('firefox') || cap.includes('edge') || cap.includes('safari'))
    return <Globe size={12} />;
  return <Monitor size={12} />;
};

// ---------- Component ----------

const RunnersPage: React.FC = () => {
  const { tenant, token } = useAuth();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveTail, setLiveTail] = useState(true);
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const logPanelRef = React.useRef<HTMLDivElement>(null);

  const fetchRunners = useCallback(async () => {
    setLoading(true);
    try {
      const orgParam = tenant?.id ? `?organization_id=${tenant.id}` : '';
      const response = await fetch(`${apiBase}/api/v1/runners/list${orgParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRunners(data.runners || []);
      }
    } catch (err) {
      console.error('Failed to fetch runners:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, token]);

  useEffect(() => {
    fetchRunners();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchRunners, 15000);
    return () => clearInterval(interval);
  }, [fetchRunners]);

  // Fetch logs for the selected runner
  const fetchLogs = useCallback(async (runnerId: string, afterId?: number | null) => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (afterId != null) params.set('after_id', String(afterId));
      const response = await fetch(
        `${apiBase}/api/v1/runners/logs/${runnerId}?${params}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const newLogs: LogEntry[] = data.logs || [];
        if (afterId != null && newLogs.length > 0) {
          // Append mode (live tail)
          setLogs(prev => [...prev, ...newLogs]);
        } else if (afterId == null) {
          // Full fetch
          setLogs(newLogs);
        }
        if (newLogs.length > 0) {
          setLastLogId(newLogs[newLogs.length - 1].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch runner logs:', err);
    }
  }, [token]);

  // When selected runner changes, fetch full logs
  useEffect(() => {
    if (selectedRunnerId) {
      setLogs([]);
      setLastLogId(null);
      fetchLogs(selectedRunnerId);
    }
  }, [selectedRunnerId, fetchLogs]);

  // Live tail: poll for new logs every 3 seconds
  useEffect(() => {
    if (!selectedRunnerId || !liveTail) return;
    const interval = setInterval(() => {
      fetchLogs(selectedRunnerId, lastLogId);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRunnerId, liveTail, lastLogId, fetchLogs]);

  // Auto-scroll log panel to bottom when new logs arrive
  useEffect(() => {
    if (liveTail && logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [logs, liveTail]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const onlineRunners = runners.filter(r => r.status === 'online');
  const offlineRunners = runners.filter(r => r.status === 'offline');
  const allCapabilities = [...new Set(runners.flatMap(r => parseCapabilities(r.capabilities)))];

  return (
    <Container>
      <Header>
        <div>
          <Title><Monitor size={28} /> Runner Agents</Title>
          <Subtitle>
            Remote test execution agents connected to your organization
          </Subtitle>
        </div>
        <HeaderActions>
          <DownloadRunnerButton href={`${apiBase}/api/v1/runners/download`} download>
            <Download size={14} /> Download Runner Agent
          </DownloadRunnerButton>
          <RefreshButton onClick={fetchRunners}>
            <RefreshCw size={14} /> Refresh
          </RefreshButton>
        </HeaderActions>
      </Header>

      {/* Stats */}
      <StatsRow>
        <StatCard $color="#28a745">
          <StatValue>{onlineRunners.length}</StatValue>
          <StatLabel>Online</StatLabel>
        </StatCard>
        <StatCard $color="#dc3545">
          <StatValue>{offlineRunners.length}</StatValue>
          <StatLabel>Offline</StatLabel>
        </StatCard>
        <StatCard $color="#0066cc">
          <StatValue>{runners.length}</StatValue>
          <StatLabel>Total Runners</StatLabel>
        </StatCard>
        <StatCard $color="#6f42c1">
          <StatValue>{allCapabilities.length}</StatValue>
          <StatLabel>Browser Types</StatLabel>
        </StatCard>
      </StatsRow>

      {/* Setup guide when no runners */}
      {runners.length === 0 && !loading && (
        <SetupCard>
          <SetupTitle><Download size={18} /> Set Up Your First Runner</SetupTitle>
          <SetupSteps>
            <li>
              Download the runner ZIP:{' '}
              <DownloadRunnerButton href={`${apiBase}/api/v1/runners/download`} download>
                <Download size={14} /> Download Runner Agent
              </DownloadRunnerButton>
            </li>
            <li>Unzip and edit <CodeBlock>runner-config.properties</CodeBlock></li>
            <li>
              Set your Organization ID:{' '}
              {tenant?.id ? (
                <>
                  <CodeBlock>{tenant.id}</CodeBlock>
                  <CopyButton onClick={() => copyToClipboard(tenant.id, 'org-id')}>
                    {copied === 'org-id' ? <CheckCircle size={12} /> : <Copy size={12} />}
                    {copied === 'org-id' ? 'Copied!' : 'Copy'}
                  </CopyButton>
                </>
              ) : (
                <CodeBlock>{'<your-org-id>'}</CodeBlock>
              )}
            </li>
            <li>
              Set the API URL: <CodeBlock>{apiBase}</CodeBlock>
              <CopyButton onClick={() => copyToClipboard(apiBase, 'api-url')}>
                {copied === 'api-url' ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied === 'api-url' ? 'Copied!' : 'Copy'}
              </CopyButton>
            </li>
            <li>
              Run <CodeBlock>start-runner.bat</CodeBlock> (Windows) or{' '}
              <CodeBlock>./start-runner.sh</CodeBlock> (Mac/Linux)
            </li>
          </SetupSteps>
        </SetupCard>
      )}

      {/* Runner table */}
      <Card>
        <CardTitle>
          {runners.length > 0 ? 'Connected Runners' : 'No Runners Connected'}
        </CardTitle>

        {runners.length === 0 && !loading ? (
          <EmptyState>
            <EmptyIcon><Terminal size={48} /></EmptyIcon>
            <p>No runner agents have connected yet.</p>
            <p>Follow the setup guide above to connect your first runner.</p>
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Name</Th>
                <Th>Host</Th>
                <Th>OS</Th>
                <Th>Browsers</Th>
                <Th>Last Seen</Th>
                <Th>Registered</Th>
              </tr>
            </thead>
            <tbody>
              {runners.map(runner => {
                const caps = parseCapabilities(runner.capabilities);
                const isOnline = runner.status === 'online';
                const isSelected = selectedRunnerId === runner.id;
                return (
                  <RunnerRow
                    key={runner.id}
                    $selected={isSelected}
                    onClick={() => setSelectedRunnerId(isSelected ? null : runner.id)}
                  >
                    <Td>
                      <StatusBadge $online={isOnline}>
                        {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isOnline ? 'Online' : 'Offline'}
                      </StatusBadge>
                    </Td>
                    <Td style={{ fontWeight: 600 }}>{runner.runner_name}</Td>
                    <Td>{runner.hostname || '—'}</Td>
                    <Td>{runner.os_name || '—'}</Td>
                    <Td>
                      {caps.map(cap => (
                        <CapBadge key={cap}>
                          {browserIcon(cap)} {cap}
                        </CapBadge>
                      ))}
                    </Td>
                    <Td>
                      <TimeAgo>
                        <Clock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                        {formatTimeAgo(runner.last_heartbeat)}
                      </TimeAgo>
                    </Td>
                    <Td>
                      <TimeAgo>{formatTimeAgo(runner.registered_at)}</TimeAgo>
                    </Td>
                  </RunnerRow>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Live Log Viewer */}
      {selectedRunnerId && (
        <Card>
          <LogPanel ref={logPanelRef}>
            <CloseLogButton onClick={() => setSelectedRunnerId(null)}>
              <X size={16} />
            </CloseLogButton>
            <LogPanelHeader>
              <LogPanelTitle>
                <Terminal size={16} />
                Logs — {runners.find(r => r.id === selectedRunnerId)?.runner_name || 'Runner'}
              </LogPanelTitle>
              <LogControls>
                <LogControlButton
                  $active={liveTail}
                  onClick={() => setLiveTail(!liveTail)}
                >
                  {liveTail ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Live</>}
                </LogControlButton>
                <LogControlButton onClick={() => {
                  setLogs([]);
                  setLastLogId(null);
                  fetchLogs(selectedRunnerId);
                }}>
                  <RefreshCw size={10} /> Reload
                </LogControlButton>
              </LogControls>
            </LogPanelHeader>
            {logs.length === 0 ? (
              <EmptyLogs>No logs available for this runner yet.</EmptyLogs>
            ) : (
              logs.map(entry => (
                <LogLine key={entry.id} $level={entry.level}>
                  <LogTimestamp>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}
                  </LogTimestamp>
                  <LogLevel $level={entry.level}>{entry.level.padEnd(5)}</LogLevel>
                  {entry.execution_id && (
                    <span style={{ color: '#6c8ebf', marginRight: 8 }}>
                      [{entry.execution_id.slice(0, 8)}]
                    </span>
                  )}
                  {entry.message}
                </LogLine>
              ))
            )}
          </LogPanel>
        </Card>
      )}
    </Container>
  );
};

export default RunnersPage;
