import React, { useState } from 'react';
import styled from 'styled-components';
import { PageContextUpload } from './PageContextUpload';
import { PageContextList } from './PageContextList';
import { PageContextView } from './PageContextView';
import { PageContextAPI } from './api';
import { PageContext, PageContextFormData } from './types';

// ================================
// Styled Components (matching existing app patterns)
// ================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
`;

const MainHeader = styled.div`
  padding: 30px 40px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PageTitle = styled.h1`
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const NewButton = styled.button`
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #0056b3;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 0 40px 40px;
  overflow: auto;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

const Breadcrumb = styled.nav`
  margin-bottom: 24px;
  color: #6c757d;
  font-size: 14px;
`;

const BreadcrumbLink = styled.button`
  background: none;
  border: none;
  color: #007bff;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const BreadcrumbSeparator = styled.span`
  margin: 0 8px;
  color: #6c757d;
`;

const BreadcrumbCurrent = styled.span`
  color: #2c3e50;
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
      <Breadcrumb>
        <BreadcrumbLink onClick={() => setCurrentView('list')}>
          Page Contexts
        </BreadcrumbLink>
        <BreadcrumbSeparator>/</BreadcrumbSeparator>
        <BreadcrumbCurrent>
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
        return selectedContext ? (
          <>
            {renderBreadcrumb()}
            <PageContextView
              context={selectedContext as unknown as PageContext}
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
    <Container>
      <MainContent>
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
            <ErrorMessage>
              {error}
            </ErrorMessage>
          )}
          
          {renderContent()}
        </ContentArea>
      </MainContent>
    </Container>
  );
};