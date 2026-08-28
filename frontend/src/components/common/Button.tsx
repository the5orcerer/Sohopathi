import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...props
}) => {
  const isBusy = isLoading || loading;

  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'btn-secondary';
      case 'danger':
        return 'btn-danger';
      case 'ghost':
        return 'btn-ghost';
      default:
        return 'btn-primary';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return { padding: '0.35rem 0.65rem', fontSize: '0.78rem' };
      case 'lg':
        return { padding: '0.75rem 1.5rem', fontSize: '0.95rem' };
      default:
        return { padding: '0.55rem 1.15rem', fontSize: '0.85rem' };
    }
  };

  return (
    <button
      className={`btn ${getVariantClass()}`}
      disabled={disabled || isBusy}
      style={{
        ...getSizeStyle(),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        ...style,
      }}
      {...props}
    >
      {isBusy ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
};
