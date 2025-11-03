import React from 'react';
import styled, { keyframes } from 'styled-components';
const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;
const SkeletonBase = styled.div`
  background: linear-gradient(90deg, ${props => props.theme.colors.border} 25%, transparent 37%, ${props => props.theme.colors.border} 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
  border-radius: 4px;
`;
const SkeletonCard = styled(SkeletonBase)`
  height: 160px;
  border-radius: 16px;
  margin-bottom: 24px;
`;
const SkeletonText = styled(SkeletonBase)<{ width?: string; height?: string }>`
  height: ${props => props.height || '16px'};
  width: ${props => props.width || '100%'};
  margin-bottom: 8px;
`;
const SkeletonRow = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  background: ${props => props.theme.colors.surface};
  border-radius: 8px;
`;
const SkeletonAvatar = styled(SkeletonBase)`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
`;
interface SkeletonProps {
  count?: number;
}
export const StatCardSkeleton: React.FC = () => (
  <SkeletonCard />
);
export const TextSkeleton: React.FC<{ width?: string; height?: string }> = ({ width, height }) => (
  <SkeletonText width={width} height={height} />
);
export const ExecutionRowSkeleton: React.FC = () => (
  <SkeletonRow>
    <div style={{ flex: 1 }}>
      <SkeletonText width="80%" height="18px" />
      <SkeletonText width="60%" height="14px" />
    </div>
    <div style={{ width: '80px' }}>
      <SkeletonText width="100%" height="24px" />
    </div>
    <div style={{ width: '60px' }}>
      <SkeletonText width="100%" height="16px" />
    </div>
    <div style={{ width: '80px' }}>
      <SkeletonText width="100%" height="16px" />
    </div>
    <div style={{ width: '120px' }}>
      <SkeletonText width="100%" height="16px" />
    </div>
  </SkeletonRow>
);
export const StatGridSkeleton: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
    <StatCardSkeleton />
    <StatCardSkeleton />
    <StatCardSkeleton />
    <StatCardSkeleton />
  </div>
);
export const ExecutionListSkeleton: React.FC<SkeletonProps> = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }, (_, index) => (
      <ExecutionRowSkeleton key={index} />
    ))}
  </>
);
export const DashboardSkeleton: React.FC = () => (
  <>
    <StatGridSkeleton />
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ padding: '20px 32px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <SkeletonText width="200px" height="24px" />
      </div>
      <ExecutionListSkeleton />
    </div>
  </>
);