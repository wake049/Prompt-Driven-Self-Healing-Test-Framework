import React from 'react';
import styled from 'styled-components';
interface ChartData {
  label: string;
  value: number;
  color?: string;
}
interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}
interface SimpleBarChartProps {
  data: ChartData[];
  height?: number;
}
const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const ProgressRingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;
const ProgressText = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`;
const BarChartContainer = styled.div<{ height: number }>`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  height: ${props => props.height}px;
  padding: 20px 16px 16px 16px;
  position: relative;
`;
const Bar = styled.div<{ height: number; color: string }>`
  width: 100%;
  max-width: 32px;
  height: ${props => props.height}%;
  background: ${props => props.color};
  border-radius: 4px 4px 0 0;
  transition: all 0.3s ease;
  min-height: 8px;
  &:hover {
    opacity: 0.8;
    transform: scaleY(1.05);
  }
`;
const BarLabel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
  margin-top: 8px;
  writing-mode: horizontal-tb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const BarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 50px;
  height: 100%;
  justify-content: flex-end;
`;
export const ProgressRing: React.FC<ProgressRingProps> = ({ 
  percentage, 
  size = 120, 
  strokeWidth = 8,
  color = '#667eea'
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  return (
    <ProgressRingContainer>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          style={{ opacity: 0.1 }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%'
          }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy="0.3em"
          fontSize="18"
          fontWeight="700"
          fill="currentColor"
        >
          {percentage.toFixed(1)}%
        </text>
      </svg>
    </ProgressRingContainer>
  );
};
export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, height = 200 }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  return (
    <ChartContainer>
      <BarChartContainer height={height}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * 80 : 0; // Use 80% of container height for bars
          return (
            <BarWrapper key={index}>
              <Bar
                height={barHeight}
                color={item.color || '#667eea'}
                title={`${item.label}: ${item.value}`}
              />
              <BarLabel>{item.label}</BarLabel>
            </BarWrapper>
          );
        })}
      </BarChartContainer>
    </ChartContainer>
  );
};
export const MiniChart: React.FC<{ data: number[]; color?: string }> = ({ 
  data, 
  color = '#667eea' 
}) => {
  const max = Math.max(...data);
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - (value / max) * 100;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100" height="40" style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};