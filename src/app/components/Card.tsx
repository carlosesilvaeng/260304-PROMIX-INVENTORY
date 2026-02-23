import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white border border-[#9D9B9A] rounded-lg shadow-sm ${!noPadding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface SectionCardProps {
  title: string | { name: string; icon?: string };
  status: 'pending' | 'in-progress' | 'complete';
  progress?: number;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SectionCard({ title, status, progress, onClick, children }: SectionCardProps) {
  const statusStyles = {
    pending: 'border-[#9D9B9A] bg-white',
    'in-progress': 'border-[#2475C7] bg-[#2475C7]/5',
    complete: 'border-[#2ecc71] bg-[#2ecc71]/5',
  };

  const statusIcons = {
    pending: (
      <div className="w-8 h-8 rounded-full bg-[#9D9B9A]/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-[#9D9B9A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    'in-progress': (
      <div className="w-8 h-8 rounded-full bg-[#2475C7]/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-[#2475C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
    ),
    complete: (
      <div className="w-8 h-8 rounded-full bg-[#2ecc71]/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-[#2ecc71]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
  };

  const titleText = typeof title === 'string' ? title : title.name;
  const titleIcon = typeof title === 'object' && title.icon ? title.icon : null;

  return (
    <div 
      className={`border-2 rounded-lg p-4 transition-all ${statusStyles[status]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {statusIcons[status]}
          <div className="flex-1">
            <h3 className="text-[#3B3A36] flex items-center gap-2">
              {titleIcon && <span>{titleIcon}</span>}
              {titleText}
            </h3>
            {progress !== undefined && (
              <div className="mt-2 w-full bg-[#F2F3F5] rounded-full h-2">
                <div 
                  className="bg-[#2475C7] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {onClick && (
          <svg className="w-5 h-5 text-[#5F6773]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}