import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Settings, Plus, Trash2, Smartphone, Monitor, Apple, Bot, Puzzle, Search, Loader2, Wifi, WifiOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AppiumConfig {
  id: string;
  organization_id: string;
  name: string;
  config_type: string;
  appium_server_url: string;
  platform_name?: string;
  platform_version?: string;
  device_name?: string;
  automation_name?: string;
  app_path?: string;
  app_package?: string;
  app_activity?: string;
  bundle_id?: string;
  browser_name?: string;
  cloud_provider?: string;
  cloud_username?: string;
  cloud_access_key?: string;
  extra_capabilities?: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
}

const CONFIG_TYPES = [
  { value: 'android-web', label: 'Android Web', icon: '🤖', group: 'Mobile Web' },
  { value: 'ios-web', label: 'iOS Web', icon: '🍎', group: 'Mobile Web' },
  { value: 'android-native', label: 'Android Native', icon: '📦', group: 'Native App' },
  { value: 'ios-native', label: 'iOS Native', icon: '📦', group: 'Native App' },
  { value: 'flutter', label: 'Flutter App', icon: '💙', group: 'Cross-Platform' },
  { value: 'windows', label: 'Windows Desktop', icon: '🪟', group: 'Desktop' },
  { value: 'mac', label: 'Mac Desktop', icon: '🍏', group: 'Desktop' },
];

// ---------------------------------------------------------------------------
// Styled Components
// ---------------------------------------------------------------------------
const Page = styled.div`padding: 32px; max-width: 1100px; margin: 0 auto;`;
const Header = styled.div`display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;`;
const Title = styled.h1`font-size: 24px; font-weight: 700; color: #1a1a2e; display: flex; align-items: center; gap: 10px;`;
const Badge = styled.span`font-size: 12px; padding: 3px 10px; background: #dbeafe; color: #1d4ed8; border-radius: 12px;`;

const FilterRow = styled.div`display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;`;
const FilterBtn = styled.button<{ active: boolean }>`
  padding: 6px 14px; border-radius: 6px; border: 1px solid ${p => p.active ? '#185FA5' : '#dee2e6'};
  background: ${p => p.active ? 'rgba(24,95,165,0.1)' : '#fff'}; color: ${p => p.active ? '#185FA5' : '#495057'};
  cursor: pointer; font-size: 13px; font-weight: 500;
  &:hover { border-color: #185FA5; }
`;

const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;`;
const Card = styled.div<{ builtin?: boolean }>`
  border: 1px solid ${p => p.builtin ? '#e2e8f0' : '#dee2e6'}; border-radius: 10px;
  padding: 20px; background: ${p => p.builtin ? '#f8fafc' : '#fff'};
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
`;
const CardHeader = styled.div`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;`;
const CardTitle = styled.h3`font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 0;`;
const CardBadge = styled.span<{ color?: string }>`
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  background: ${p => p.color || '#f1f5f9'}; color: #475569; font-weight: 500;
`;
const Field = styled.div`font-size: 13px; color: #6b7280; margin-bottom: 4px;`;
const FieldLabel = styled.span`font-weight: 600; color: #374151;`;
const DeleteBtn = styled.button`background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; &:hover { color: #dc2626; }`;

