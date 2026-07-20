import React from 'react';
import { Trash2 } from 'lucide-react';

type DeleteIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function DeleteIconButton({ className = '', title = 'Eliminar', ...props }: DeleteIconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
