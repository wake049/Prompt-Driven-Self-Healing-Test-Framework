import React, { useState } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
import { PageContextUpload } from './PageContextUpload';
import { PageContextList } from './PageContextList';
import { PageContextView } from './PageContextView';
import { PageContextAPI } from './api';
import { PageContext, PageContextFormData } from './types';
import { PageContextItem } from './';

// ================================
// Styled Components (matching existing app patterns)
// ================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: ${props => props.theme.colors.background};
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const MainHeader = styled.div`
  padding: 40px 50px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const PageTitle = styled.h1`
  margin: 0;
  color: white;
  font-size: 2.25rem;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const NewButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 14px 28px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 15px;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 0 40px 40px;
  overflow: auto;
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #1a1a1a;
  }
`;

const BackButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  cursor: pointer;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }
`;

const ErrorMessage = styled.div<{ theme: any }>`
  background-color: ${props => props.theme.colors.error}20;
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid ${props => props.theme.colors.error}40;
`;

const Breadcrumb = styled.nav<{ theme: any }>`
  margin-bottom: 24px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const BreadcrumbLink = styled.button<{ theme: any }>`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const BreadcrumbSeparator = styled.span<{ theme: any }>`
  margin: 0 8px;
  color: ${props => props.theme.colors.textSecondary};
`;

const BreadcrumbCurrent = styled.span<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
`;

// ================================
// Types
// ================================

type ViewState = 'list' | 'upload' | 'edit' | 'view';

// ================================
// Component
// ================================

export const PageContextManager: React.FC = () => {
  const { theme } = useTheme();
  const [currentView, setCurrentView] = useState<ViewState>('list');
  const [selectedContext, setSelectedContext] = useState<PageContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNew = () => {
    setSelectedContext(null);
    setCurrentView('upload');
  };

  const handleEdit = (context: PageContext) => {
    setSelectedContext(context);
    setCurrentView('edit');
  };

  const handleView = (context: PageContext) => {
    setSelectedContext(context);
    setCurrentView('view');
  };

  const handleDelete = async (id: string) => {
    try {
      const success = await PageContextAPI.delete(id);
      if (success) {
        // Refresh the list
        setCurrentView('list');
        setError(null);
      } else {
        throw new Error('Failed to delete context');
      }
    } catch (error) {
      console.error('Error deleting context:', error);
      setError('Failed to delete page context. Please try again.');
    }
  };

  const handleSubmit = async (formData: PageContextFormData) => {
    try {
      setError(null);
      
      const submitData = new FormData();
      
      // Add form fields
      submitData.append('page_url', formData.pageUrl);
      submitData.append('page_title', formData.pageTitle);
      submitData.append('page_type', formData.pageType);
      submitData.append('page_description', formData.pageDescription);
      submitData.append('testing_focus', formData.testingFocus || '');
      submitData.append('user_notes', formData.userNotes || '');
      submitData.append('primary_actions', JSON.stringify(formData.primaryActions));
      
      // Add screenshot if provided
      if (formData.screenshot) {
        submitData.append('screenshot', formData.screenshot);
      }

      if (currentView === 'edit' && selectedContext?.id) {
        // For updates, check if there's a screenshot to upload
        if (formData.screenshot) {
          // Use the upload endpoint for updates with files
          await PageContextAPI.updateWithFiles(selectedContext.id, submitData);
        } else {
          // Use regular update for text-only changes
          const updates = {
            pageUrl: formData.pageUrl,
            pageTitle: formData.pageTitle,
            pageType: formData.pageType,
            pageDescription: formData.pageDescription,
            testingFocus: formData.testingFocus,
            userNotes: formData.userNotes,
            primaryActions: formData.primaryActions,
          };
          await PageContextAPI.update(selectedContext.id, updates);
        }
      } else {
        // For new contexts, use the create method
        await PageContextAPI.create(submitData);
      }

      setCurrentView('list');
    } catch (error) {
      console.error('Error submitting context:', error);
      setError(`Failed to ${currentView === 'edit' ? 'update' : 'create'} page context. Please try again.`);
    }
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedContext(null);
    setError(null);
  };

  const renderHeader = () => {
    switch (currentView) {
      case 'upload':
        return 'Add New Context';
      case 'edit':
        return 'Edit Context';
      case 'view':
        return selectedContext?.pageTitle || 'View Context';
      case 'list':
      default:
        return 'Page Context Management';
    }
  };

  const renderBreadcrumb = () => {
    if (currentView === 'list') return null;
    
    return (
      <Breadcrumb theme={theme}>
        <BreadcrumbLink theme={theme} onClick={() => setCurrentView('list')}>
          Page Contexts
        </BreadcrumbLink>
        <BreadcrumbSeparator theme={theme}>/</BreadcrumbSeparator>
        <BreadcrumbCurrent theme={theme}>
          {currentView === 'edit' ? 'Edit Context' : 
           currentView === 'upload' ? 'Add New Context' :
           selectedContext?.pageTitle || 'View Context'}
        </BreadcrumbCurrent>
      </Breadcrumb>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'list':
        return (
          <PageContextList
            onEdit={handleEdit}
            onView={handleView}
            onDelete={handleDelete}
            onCreateNew={handleCreateNew}
          />
        );

      case 'upload':
      case 'edit':
        return (
          <>
            {renderBreadcrumb()}
            <PageContextUpload
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              initialData={currentView === 'edit' && selectedContext ? {
                pageUrl: selectedContext.pageUrl,
                pageTitle: selectedContext.pageTitle,
                pageType: selectedContext.pageType,
                pageDescription: selectedContext.pageDescription,
                testingFocus: selectedContext.testingFocus || '',
                userNotes: selectedContext.userNotes || '',
                primaryActions: selectedContext.primaryActions,
                screenshot: null, // Can't pre-populate file input
              } : undefined}
            />
          </>
        );

      case 'view':
        return selectedContext && selectedContext.id ? (
          <>
            {renderBreadcrumb()}
            <PageContextView
              context={selectedContext as PageContextItem}
              onEdit={() => handleEdit(selectedContext)}
              onClose={() => setCurrentView('list')}
            />
          </>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Container theme={theme}>
      <MainContent theme={theme}>
        <MainHeader>
          <div>
            <PageTitle>{renderHeader()}</PageTitle>
          </div>
          <HeaderActions>
            {currentView !== 'list' && (
              <BackButton onClick={handleCancel}>
                ← Back to List
              </BackButton>
            )}
            {currentView === 'list' && (
              <NewButton onClick={handleCreateNew}>
                Add New Context
              </NewButton>
            )}
          </HeaderActions>
        </MainHeader>

        <ContentArea>
          {error && (
            <ErrorMessage theme={theme}>
              {error}
            </ErrorMessage>
          )}
          
          {renderContent()}
        </ContentArea>
      </MainContent>
    </Container>
  );
};