import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { spinKeyframes } from '../../shared/styles/keyframes';
import { Upload, Image, FileText, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';

// ================================
// Styled Components (matching existing app patterns)
// ================================

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
`;

const Title = styled.h2`
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: #e9ecef;
    color: #495057;
  }
`;

const Form = styled.form`
  padding: 24px;
`;

const FormSection = styled.div`
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
`;

const RequiredIndicator = styled.span`
  color: #dc3545;
  margin-left: 2px;
`;

const HelpText = styled.span`
  font-weight: normal;
  color: #6c757d;
  margin-left: 8px;
`;

const Input = styled.input<{ hasError?: boolean }>`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid ${props => props.hasError ? '#dc3545' : '#dee2e6'};
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#dc3545' : '#007bff'};
    box-shadow: 0 0 0 2px ${props => props.hasError ? 'rgba(220, 53, 69, 0.25)' : 'rgba(0, 123, 255, 0.25)'};
  }
  
  &::placeholder {
    color: #6c757d;
  }
`;

const Select = styled.select<{ hasError?: boolean }>`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid ${props => props.hasError ? '#dc3545' : '#dee2e6'};
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#dc3545' : '#007bff'};
    box-shadow: 0 0 0 2px ${props => props.hasError ? 'rgba(220, 53, 69, 0.25)' : 'rgba(0, 123, 255, 0.25)'};
  }
`;

const TextArea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  padding: 10px 14px;
  border: 1px solid ${props => props.hasError ? '#dc3545' : '#dee2e6'};
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#dc3545' : '#007bff'};
    box-shadow: 0 0 0 2px ${props => props.hasError ? 'rgba(220, 53, 69, 0.25)' : 'rgba(0, 123, 255, 0.25)'};
  }
  
  &::placeholder {
    color: #6c757d;
  }
`;

const ErrorMessage = styled.p`
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 6px 0 0 0;
  font-size: 0.85rem;
  color: #dc3545;
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const ActionInput = styled(Input)`
  flex: 1;
`;

const RemoveButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: #f8d7da;
  }
`;

const AddActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.9rem;
  
  &:hover {
    background: #e3f2fd;
  }
`;

const UploadArea = styled.div<{ dragActive?: boolean; hasError?: boolean }>`
  position: relative;
  border: 2px dashed ${props => {
    if (props.hasError) return '#dc3545';
    if (props.dragActive) return '#007bff';
    return '#dee2e6';
  }};
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  background: ${props => props.dragActive ? '#f0f8ff' : '#fafafa'};
  transition: all 0.2s;
  cursor: pointer;
  
  &:hover {
    border-color: #007bff;
    background: #f0f8ff;
  }
`;

const UploadInput = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const UploadContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const UploadIcon = styled.div`
  color: #6c757d;
`;

const UploadText = styled.p`
  margin: 0;
  color: #495057;
  font-weight: 500;
`;

const UploadSubtext = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: #6c757d;
`;

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e9ecef;
`;

const PreviewFileName = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: #6c757d;
`;

const RemoveImageButton = styled.button`
  padding: 6px 12px;
  background: none;
  border: 1px solid #dc3545;
  color: #dc3545;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  
  &:hover {
    background: #f8d7da;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
  margin-top: 24px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  ${props => {
    if (props.variant === 'primary') {
      return `
        background: #007bff;
        color: white;
        &:hover:not(:disabled) {
          background: #0056b3;
        }
      `;
    }
    return `
      background: white;
      color: #6c757d;
      border: 1px solid #dee2e6;
      &:hover:not(:disabled) {
        background: #f8f9fa;
        color: #495057;
      }
    `;
  }}
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: ${spinKeyframes} 1s linear infinite;
`;

// ================================
// Types
// ================================

interface PageContextFormData {
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  testingFocus: string;
  userNotes: string;
  primaryActions: string[];
  screenshot: File | null;
}

