import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-[var(--ui-surface)] border border-[var(--ui-border-9d9b9a)] rounded-lg shadow-sm ${!noPadding ? 'p-6' : ''} ${className}`}>
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
    pending: 'border-[var(--ui-border-9d9b9a)] bg-[var(--ui-surface)]',
    'in-progress': 'border-[var(--ui-primary-2475c7)] bg-[var(--ui-primary-2475c7)]/5',
    complete: 'border-[#2ecc71] bg-[#2ecc71]/5',
  };

  const statusIcons = {
    pending: (
      <div className="w-8 h-8 rounded-full bg-[var(--ui-border-9d9b9a)]/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-[color:var(--ui-border-9d9b9a)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    'in-progress': (
      <div className="w-8 h-8 rounded-full bg-[var(--ui-primary-2475c7)]/20 flex items-center justify-center">
        <svg className="w-5 h-5 text-[color:var(--ui-primary-2475c7)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      className={`min-h-11 border-2 rounded-lg p-4 transition-all ${statusStyles[status]} ${onClick ? 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--ui-primary-2475c7)]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Abrir sección ${titleText}` : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {statusIcons[status]}
          <div className="flex-1">
            <h3 className="text-[color:var(--ui-text-3b3a36)] flex items-center gap-2">
              {titleIcon && <span>{titleIcon}</span>}
              {titleText}
            </h3>
            {progress !== undefined && (
              <div className="mt-2 w-full bg-[var(--ui-background-f2f3f5)] rounded-full h-2">
                <div 
                  className="bg-[var(--ui-primary-2475c7)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {onClick && (
          <svg className="w-5 h-5 text-[color:var(--ui-text-muted-5f6773)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