const CreateBtn = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px;
  background: #185FA5; color: #fff; border: none; cursor: pointer; font-weight: 600;
  &:hover { background: #134d8a; }
`;

const Overlay = styled.div`position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100;`;
const Modal = styled.div`background: #fff; border-radius: 12px; padding: 28px; width: 520px; max-height: 85vh; overflow-y: auto;`;
const ModalTitle = styled.h2`font-size: 18px; margin: 0 0 20px 0; color: #1a1a2e;`;
const FormGroup = styled.div`margin-bottom: 14px;`;
const Label = styled.label`display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px;`;
const Input = styled.input`width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;`;
const Select = styled.select`width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff;`;
const BtnRow = styled.div`display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;`;
const SecondaryBtn = styled.button`padding: 8px 16px; border-radius: 8px; background: #f3f4f6; border: 1px solid #d1d5db; cursor: pointer;`;

const BuiltinTag = styled.span`font-size: 10px; padding: 2px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; font-weight: 600;`;

const GatherBtn = styled.button`
  display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px;
  background: #059669; color: #fff; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
  margin-top: 10px; width: 100%;  justify-content: center;
  &:hover { background: #047857; }
  &:disabled { background: #9ca3af; cursor: not-allowed; }
`;

const ConnectBtn = styled.button`
  display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px;
  background: #2563eb; color: #fff; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
  margin-top: 6px; width: 100%; justify-content: center;
  &:hover { background: #1d4ed8; }
  &:disabled { background: #9ca3af; cursor: not-allowed; }
`;

const ConnectionStatus = styled.div<{ ok: boolean }>`
  margin-top: 8px; padding: 8px 12px; border-radius: 6px; font-size: 12px;
  background: ${p => p.ok ? '#f0fdf4' : '#fef2f2'};
  border: 1px solid ${p => p.ok ? '#bbf7d0' : '#fecaca'};
  color: ${p => p.ok ? '#166534' : '#991b1b'};
`;

const ResultsPanel = styled.div`
  margin-top: 24px; border: 1px solid #d1d5db; border-radius: 10px;
  background: #fff; overflow: hidden;
`;
const ResultsHeader = styled.div`
  padding: 16px 20px; background: #f0fdf4; border-bottom: 1px solid #d1d5db;
  display: flex; justify-content: space-between; align-items: center;
`;
const ResultsTitle = styled.h3`font-size: 16px; font-weight: 600; color: #065f46; margin: 0; display: flex; align-items: center; gap: 8px;`;
const ResultsBody = styled.div`padding: 16px 20px; max-height: 500px; overflow-y: auto;`;
const ElementRow = styled.div<{ interactive?: boolean }>`
  padding: 8px 12px; border: 1px solid ${p => p.interactive ? '#bbf7d0' : '#e5e7eb'};
  border-radius: 6px; margin-bottom: 6px;
  background: ${p => p.interactive ? '#f0fdf4' : '#fafafa'};
  font-size: 13px; display: flex; justify-content: space-between; align-items: center;
`;
const ElementTag = styled.span`font-family: monospace; font-size: 12px; padding: 2px 6px; background: #e0e7ff; color: #3730a3; border-radius: 4px;`;
const ElementSelector = styled.span`font-family: monospace; font-size: 11px; color: #6b7280; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const StatBadge = styled.span`font-size: 12px; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 10px; font-weight: 500;`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const AppiumTestingPage: React.FC = () => {
  const [configs, setConfigs] = useState<AppiumConfig[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [gatheringId, setGatheringId] = useState<string | null>(null);
  const [gatherResult, setGatherResult] = useState<any>(null);
  const [gatherError, setGatherError] = useState<string | null>(null);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, any>>({});
  const [form, setForm] = useState<Record<string, string>>({
    name: '', config_type: 'android-web', appium_server_url: 'http://localhost:4723',
    platform_name: '', platform_version: '', device_name: '', automation_name: '',
    app_path: '', app_package: '', app_activity: '', bundle_id: '', browser_name: '',
    cloud_provider: '', cloud_username: '', cloud_access_key: '',
  });

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const url = filter === 'all'
        ? '/api/v1/appium-configs'
        : `/api/v1/appium-configs?config_type=${filter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setConfigs(await res.json());
    } catch (e) { console.error('Failed to fetch Appium configs', e); }
  };

  useEffect(() => { fetchConfigs(); }, [filter]);

  const handleCreate = async () => {
    const token = localStorage.getItem('auth_token');
    const body: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => { if (v) body[k] = v; });
    const res = await fetch('/api/v1/appium-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) { setShowCreate(false); fetchConfigs(); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this Appium configuration?')) return;
    const token = localStorage.getItem('auth_token');
    await fetch(`/api/v1/appium-configs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchConfigs();
  };

  const handleGatherElements = async (id: string) => {
    setGatheringId(id);
    setGatherError(null);
    setGatherResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/appium-configs/${id}/gather-elements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setGatherError(data.detail || 'Failed to gather elements');
      } else {
        setGatherResult(data);
      }
    } catch (e: any) {
      setGatherError(e.message || 'Network error');
    } finally {
      setGatheringId(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingConnectionId(id);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/appium-configs/${id}/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnectionResults(prev => ({ ...prev, [id]: data }));
    } catch (e: any) {
      setConnectionResults(prev => ({ ...prev, [id]: { connected: false, error: e.message || 'Network error' } }));
    } finally {
      setTestingConnectionId(null);
    }
  };

  const isBuiltin = (c: AppiumConfig) => c.organization_id === '00000000-0000-0000-0000-000000000000';
  const typeLabel = (t: string) => CONFIG_TYPES.find(ct => ct.value === t)?.label || t;
  const typeIcon = (t: string) => CONFIG_TYPES.find(ct => ct.value === t)?.icon || '⚙️';

  const selectedType = CONFIG_TYPES.find(ct => ct.value === form.config_type);
  const showAppFields = ['android-native', 'ios-native', 'flutter'].includes(form.config_type);
  const showBrowserField = ['android-web', 'ios-web'].includes(form.config_type);

  return (
    <Page>
      <Header>
        <Title><Settings size={22} /> Appium Testing <Badge>{configs.length} configs</Badge></Title>
        <CreateBtn onClick={() => setShowCreate(true)}><Plus size={16} /> New Config</CreateBtn>
      </Header>

      <FilterRow>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterBtn>
        {CONFIG_TYPES.map(ct => (
          <FilterBtn key={ct.value} active={filter === ct.value} onClick={() => setFilter(ct.value)}>
            {ct.icon} {ct.label}
          </FilterBtn>
        ))}
      </FilterRow>

      <Grid>
        {configs.map(c => (
          <Card key={c.id} builtin={isBuiltin(c)}>
            <CardHeader>
              <div>
                <CardTitle>{typeIcon(c.config_type)} {c.name}</CardTitle>
                <CardBadge>{typeLabel(c.config_type)}</CardBadge>
                {isBuiltin(c) && <> <BuiltinTag>TEMPLATE</BuiltinTag></>}
                {c.is_default && <> <BuiltinTag>DEFAULT</BuiltinTag></>}
              </div>
              {!isBuiltin(c) && (
                <DeleteBtn onClick={() => handleDelete(c.id)} title="Delete"><Trash2 size={16} /></DeleteBtn>
              )}
            </CardHeader>
            <Field><FieldLabel>Server:</FieldLabel> {c.appium_server_url}</Field>
            {c.platform_name && <Field><FieldLabel>Platform:</FieldLabel> {c.platform_name} {c.platform_version}</Field>}
            {c.device_name && <Field><FieldLabel>Device:</FieldLabel> {c.device_name}</Field>}
            {c.automation_name && <Field><FieldLabel>Engine:</FieldLabel> {c.automation_name}</Field>}
            {c.app_path && <Field><FieldLabel>App:</FieldLabel> {c.app_path}</Field>}
            {c.app_package && <Field><FieldLabel>Package:</FieldLabel> {c.app_package}</Field>}
            {c.bundle_id && <Field><FieldLabel>Bundle:</FieldLabel> {c.bundle_id}</Field>}
            {c.browser_name && <Field><FieldLabel>Browser:</FieldLabel> {c.browser_name}</Field>}
            {c.cloud_provider && <Field><FieldLabel>Cloud:</FieldLabel> {c.cloud_provider}</Field>}
            <GatherBtn
              onClick={() => handleGatherElements(c.id)}
              disabled={gatheringId !== null}
            >
              {gatheringId === c.id ? (
                <><Loader2 size={14} className="spin" /> Scanning Screen…</>
              ) : (
                <><Search size={14} /> Gather All Elements</>
              )}
            </GatherBtn>
            <ConnectBtn
              onClick={() => handleTestConnection(c.id)}
              disabled={testingConnectionId !== null}
            >
              {testingConnectionId === c.id ? (
                <><Loader2 size={14} className="spin" /> Checking…</>
              ) : (
                <><Wifi size={14} /> Test Connection</>
              )}
            </ConnectBtn>
            {connectionResults[c.id] && (
              <ConnectionStatus ok={connectionResults[c.id].connected}>
                {connectionResults[c.id].connected ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4 }}>
                      <Wifi size={14} /> Connected
                    </div>
                    <div>Server: ✅ Reachable {connectionResults[c.id].appium_managed && <span style={{ fontSize: 11, color: '#6b7280' }}>(auto-managed)</span>}</div>
                    {connectionResults[c.id].android_devices?.length > 0 && (
                      <div>Devices: {connectionResults[c.id].android_devices.join(', ')}</div>
                    )}
                    {connectionResults[c.id].has_devices === false && (
                      <div style={{ color: '#92400e' }}>⚠️ No devices connected — plug in a device or start an emulator</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4 }}>
                      <WifiOff size={14} /> Not Connected
                    </div>
                    {connectionResults[c.id].server_reachable === false && (
                      <div>Server: ❌ Unreachable — make sure Appium is installed (<code>npm install -g appium</code>)</div>
                    )}
                    {connectionResults[c.id].error && <div>{connectionResults[c.id].error}</div>}
                    {connectionResults[c.id].has_devices === false && <div>No devices detected</div>}
                  </>
                )}
              </ConnectionStatus>
            )}
          </Card>
        ))}
      </Grid>

      {gatherError && (
        <ResultsPanel style={{ marginTop: 24, border: '1px solid #fca5a5' }}>
          <ResultsHeader style={{ background: '#fef2f2' }}>
            <ResultsTitle style={{ color: '#991b1b' }}>❌ Gather Failed</ResultsTitle>
          </ResultsHeader>
          <ResultsBody>
            <p style={{ color: '#991b1b', margin: 0 }}>{gatherError}</p>
          </ResultsBody>
        </ResultsPanel>
      )}

      {gatherResult && (
        <ResultsPanel>
          <ResultsHeader>
            <ResultsTitle>
              <Search size={18} /> Elements Gathered — {gatherResult.page_name}
            </ResultsTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBadge>{gatherResult.stats?.total_elements || 0} total</StatBadge>
              <StatBadge style={{ background: '#dcfce7', color: '#166534' }}>
                {gatherResult.stats?.interactive_elements || 0} interactive
              </StatBadge>
              <StatBadge style={{ background: '#fef3c7', color: '#92400e' }}>
                {gatherResult.stats?.stored_count || 0} stored
              </StatBadge>
            </div>
          </ResultsHeader>
          <ResultsBody>
            {(gatherResult.elements || []).map((el: any, i: number) => (
              <ElementRow key={i} interactive={el.interactive}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <ElementTag>{el.tag}</ElementTag>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {el.text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>no text</span>}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {el.interactive && <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>interactive</span>}
                  <ElementSelector title={Object.values(el.selectors || {})[0] as string}>
                    {Object.values(el.selectors || {})[0] as string || '—'}
                  </ElementSelector>
                </div>
              </ElementRow>
            ))}
            {(gatherResult.elements || []).length === 0 && (
              <p style={{ color: '#6b7280', textAlign: 'center', margin: '20px 0' }}>No elements found on screen.</p>
            )}
          </ResultsBody>
        </ResultsPanel>
      )}

      {showCreate && (
        <Overlay onClick={() => setShowCreate(false)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalTitle>New Appium Configuration</ModalTitle>
            <FormGroup>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My Android Config" />
            </FormGroup>
            <FormGroup>
              <Label>Config Type</Label>
              <Select value={form.config_type} onChange={e => setForm({ ...form, config_type: e.target.value })}>
                {CONFIG_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.icon} {ct.label} ({ct.group})</option>)}
              </Select>
            </FormGroup>
            <FormGroup>
              <Label>Appium Server URL</Label>
              <Input value={form.appium_server_url} onChange={e => setForm({ ...form, appium_server_url: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label>Platform Name</Label>
              <Input value={form.platform_name} onChange={e => setForm({ ...form, platform_name: e.target.value })} placeholder="Android / iOS / Windows / Mac" />
            </FormGroup>
            <FormGroup>
              <Label>Platform Version</Label>
              <Input value={form.platform_version} onChange={e => setForm({ ...form, platform_version: e.target.value })} placeholder="14 / 17.0 / 10" />
            </FormGroup>
            <FormGroup>
              <Label>Device Name</Label>
              <Input value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} placeholder="Android Emulator / iPhone 15 Simulator" />
            </FormGroup>
            <FormGroup>
              <Label>Automation Engine</Label>
              <Input value={form.automation_name} onChange={e => setForm({ ...form, automation_name: e.target.value })} placeholder="UiAutomator2 / XCUITest / Flutter / Windows / Mac2" />
            </FormGroup>
            {showAppFields && (
              <>
                <FormGroup>
                  <Label>App Path (APK / IPA / EXE)</Label>
                  <Input value={form.app_path} onChange={e => setForm({ ...form, app_path: e.target.value })} placeholder="/path/to/app.apk" />
                </FormGroup>
                {form.config_type.startsWith('android') || form.config_type === 'flutter' ? (
                  <>
                    <FormGroup><Label>App Package</Label><Input value={form.app_package} onChange={e => setForm({ ...form, app_package: e.target.value })} placeholder="com.example.app" /></FormGroup>
                    <FormGroup><Label>App Activity</Label><Input value={form.app_activity} onChange={e => setForm({ ...form, app_activity: e.target.value })} placeholder=".MainActivity" /></FormGroup>
                  </>
                ) : (
                  <FormGroup><Label>Bundle ID</Label><Input value={form.bundle_id} onChange={e => setForm({ ...form, bundle_id: e.target.value })} placeholder="com.example.app" /></FormGroup>
                )}
              </>
            )}
            {showBrowserField && (
              <FormGroup>
                <Label>Browser Name</Label>
                <Input value={form.browser_name} onChange={e => setForm({ ...form, browser_name: e.target.value })} placeholder="Chrome / Safari" />
              </FormGroup>
            )}
            <FormGroup>
              <Label>Cloud Provider (optional)</Label>
              <Select value={form.cloud_provider} onChange={e => setForm({ ...form, cloud_provider: e.target.value })}>
                <option value="">Local (no cloud)</option>
                <option value="browserstack">BrowserStack</option>
                <option value="saucelabs">Sauce Labs</option>
              </Select>
            </FormGroup>
            {form.cloud_provider && (
              <>
                <FormGroup><Label>Cloud Username</Label><Input value={form.cloud_username} onChange={e => setForm({ ...form, cloud_username: e.target.value })} /></FormGroup>
                <FormGroup><Label>Cloud Access Key</Label><Input type="password" value={form.cloud_access_key} onChange={e => setForm({ ...form, cloud_access_key: e.target.value })} /></FormGroup>
              </>
            )}
            <BtnRow>
              <SecondaryBtn onClick={() => setShowCreate(false)}>Cancel</SecondaryBtn>
              <CreateBtn onClick={handleCreate}>Create Config</CreateBtn>
            </BtnRow>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
};

export default AppiumTestingPage;