interface PageContextUploadProps {
  onSubmit: (data: PageContextFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<PageContextFormData>;
}

const PAGE_TYPES = [
  { value: 'ecommerce', label: 'E-commerce', description: 'Online shopping sites' },
  { value: 'airline', label: 'Airlines', description: 'Flight booking and travel' },
  { value: 'banking', label: 'Banking', description: 'Financial services' },
  { value: 'form', label: 'Forms', description: 'Data collection forms' },
  { value: 'news', label: 'News', description: 'News and content sites' },
  { value: 'social', label: 'Social Media', description: 'Social platforms' },
  { value: 'search', label: 'Search', description: 'Search engines' },
  { value: 'streaming', label: 'Streaming', description: 'Video/media platforms' },
  { value: 'other', label: 'Other', description: 'Other website types' },
];

// ================================
// Component
// ================================

export const PageContextUpload: React.FC<PageContextUploadProps> = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState<PageContextFormData>({
    pageUrl: initialData?.pageUrl || '',
    pageTitle: initialData?.pageTitle || '',
    pageType: initialData?.pageType || '',
    pageDescription: initialData?.pageDescription || '',
    testingFocus: initialData?.testingFocus || '',
    userNotes: initialData?.userNotes || '',
    primaryActions: initialData?.primaryActions || [''],
    screenshot: initialData?.screenshot || null,
  });

  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleInputChange = (field: keyof PageContextFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleActionChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      primaryActions: prev.primaryActions.map((action, i) => i === index ? value : action)
    }));
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      primaryActions: [...prev.primaryActions, '']
    }));
  };

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      primaryActions: prev.primaryActions.filter((_, i) => i !== index)
    }));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, screenshot: 'Please select an image file' }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, screenshot: 'File size must be less than 10MB' }));
      return;
    }

    setFormData(prev => ({ ...prev, screenshot: file }));
    setErrors(prev => ({ ...prev, screenshot: '' }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.pageUrl.trim()) {
      newErrors.pageUrl = 'Page URL is required';
    } else if (!formData.pageUrl.match(/^https?:\/\/.+/)) {
      newErrors.pageUrl = 'Please enter a valid URL';
    }

    if (!formData.pageTitle.trim()) {
      newErrors.pageTitle = 'Page title is required';
    }

    if (!formData.pageType) {
      newErrors.pageType = 'Page type is required';
    }

    if (!formData.pageDescription.trim()) {
      newErrors.pageDescription = 'Page description is required';
    }

    const validActions = formData.primaryActions.filter(action => action.trim());
    if (validActions.length === 0) {
      newErrors.primaryActions = 'At least one primary action is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        primaryActions: formData.primaryActions.filter(action => action.trim())
      });
    } catch (error) {
      console.error('Failed to submit page context:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container>
      <Header>
        <Title>{initialData ? 'Edit Page Context' : 'Add Page Context'}</Title>
        <CloseButton onClick={onCancel}>
          <X size={20} />
        </CloseButton>
      </Header>

      <Form onSubmit={handleSubmit}>
        {/* URL and Title */}
        <FormSection>
          <FormGrid>
            <FormField>
              <Label>
                Page URL<RequiredIndicator>*</RequiredIndicator>
              </Label>
              <Input
                type="url"
                value={formData.pageUrl}
                onChange={handleInputChange('pageUrl')}
                placeholder="https://example.com"
                hasError={!!errors.pageUrl}
              />
              {errors.pageUrl && (
                <ErrorMessage>
                  <AlertCircle size={16} />
                  {errors.pageUrl}
                </ErrorMessage>
              )}
            </FormField>

            <FormField>
              <Label>
                Page Title<RequiredIndicator>*</RequiredIndicator>
              </Label>
              <Input
                type="text"
                value={formData.pageTitle}
                onChange={handleInputChange('pageTitle')}
                placeholder="Page Title"
                hasError={!!errors.pageTitle}
              />
              {errors.pageTitle && (
                <ErrorMessage>
                  <AlertCircle size={16} />
                  {errors.pageTitle}
                </ErrorMessage>
              )}
            </FormField>
          </FormGrid>
        </FormSection>

        {/* Page Type */}
        <FormSection>
          <FormField>
            <Label>
              Page Type<RequiredIndicator>*</RequiredIndicator>
            </Label>
            <Select
              value={formData.pageType}
              onChange={handleInputChange('pageType')}
              hasError={!!errors.pageType}
            >
              <option value="">Select page type...</option>
              {PAGE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </Select>
            {errors.pageType && (
              <ErrorMessage>
                <AlertCircle size={16} />
                {errors.pageType}
              </ErrorMessage>
            )}
          </FormField>
        </FormSection>

        {/* Description */}
        <FormSection>
          <FormField>
            <Label>
              Page Description<RequiredIndicator>*</RequiredIndicator>
            </Label>
            <TextArea
              value={formData.pageDescription}
              onChange={handleInputChange('pageDescription')}
              placeholder="Describe what this page does and its main functionality..."
              rows={3}
              hasError={!!errors.pageDescription}
            />
            {errors.pageDescription && (
              <ErrorMessage>
                <AlertCircle size={16} />
                {errors.pageDescription}
              </ErrorMessage>
            )}
          </FormField>
        </FormSection>

        {/* Primary Actions */}
        <FormSection>
          <FormField>
            <Label>
              Primary Actions<RequiredIndicator>*</RequiredIndicator>
              <HelpText>(What can users do on this page?)</HelpText>
            </Label>
            {formData.primaryActions.map((action, index) => (
              <ActionRow key={index}>
                <ActionInput
                  type="text"
                  value={action}
                  onChange={(e) => handleActionChange(index, e.target.value)}
                  placeholder="e.g., Search for flights, Add to cart, Submit form"
                />
                {formData.primaryActions.length > 1 && (
                  <RemoveButton
                    type="button"
                    onClick={() => removeAction(index)}
                  >
                    <X size={16} />
                  </RemoveButton>
                )}
              </ActionRow>
            ))}
            <AddActionButton type="button" onClick={addAction}>
              <Plus size={16} />
              Add Action
            </AddActionButton>
            {errors.primaryActions && (
              <ErrorMessage>
                <AlertCircle size={16} />
                {errors.primaryActions}
              </ErrorMessage>
            )}
          </FormField>
        </FormSection>

        {/* Screenshot Upload */}
        <FormSection>
          <FormField>
            <Label>
              Page Screenshot
              <HelpText>(Helps AI understand the visual layout)</HelpText>
            </Label>
            <UploadArea
              dragActive={dragActive}
              hasError={!!errors.screenshot}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <UploadInput
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              
              {previewUrl ? (
                <PreviewContainer>
                  <PreviewImage
                    src={previewUrl}
                    alt="Screenshot preview"
                  />
                  <PreviewFileName>
                    {formData.screenshot?.name}
                  </PreviewFileName>
                  <RemoveImageButton
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setFormData(prev => ({ ...prev, screenshot: null }));
                    }}
                  >
                    Remove Screenshot
                  </RemoveImageButton>
                </PreviewContainer>
              ) : (
                <UploadContent>
                  <UploadIcon>
                    <Upload size={32} />
                  </UploadIcon>
                  <UploadText>
                    Drop an image here or click to select
                  </UploadText>
                  <UploadSubtext>
                    PNG, JPG, GIF up to 10MB
                  </UploadSubtext>
                </UploadContent>
              )}
            </UploadArea>
            {errors.screenshot && (
              <ErrorMessage>
                <AlertCircle size={16} />
                {errors.screenshot}
              </ErrorMessage>
            )}
          </FormField>
        </FormSection>

        {/* Testing Focus */}
        <FormSection>
          <FormField>
            <Label>
              Testing Focus
              <HelpText>(What should tests prioritize?)</HelpText>
            </Label>
            <Input
              type="text"
              value={formData.testingFocus}
              onChange={handleInputChange('testingFocus')}
              placeholder="e.g., booking workflow, cart functionality, form validation"
            />
          </FormField>
        </FormSection>

        {/* User Notes */}
        <FormSection>
          <FormField>
            <Label>Additional Notes</Label>
            <TextArea
              value={formData.userNotes}
              onChange={handleInputChange('userNotes')}
              placeholder="Any additional context or special instructions for testing this page..."
              rows={3}
            />
          </FormField>
        </FormSection>

        {/* Action Buttons */}
        <ActionButtons>
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                {initialData ? 'Update Context' : 'Save Page Context'}
              </>
            )}
          </Button>
        </ActionButtons>
      </Form>
    </Container>
  );
};