/**
 * Prompts Table Component - Modern design with improved styling
 * Enhanced with gradients, shadows, and better user experience
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { spinKeyframes } from '../../../shared/styles/keyframes';
import { useTheme } from '../../../contexts/ThemeContext';
import { config } from '../../../app/config';
import { promptsApiService, PromptData as APIPromptData, CreatePromptRequest } from '../api';
import { useAuth } from '../../../contexts/AuthContext';
import { RefreshCw, Plus, FileText, Search, Filter, Eye, Edit3 } from 'lucide-react';
// Styled Components with modern design
const Container = styled.div`
  padding: 32px 40px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  width: 100%;
  font-family: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
  @media (max-width: 768px) {
    padding: 16px;
  }
`;
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48px;
  background: ${props => props.theme.colors.surface};
  padding: 32px 40px;
  border-radius: 16px;
  box-shadow: ${props => props.theme.shadows.medium};
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    margin-bottom: 24px;
  }
`;
const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;
const ActionsBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  @media (max-width: 768px) {
    flex-wrap: wrap;
    width: 100%;
    justify-content: center;
  }
`;
const NewButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }
  &:disabled {
    background: #a0aec0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;
const RefreshButton = styled.button`
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  padding: 12px 16px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${props => props.theme.shadows.small};
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.medium};
    background: ${props => props.theme.colors.surface};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;
const SearchContainer = styled.div`
  position: relative;
  width: 300px;
  @media (max-width: 768px) {
    width: 100%;
  }
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px 12px 44px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;
const SearchIcon = styled(Search)`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
  width: 18px;
  height: 18px;
`;
const TableContainer = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.medium};
  margin-bottom: 32px;
`;
const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;
const TableHeader = styled.thead`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.secondary} 100%);
  color: white;
`;
const TableHeaderCell = styled.th`
  padding: 20px 24px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  &:last-child {
    border-right: none;
  }
`;
const TableBody = styled.tbody`
  background: ${props => props.theme.colors.surface};
`;
const TableRow = styled.tr<{ $clickable?: boolean }>`
  border-bottom: 1px solid ${props => props.theme.colors.border};
  transition: all 0.2s ease;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  &:hover {
    background: ${props => props.$clickable ? 'rgba(102, 126, 234, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
    transform: ${props => props.$clickable ? 'translateY(-1px)' : 'none'};
    box-shadow: ${props => props.$clickable ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'};
  }
  &:last-child {
    border-bottom: none;
  }
`;
const TableCell = styled.td`
  padding: 20px 24px;
  border-right: 1px solid ${props => props.theme.colors.border};
  vertical-align: top;
  &:last-child {
    border-right: none;
  }
`;
const PromptTitle = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  font-size: 15px;
  margin-bottom: 4px;
`;
const PromptDescription = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.5;
  font-size: 14px;
`;
const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
const Tag = styled.span<{ color?: string }>`
  display: inline-block;
  padding: 6px 12px;
  background: ${props => props.color ? `${props.color}15` : `${props.theme.colors.primary}15`};
  color: ${props => props.color || props.theme.colors.primary};
  border: 1px solid ${props => props.color ? `${props.color}30` : `${props.theme.colors.primary}30`};
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  &:hover {
    background: ${props => props.color ? `${props.color}25` : `${props.theme.colors.primary}25`};
    transform: translateY(-1px);
  }
`;
const DateText = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
`;
const ActionButton = styled.button`
  background: linear-gradient(135deg, #185FA5, #185FA5);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;
const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  flex-direction: column;
  gap: 16px;
`;
const LoadingSpinner = styled.div`
  border: 2px solid ${props => props.theme.colors.border};
  border-top: 2px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: ${spinKeyframes} 1s linear infinite;
`;
const LoadingText = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;
const ErrorMessage = styled.div`
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border: 1px solid #c85050;
  color: #8a2222;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.2);
`;
const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 32px;
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  box-shadow: ${props => props.theme.shadows.small};
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;
const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const PaginationButton = styled.button`
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
// Modal Components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
`;
const ModalContent = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 40px;
  width: 800px;
  max-width: 95vw;
  box-shadow: ${props => props.theme.shadows.large};
  max-height: 95vh;
  overflow-y: auto;
`;
const ModalHeader = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 24px 0;
`;
const FormGroup = styled.div`
  margin-bottom: 20px;
`;
const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;
const Input = styled.input`
  width: 100%;
  padding: 16px 20px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  background: ${props => props.theme.colors.background};
  box-sizing: border-box;
  transition: all 0.3s ease;
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const TextArea = styled.textarea`
  width: 100%;
  padding: 16px 20px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  background: ${props => props.theme.colors.background};
  resize: vertical;
  min-height: 120px;
  box-sizing: border-box;
  transition: all 0.3s ease;
  font-family: inherit;
  line-height: 1.5;
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`;
const CancelButton = styled.button`
  padding: 12px 24px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover:not(:disabled) {
    background: ${props => props.theme.colors.background};
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;
const SubmitButton = styled.button`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  background: #185FA5;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;
// Helper function to get tag colors
const getTagColor = (tag: string): string => {
  const colors = ['#3b82f6', '#1D9E75', '#f59e0b', '#A32D2D', '#8b5cf6', '#06b6d4'];
  const hash = tag.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};
interface PromptData {
  id: string; // Changed from number to string to match API UUID
  title: string;
  description: string;
  tags: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  dateModified: string;
  content?: string;
  category?: string;
  usage_count?: number;
}
export const PromptsTable: React.FC = () => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [newPrompt, setNewPrompt] = useState({
    title: '',
    description: '',
    content: '',
    category: '',
    tags: '',
    startingUrl: ''
  });
  // Filter prompts based on search term
  const filteredPrompts = prompts.filter(prompt =>
    prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.tags.some(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const promptsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(filteredPrompts.length / promptsPerPage));
  const pageStartIndex = (currentPage - 1) * promptsPerPage;
  const pageEndIndex = pageStartIndex + promptsPerPage;
  const paginatedPrompts = filteredPrompts.slice(pageStartIndex, pageEndIndex);
  // Fetch prompts from authenticated API
  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Starting fetchPrompts...');
      const data = await promptsApiService.getPrompts();
      console.log('🔍 Raw API response:', data);
      
      // Map API data to local PromptData format
      const mappedPrompts: PromptData[] = (data.prompts || []).map(apiPrompt => ({
        id: apiPrompt.id, // Keep as string UUID
        title: apiPrompt.title || 'Untitled',
        description: apiPrompt.description || apiPrompt.content || '',
        tags: apiPrompt.tags ? apiPrompt.tags.map((tag, index) => ({
          id: index,
          name: tag,
          color: getTagColor(tag)
        })) : [],
        dateModified: apiPrompt.dateModified || apiPrompt.updated_at || apiPrompt.created_at || '',
        content: apiPrompt.content || '',
        category: apiPrompt.category,
        usage_count: apiPrompt.usage_count
      }));
      console.log('🔍 Mapped prompts:', mappedPrompts);
      setPrompts(mappedPrompts);
    } catch (err) {
      console.error('❌ Error in fetchPrompts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };
  // Create new prompt via authenticated API
  const createPrompt = async (promptData: {
    title: string;
    description: string;
    content: string;
    category: string;
    tags: string[];
    startingUrl: string;
  }) => {
    try {
      setSubmitting(true);
      // Map local format to API format
      const apiPromptData: CreatePromptRequest = {
        title: promptData.title,
        content: promptData.content,
        description: promptData.description,
        category: promptData.category,
        tags: promptData.tags,
        starting_url: promptData.startingUrl,
      };
      const createdPrompt = await promptsApiService.createPrompt(apiPromptData);
      // Map API response back to local format
      const localPrompt: PromptData = {
        id: createdPrompt.id, // Keep as string UUID
        title: createdPrompt.title,
        description: createdPrompt.description || '',
        tags: (createdPrompt.tags || []).map((tag, index) => ({
          id: index,
          name: tag,
          color: getTagColor(tag)
        })),
        dateModified: createdPrompt.created_at,
        content: createdPrompt.content,
        category: createdPrompt.category,
        usage_count: createdPrompt.usage_count || 0
      };
      // Add the new prompt to the beginning of the list
      setPrompts(prevPrompts => [localPrompt, ...prevPrompts]);
      return localPrompt;
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };
  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, prompts.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleNewPrompt = () => {
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setSubmitting(false);
    setNewPrompt({ title: '', description: '', content: '', category: '', tags: '', startingUrl: '' });
  };
  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Form submitted with data:', newPrompt);
    
    if (!newPrompt.title.trim() || !newPrompt.description.trim()) {
      alert('Please fill in all required fields: Title and Description');
      return;
    }
    const tagsArray = newPrompt.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    try {
      console.log('🚀 Creating prompt...');
      await createPrompt({
        title: newPrompt.title.trim(),
        description: newPrompt.description.trim(),
        content: newPrompt.content.trim(),
        category: newPrompt.category.trim(),
        tags: tagsArray,
        startingUrl: newPrompt.startingUrl.trim()
      });
      console.log('✅ Prompt created successfully');
      handleCloseModal();
    } catch (err) {
      console.error('❌ Error creating prompt:', err);
      alert(`Failed to create prompt: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSubmitting(false);
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setNewPrompt(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleRowClick = (promptId: string) => {
    navigate(`/app/prompts/${promptId}`);
  };
  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Loading prompts...</LoadingText>
        </LoadingContainer>
      </Container>
    );
  }
  return (
    <Container>
      {/* Error message */}
      {error && (
        <ErrorMessage>
          {error}
          <RefreshButton onClick={fetchPrompts}>
            <RefreshCw size={16} />
            Retry
          </RefreshButton>
        </ErrorMessage>
      )}
      {/* Header */}
      <Header>
        <Title>
          <FileText size={32} />
          Prompts
        </Title>
        <ActionsBar>
          <SearchContainer>
            <SearchIcon />
            <SearchInput
              type="text"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchContainer>
          <RefreshButton onClick={fetchPrompts} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </RefreshButton>
          <NewButton onClick={handleNewPrompt}>
            <Plus size={16} />
            New Prompt
          </NewButton>
        </ActionsBar>
      </Header>
      {/* Table Container */}
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <TableHeaderCell style={{ width: '25%' }}>Title</TableHeaderCell>
              <TableHeaderCell style={{ width: '35%' }}>Description</TableHeaderCell>
              <TableHeaderCell style={{ width: '25%' }}>Tags</TableHeaderCell>
              <TableHeaderCell style={{ width: '15%' }}>Date Modified</TableHeaderCell>
            </tr>
          </TableHeader>
          <TableBody>
            {filteredPrompts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} style={{ 
                  textAlign: 'center', 
                  padding: '60px 24px',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  {error ? 'Failed to load prompts' : 
                   searchTerm ? `No prompts found matching "${searchTerm}"` : 
                   'No prompts found'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedPrompts.map((prompt) => (
                <TableRow
                  key={prompt.id}
                  $clickable={true}
                  onClick={() => handleRowClick(prompt.id)}
                >
                  <TableCell>
                    <PromptTitle>{prompt.title}</PromptTitle>
                    {prompt.category && (
                      <Tag color="#1D9E75" style={{ marginTop: '8px' }}>
                        {prompt.category}
                      </Tag>
                    )}
                  </TableCell>
                  <TableCell>
                    <PromptDescription>{prompt.description}</PromptDescription>
                  </TableCell>
                  <TableCell>
                    <TagsContainer>
                      {prompt.tags.map((tag, tagIndex) => (
                        <Tag 
                          key={tagIndex} 
                          color={tag.color}
                        >
                          {tag.name}
                        </Tag>
                      ))}
                    </TagsContainer>
                  </TableCell>
                  <TableCell>
                    <DateText>
                      {prompt.dateModified && prompt.dateModified !== '' ? 
                        new Date(prompt.dateModified).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'N/A'}
                    </DateText>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Footer */}
      <Footer>
        <div>
          Showing {filteredPrompts.length === 0 ? 0 : pageStartIndex + 1}-{Math.min(pageEndIndex, filteredPrompts.length)} of {filteredPrompts.length} prompts
          {searchTerm && ` (filtered by "${searchTerm}")`}
        </div>
        <PaginationControls>
          <span>Rows per page: {promptsPerPage}</span>
          <PaginationButton
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </PaginationButton>
          <PaginationButton disabled>
            Page {currentPage} of {totalPages}
          </PaginationButton>
          <PaginationButton
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </PaginationButton>
        </PaginationControls>
      </Footer>
      {/* New Prompt Modal */}
      {showModal && (
        <ModalOverlay onClick={handleCloseModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>Create New Prompt</ModalHeader>
            <form onSubmit={handleSubmitPrompt}>
              <FormGroup>
                <Label>Title *</Label>
                <Input
                  type="text"
                  value={newPrompt.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter prompt title"
                  disabled={submitting}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Starting URL</Label>
                <Input
                  type="url"
                  value={newPrompt.startingUrl}
                  onChange={(e) => handleInputChange('startingUrl', e.target.value)}
                  placeholder="https://example.com - The initial URL for test execution"
                  disabled={submitting}
                />
              </FormGroup>
              <FormGroup>
                <Label>Description *</Label>
                <TextArea
                  value={newPrompt.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what this prompt does and what it will test"
                  disabled={submitting}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Content</Label>
                <TextArea
                  style={{ minHeight: '180px' }}
                  value={newPrompt.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Enter the detailed prompt content - describe the test scenario, expected user interactions, and validation criteria"
                  disabled={submitting}
                />
              </FormGroup>
              <FormGroup>
                <Label>Category</Label>
                <Input
                  type="text"
                  value={newPrompt.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., functional, performance, security"
                  disabled={submitting}
                />
              </FormGroup>
              <FormGroup>
                <Label>Tags</Label>
                <Input
                  type="text"
                  value={newPrompt.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="Enter tags separated by commas (e.g., auth, login, form)"
                  disabled={submitting}
                />
              </FormGroup>
              <ButtonGroup>
                <CancelButton
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </CancelButton>
                <SubmitButton
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Prompt'}
                </SubmitButton>
              </ButtonGroup>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};