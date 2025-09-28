import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatItem {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: number;
  changeLabel?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'pink';
}

interface StatisticsPanelProps {
  stats: StatItem[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  stats,
  title,
  subtitle,
  loading = false,
  className = ''
}) => {
  const getColorClasses = (color: StatItem['color'] = 'blue') => {
    const colorMap = {
      blue: 'bg-blue-500 text-blue-50',
      green: 'bg-green-500 text-green-50',
      red: 'bg-red-500 text-red-50',
      yellow: 'bg-yellow-500 text-yellow-50',
      purple: 'bg-purple-500 text-purple-50',
      indigo: 'bg-indigo-500 text-indigo-50',
      pink: 'bg-pink-500 text-pink-50'
    };
    
    return colorMap[color];
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-content">
        {(title || subtitle) && (
          <div className="mb-4">
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center">
                  {stat.icon && (
                    <div className={`flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center ${getColorClasses(stat.color)}`}>
                      {stat.icon}
                    </div>
                  )}
                  <div className={`${stat.icon ? 'ml-3' : ''} flex-1`}>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-xl font-semibold text-gray-900">{stat.value}</p>
                    
                    {stat.change !== undefined && (
                      <div className={`flex items-center mt-1 text-sm ${getChangeColor(stat.change)}`}>
                        {stat.change > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : stat.change < 0 ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : null}
                        <span>
                          {stat.change > 0 ? '+' : ''}
                          {stat.change}% {stat.changeLabel || ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsPanel;
