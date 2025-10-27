/**
 * Prompts Table Component - Clean, professional table design
 * Matches the style shown in the reference image
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../../../app/config';
import { promptsApiService, PromptData as APIPromptData, CreatePromptRequest } from '../api';
import { useAuth } from '../../../contexts/AuthContext';

// Helper function to get tag colors
const getTagColor = (tag: string): string => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
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

const tableStyles = {
  container: {
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  wrapper: {
    padding: '40px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    margin: '0'
  },
  newButton: {
    backgroundColor: '#0d9488',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as 'collapse',
    fontSize: '14px'
  },
  thead: {
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb'
  },
  th: {
    padding: '12px 24px',
    textAlign: 'left' as 'left',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    borderRight: '1px solid #e5e7eb'
  },
  thLast: {
    padding: '12px 24px',
    textAlign: 'left' as 'left',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  tbody: {
    backgroundColor: '#ffffff'
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
    cursor: 'pointer'
  },
  trHover: {
    backgroundColor: '#f9fafb'
  },
  td: {
    padding: '16px 24px',
    borderRight: '1px solid #f3f4f6',
    verticalAlign: 'top' as 'top'
  },
  tdLast: {
    padding: '16px 24px',
    verticalAlign: 'top' as 'top'
  },
  titleCell: {
    fontWeight: '500',
    color: '#111827'
  },
  descriptionCell: {
    color: '#374151',
    lineHeight: '1.5'
  },
  tag: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    marginRight: '4px',
    marginBottom: '4px'
  },
  dateCell: {
    color: '#6b7280'
  },
  footer: {
    marginTop: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#6b7280'
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  paginationButton: {
    padding: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    color: '#6b7280'
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '16px'
  }
};

export const PromptsTable: React.FC = () => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    title: '',
    description: '',
    content: '',
    category: '',
    tags: ''
  });

  // Modal styles
  const modalStyles = {
    overlay: {
      position: 'fixed' as 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modal: {
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      padding: '32px',
      width: '500px',
      maxWidth: '90vw',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
    },
    modalHeader: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '24px'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '8px'
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      color: '#111827',
      boxSizing: 'border-box' as 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      color: '#111827',
      resize: 'vertical' as 'vertical',
      minHeight: '80px',
      boxSizing: 'border-box' as 'border-box'
    },
    buttonGroup: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      marginTop: '24px'
    },
    cancelButton: {
      padding: '8px 16px',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      backgroundColor: '#ffffff',
      color: '#374151',
      cursor: 'pointer'
    },
    submitButton: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      backgroundColor: '#0d9488',
      color: '#ffffff',
      cursor: 'pointer'
    }
  };

  // Fetch prompts from authenticated API
  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await promptsApiService.getPrompts();
      
      // Map API data to local PromptData format
      const mappedPrompts: PromptData[] = (data.prompts || []).map(apiPrompt => ({
        id: apiPrompt.id, // Keep as string UUID
        title: apiPrompt.title || 'Untitled',
        description: apiPrompt.text || apiPrompt.intent || '',
        tags: apiPrompt.tags ? apiPrompt.tags.map((tag, index) => ({
          id: index,
          name: tag,
          color: getTagColor(tag)
        })) : [],
        dateModified: apiPrompt.updated_at || apiPrompt.created_at,
        content: apiPrompt.text,
        category: apiPrompt.category,
        usage_count: apiPrompt.usage_count
      }));
      
      setPrompts(mappedPrompts);
    } catch (err) {
      console.error('Error fetching prompts:', err);
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
  }) => {
    try {
      setSubmitting(true);
      
      // Map local format to API format
      const apiPromptData: CreatePromptRequest = {
        title: promptData.title,
        text: promptData.content,
        intent: promptData.description,
        category: promptData.category,
        tags: promptData.tags,
      };
      
      const createdPrompt = await promptsApiService.createPrompt(apiPromptData);
      
      // Map API response back to local format
      const localPrompt: PromptData = {
        id: createdPrompt.id, // Keep as string UUID
        title: createdPrompt.title,
        description: createdPrompt.text || createdPrompt.intent || '',
        tags: (createdPrompt.tags || []).map((tag, index) => ({
          id: index,
          name: tag,
          color: getTagColor(tag)
        })),
        dateModified: createdPrompt.created_at,
        content: createdPrompt.text,
        category: createdPrompt.category,
        usage_count: createdPrompt.usage_count || 0
      };
      
      // Add the new prompt to the beginning of the list
      setPrompts(prevPrompts => [localPrompt, ...prevPrompts]);
      
      return localPrompt;
    } catch (err) {
      console.error('Error creating prompt:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleNewPrompt = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewPrompt({ title: '', description: '', content: '', category: '', tags: '' });
  };

  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPrompt.title.trim() || !newPrompt.description.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const tagsArray = newPrompt.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    try {
      await createPrompt({
        title: newPrompt.title.trim(),
        description: newPrompt.description.trim(),
        content: newPrompt.content.trim(),
        category: newPrompt.category.trim(),
        tags: tagsArray
      });
      
      handleCloseModal();
    } catch (err) {
      alert('Failed to create prompt. Please try again.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setNewPrompt(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRowClick = (promptId: string) => {
    navigate(`/prompts/${promptId}`);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        backgroundColor: '#ffffff'
      }}>
        <div style={{
          border: '2px solid #f3f4f6',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ marginLeft: '12px', color: '#6b7280' }}>Loading prompts...</span>
      </div>
    );
  }

  return (
    <div style={tableStyles.container}>
      <div style={tableStyles.wrapper}>
        {/* Error message */}
        {error && (
          <div style={tableStyles.errorMessage}>
            {error}
            <button
              onClick={fetchPrompts}
              style={{
                marginLeft: '12px',
                padding: '4px 8px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Header */}
        <div style={tableStyles.header}>
          <h1 style={tableStyles.title}>Prompts</h1>
          <button
            style={tableStyles.newButton}
            onClick={handleNewPrompt}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0f766e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0d9488';
            }}
          >
            New Prompt
          </button>
        </div>

        {/* Table Container */}
        <div style={tableStyles.tableContainer}>
          <table style={tableStyles.table}>
            <thead style={tableStyles.thead}>
              <tr>
                <th style={{ ...tableStyles.th, width: '20%' }}>Title</th>
                <th style={{ ...tableStyles.th, width: '40%' }}>Description</th>
                <th style={{ ...tableStyles.th, width: '25%' }}>Tags</th>
                <th style={{ ...tableStyles.thLast, width: '15%' }}>Date Modified</th>
              </tr>
            </thead>
            <tbody style={tableStyles.tbody}>
              {prompts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ 
                    ...tableStyles.td, 
                    textAlign: 'center', 
                    color: '#6b7280',
                    fontStyle: 'italic',
                    padding: '40px 24px'
                  }}>
                    {error ? 'Failed to load prompts' : 'No prompts found'}
                  </td>
                </tr>
              ) : (
                prompts.map((prompt) => (
                  <tr
                    key={prompt.id}
                    style={{
                      ...tableStyles.tr,
                      ...(hoveredRow === prompt.id ? tableStyles.trHover : {})
                    }}
                    onMouseEnter={() => setHoveredRow(prompt.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => handleRowClick(prompt.id)}
                  >
                    <td style={{ ...tableStyles.td, ...tableStyles.titleCell }}>
                      {prompt.title}
                    </td>
                    <td style={{ ...tableStyles.td, ...tableStyles.descriptionCell }}>
                      {prompt.description}
                    </td>
                    <td style={tableStyles.td}>
                      <div>
                        {prompt.tags.map((tag, tagIndex) => (
                          <span 
                            key={tagIndex} 
                            style={{
                              ...tableStyles.tag,
                              backgroundColor: tag.color || '#f3f4f6',
                              color: tag.color ? '#ffffff' : '#374151'
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tableStyles.tdLast, ...tableStyles.dateCell }}>
                      {prompt.dateModified}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={tableStyles.footer}>
          <div>
            Showing {prompts.length} prompts
          </div>
          <div style={tableStyles.pagination}>
            <span>Rows per page: 10</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button style={tableStyles.paginationButton} disabled>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span>1 of 1</span>
              <button style={tableStyles.paginationButton} disabled>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Prompt Modal */}
      {showModal && (
        <div style={modalStyles.overlay} onClick={handleCloseModal}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalStyles.modalHeader}>Create New Prompt</h2>
            
            <form onSubmit={handleSubmitPrompt}>
              <div style={modalStyles.formGroup}>
                <label style={modalStyles.label}>
                  Title *
                </label>
                <input
                  type="text"
                  style={modalStyles.input}
                  value={newPrompt.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter prompt title"
                  disabled={submitting}
                  required
                />
              </div>

              <div style={modalStyles.formGroup}>
                <label style={modalStyles.label}>
                  Description *
                </label>
                <textarea
                  style={modalStyles.textarea}
                  value={newPrompt.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what this prompt does"
                  disabled={submitting}
                  required
                />
              </div>

              <div style={modalStyles.formGroup}>
                <label style={modalStyles.label}>
                  Content
                </label>
                <textarea
                  style={{ ...modalStyles.textarea, minHeight: '120px' }}
                  value={newPrompt.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Enter the detailed prompt content"
                  disabled={submitting}
                />
              </div>

              <div style={modalStyles.formGroup}>
                <label style={modalStyles.label}>
                  Category
                </label>
                <input
                  type="text"
                  style={modalStyles.input}
                  value={newPrompt.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., functional, performance, security"
                  disabled={submitting}
                />
              </div>

              <div style={modalStyles.formGroup}>
                <label style={modalStyles.label}>
                  Tags
                </label>
                <input
                  type="text"
                  style={modalStyles.input}
                  value={newPrompt.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  placeholder="Enter tags separated by commas (e.g., auth, login, form)"
                  disabled={submitting}
                />
              </div>

              <div style={modalStyles.buttonGroup}>
                <button
                  type="button"
                  style={{
                    ...modalStyles.cancelButton,
                    opacity: submitting ? 0.5 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleCloseModal}
                  disabled={submitting}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    ...modalStyles.submitButton,
                    opacity: submitting ? 0.5 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                  disabled={submitting}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#0f766e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#0d9488';
                    }
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Prompt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};