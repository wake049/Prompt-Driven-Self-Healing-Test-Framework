import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { config } from '../../../app/config';
import { useAuth } from '../../../contexts/AuthContext';
import { Breadcrumb } from '../../../shared/ui/Breadcrumb';
import {
  Smartphone,
  Tablet,
  Monitor,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  Edit2,
  X,
  Check,
} from 'lucide-react';

const apiBase = config.apiBaseUrl;

// ---------- Types ----------

interface DeviceProfile {
  id: string;
  organization_id: string;
  profile_name: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
  device_name: string;
  width: number;
  height: number;
  device_scale_factor: number;
  user_agent: string;
  is_mobile: boolean;
  has_touch: boolean;
  is_landscape: boolean;
  is_builtin: boolean;
}

// ---------- Styled Components ----------

const Container = styled.div`
  padding: 32px 64px;
  max-width: 100%;
  min-height: 100vh;
  background: ${props => props.theme?.colors?.background || '#f5f7fa'};
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: ${props => props.theme?.colors?.surface || '#fff'};
  padding: 28px 36px;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
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

const HeaderActions = styled.div`
  display: flex;
  gap: 10px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: ${props => props.variant === 'secondary' ? '1px solid #dee2e6' : 'none'};
  background: ${props =>
    props.variant === 'primary' ? '#185FA5' :
    props.variant === 'danger' ? '#dc3545' :
    '#f8f9fa'};
  color: ${props =>
    props.variant === 'primary' || props.variant === 'danger' ? '#fff' : '#495057'};
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const FilterBtn = styled.button<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid ${props => props.active ? '#185FA5' : '#dee2e6'};
  background: ${props => props.active ? 'rgba(24, 95, 165, 0.08)' : '#fff'};
  color: ${props => props.active ? '#185FA5' : '#495057'};
  transition: all 0.2s;
  &:hover { border-color: #185FA5; }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.div<{ isBuiltin?: boolean }>`
  background: #fff;
  border: 1px solid ${props => props.isBuiltin ? '#e2e8f0' : '#d0d7de'};
  border-radius: 10px;
  padding: 16px 20px;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  &:hover {
    border-color: #185FA5;
    box-shadow: 0 2px 8px rgba(24, 95, 165, 0.08);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const DeviceIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f0f4ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #185FA5;
  flex-shrink: 0;
`;

const CardTitle = styled.div`
  flex: 1;
`;

const DeviceName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px 0;
`;

const CardHint = styled.div`
  font-size: 11px;
  color: #94a3b8;
`;

const DeviceType = styled.span`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6c757d;
  display: inline-block;
  margin-right: 8px;
`;

const BuiltinBadge = styled.span`
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #e8f5e9;
  color: #2e7d32;
  display: inline-block;
  margin-right: 6px;
`;

const SpecRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const Spec = styled.div`
  font-size: 12px;
  color: #495057;
  background: #f8f9fa;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
`;

const UserAgentPreview = styled.div`
  display: none;
`;

const CardActions = styled.div`
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
`;

const SmallBtn = styled.button<{ variant?: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #dee2e6;
  background: ${props => props.variant === 'danger' ? '#fff5f5' : '#fff'};
  color: ${props => props.variant === 'danger' ? '#dc3545' : '#495057'};
  transition: all 0.2s;
  &:hover { background: ${props => props.variant === 'danger' ? '#fee' : '#f0f0f0'}; }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 520px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 24px;
  color: #1a1a2e;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  &:focus { border-color: #185FA5; outline: none; }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  &:focus { border-color: #185FA5; outline: none; }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 13px;
  box-sizing: border-box;
  resize: vertical;
  min-height: 60px;
  &:focus { border-color: #185FA5; outline: none; }
`;

const InlineRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 64px 32px;
  color: #6c757d;
`;

// ---------- Component ----------

export const MobileTestingPage: React.FC = () => {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<DeviceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mobile' | 'tablet'>('all');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    profile_name: '',
    device_type: 'mobile',
    device_name: '',
    width: 390,
    height: 844,
    device_scale_factor: 3.0,
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    is_mobile: true,
    has_touch: true,
    is_landscape: false,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? `${apiBase}/api/v1/device-profiles`
        : `${apiBase}/api/v1/device-profiles?device_type=${filter}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        setProfiles(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch device profiles', e);
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreate = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/device-profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchProfiles();
      }
    } catch (e) {
      console.error('Failed to create device profile', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this custom device profile?')) return;
    try {
      await fetch(`${apiBase}/api/v1/device-profiles/${id}`, {
        method: 'DELETE',
        headers,
      });
      fetchProfiles();
    } catch (e) {
      console.error('Failed to delete device profile', e);
    }
  };

  const getIcon = (type: string) => {
    if (type === 'mobile') return <Smartphone size={22} />;
    if (type === 'tablet') return <Tablet size={22} />;
    return <Monitor size={22} />;
  };

  const filteredProfiles = profiles;
  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    const aBuiltin = a.is_builtin ? 1 : 0;
    const bBuiltin = b.is_builtin ? 1 : 0;
    if (aBuiltin !== bBuiltin) return aBuiltin - bBuiltin;
    return a.device_name.localeCompare(b.device_name);
  });

  return (
    <Container>
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/app/execution' },
        { label: 'Mobile Testing' },
      ]} />

      <Header>
        <div>
          <Title>
            <Smartphone size={28} />
            Mobile Testing
          </Title>
          <Subtitle>
            Manage device profiles for mobile and tablet test execution via Chrome DevTools emulation
          </Subtitle>
        </div>
        <HeaderActions>
          <Button variant="secondary" onClick={fetchProfiles}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> New Device Profile
          </Button>
        </HeaderActions>
      </Header>

      <FilterRow>
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
          All Devices
        </FilterBtn>
        <FilterBtn active={filter === 'mobile'} onClick={() => setFilter('mobile')}>
          <Smartphone size={14} /> Phones
        </FilterBtn>
        <FilterBtn active={filter === 'tablet'} onClick={() => setFilter('tablet')}>
          <Tablet size={14} /> Tablets
        </FilterBtn>
      </FilterRow>

      {loading ? (
        <EmptyState>Loading device profiles...</EmptyState>
      ) : sortedProfiles.length === 0 ? (
        <EmptyState>
          <Smartphone size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No device profiles found. Create a custom profile or run the database migration to load built-in devices.</p>
        </EmptyState>
      ) : (
        <List>
          {sortedProfiles.map(profile => (
            <Card key={profile.id} isBuiltin={profile.is_builtin} onClick={() => setSelectedProfile(profile)}>
              <CardHeader>
                <DeviceIcon>{getIcon(profile.device_type)}</DeviceIcon>
                <CardTitle>
                  <DeviceName>{profile.device_name}</DeviceName>
                  <CardHint>Click row for details</CardHint>
                  <DeviceType>{profile.device_type}</DeviceType>
                </CardTitle>
                {profile.is_builtin && <BuiltinBadge>Built-in</BuiltinBadge>}
              </CardHeader>

              <SpecRow>
                <Spec>{profile.width} × {profile.height}</Spec>
                <Spec>{profile.device_scale_factor}x DPR</Spec>
                {profile.has_touch && <Spec>Touch</Spec>}
                {profile.is_landscape && <Spec>Landscape</Spec>}
              </SpecRow>

              <UserAgentPreview title={profile.user_agent}>
                {profile.user_agent}
              </UserAgentPreview>

              <CardActions>
                {!profile.is_builtin && (
                  <SmallBtn
                    variant="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(profile.id);
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </SmallBtn>
                )}
              </CardActions>
            </Card>
          ))}
        </List>
      )}

      {/* Create Modal */}
      {showModal && (
        <ModalOverlay onClick={() => setShowModal(false)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalTitle>Create Device Profile</ModalTitle>

            <FormGroup>
              <Label>Profile Name</Label>
              <Input
                value={formData.profile_name}
                onChange={e => setFormData(f => ({ ...f, profile_name: e.target.value }))}
                placeholder="e.g. My Custom iPhone"
              />
            </FormGroup>

            <InlineRow>
              <FormGroup>
                <Label>Device Type</Label>
                <Select
                  value={formData.device_type}
                  onChange={e => setFormData(f => ({ ...f, device_type: e.target.value }))}
                >
                  <option value="mobile">Mobile</option>
                  <option value="tablet">Tablet</option>
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>Device Name</Label>
                <Input
                  value={formData.device_name}
                  onChange={e => setFormData(f => ({ ...f, device_name: e.target.value }))}
                  placeholder="e.g. iPhone 15 Pro"
                />
              </FormGroup>
            </InlineRow>

            <InlineRow>
              <FormGroup>
                <Label>Width (px)</Label>
                <Input
                  type="number"
                  value={formData.width}
                  onChange={e => setFormData(f => ({ ...f, width: parseInt(e.target.value) || 0 }))}
                />
              </FormGroup>
              <FormGroup>
                <Label>Height (px)</Label>
                <Input
                  type="number"
                  value={formData.height}
                  onChange={e => setFormData(f => ({ ...f, height: parseInt(e.target.value) || 0 }))}
                />
              </FormGroup>
            </InlineRow>

            <InlineRow>
              <FormGroup>
                <Label>Device Scale Factor</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.device_scale_factor}
                  onChange={e => setFormData(f => ({ ...f, device_scale_factor: parseFloat(e.target.value) || 1 }))}
                />
              </FormGroup>
              <FormGroup>
                <Label>Options</Label>
                <div style={{ display: 'flex', gap: 16, paddingTop: 8 }}>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={formData.has_touch}
                      onChange={e => setFormData(f => ({ ...f, has_touch: e.target.checked }))} />
                    Touch
                  </label>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={formData.is_landscape}
                      onChange={e => setFormData(f => ({ ...f, is_landscape: e.target.checked }))} />
                    Landscape
                  </label>
                </div>
              </FormGroup>
            </InlineRow>

            <FormGroup>
              <Label>User Agent</Label>
              <TextArea
                value={formData.user_agent}
                onChange={e => setFormData(f => ({ ...f, user_agent: e.target.value }))}
              />
            </FormGroup>

            <ModalActions>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                <X size={14} /> Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={!formData.profile_name || !formData.device_name}
              >
                <Check size={14} /> Create Profile
              </Button>
            </ModalActions>
          </Modal>
        </ModalOverlay>
      )}

      {selectedProfile && (
        <ModalOverlay onClick={() => setSelectedProfile(null)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalTitle>{getIcon(selectedProfile.device_type)} {selectedProfile.profile_name}</ModalTitle>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <Button variant="secondary" disabled style={{ fontSize: 12, padding: '2px 8px' }}>
                  {selectedProfile.device_type.charAt(0).toUpperCase() + selectedProfile.device_type.slice(1)}
                </Button>
                {selectedProfile.is_builtin && <BuiltinBadge>Built-in</BuiltinBadge>}
              </div>
              <div style={{ fontSize: 13, color: '#495057', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div><span style={{ fontWeight: 600, color: '#1a1a2e' }}>Device Name:</span> {selectedProfile.device_name}</div>
                <div><span style={{ fontWeight: 600, color: '#1a1a2e' }}>Resolution:</span> {selectedProfile.width} × {selectedProfile.height}</div>
                <div><span style={{ fontWeight: 600, color: '#1a1a2e' }}>Device Scale Factor:</span> {selectedProfile.device_scale_factor}x DPR</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedProfile.has_touch && <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4 }}>Touch</span>}
                  {selectedProfile.is_landscape && <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4 }}>Landscape</span>}
                </div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>User Agent:</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', background: '#f3f4f6', padding: 8, borderRadius: 4, wordBreak: 'break-all', maxHeight: 100, overflow: 'auto' }}>
                    {selectedProfile.user_agent}
                  </div>
                </div>
              </div>
            </div>
            <ModalActions>
              <Button variant="secondary" onClick={() => setSelectedProfile(null)}>
                <X size={14} /> Close
              </Button>
              {!selectedProfile.is_builtin && (
                <Button variant="danger" onClick={() => { handleDelete(selectedProfile.id); setSelectedProfile(null); }}>
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </ModalActions>
          </Modal>
        </ModalOverlay>
      )}
    </Container>
  );
};
