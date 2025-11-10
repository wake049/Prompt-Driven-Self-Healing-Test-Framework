import React from 'react';
import styled from 'styled-components';

interface DataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  title?: string;
}

const ChartContainer = styled.div<{ width?: number; height?: number }>`
  width: ${props => props.width ? `${props.width}px` : '100%'};
  height: ${props => props.height ? `${props.height}px` : '200px'};
  position: relative;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  display: flex;
  flex-direction: column;
`;

const ChartSvg = styled.svg`
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 120px;
`;

const ChartTitle = styled.div<{ theme: any }>`
  position: absolute;
  top: 8px;
  left: 16px;
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.theme?.colors?.textSecondary || '#666'};
`;

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  width,
  height = 200,
  color = '#667eea',
  title
}) => {
  if (!data || data.length === 0) {
    return (
      <ChartContainer width={width} height={height}>
        {title && <ChartTitle>{title}</ChartTitle>}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flex: 1,
          color: '#999',
          fontSize: '14px'
        }}>
          No data available
        </div>
      </ChartContainer>
    );
  }

  // Use container dimensions for calculations
  const containerWidth = width || 300;
  const containerHeight = height;

  // Calculate chart dimensions
  const padding = 20;
  const chartWidth = containerWidth - (padding * 2);
  const chartHeight = containerHeight - (padding * 2) - (title ? 30 : 0);

  // Find min and max values
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  // Create path points
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + (title ? 30 : 0) + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const pathD = data.length > 1 ? `M ${points.split(' ').join(' L ')}` : '';

  return (
    <ChartContainer width={width} height={height}>
      {title && <ChartTitle>{title}</ChartTitle>}
      <ChartSvg viewBox={`0 0 ${containerWidth} ${containerHeight}`}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(102, 126, 234, 0.1)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />
        
        {/* Chart line */}
        {data.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Data points */}
        {data.map((point, index) => {
          const x = padding + (index / (data.length - 1)) * chartWidth;
          const y = padding + (title ? 30 : 0) + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
          
          return (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill={color}
                stroke="white"
                strokeWidth="2"
              />
              {/* Value label */}
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fontSize="10"
                fill={color}
                fontWeight="500"
              >
                {point.value.toFixed(1)}
              </text>
            </g>
          );
        })}
        
        {/* Y-axis labels */}
        <text x="5" y={padding + (title ? 30 : 0) + 5} fontSize="10" fill="#999">
          {maxValue.toFixed(1)}
        </text>
        <text x="5" y={containerHeight - padding + 5} fontSize="10" fill="#999">
          {minValue.toFixed(1)}
        </text>
      </ChartSvg>
    </ChartContainer>
  );
};

export default SimpleLineChart;