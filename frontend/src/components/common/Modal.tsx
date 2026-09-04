import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  glassEffect?: boolean;
  animation?: 'slideUp' | 'fade' | 'scale' | 'slideDown';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '540px',
  maxHeight = '80vh',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  glassEffect = true,
  animation = 'slideUp',
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const getPadding = () => '1rem';
  const getMaxWidth = () => maxWidth;
  const getMaxHeight = () => maxHeight;
  const config = {
    borderRadius: 'var(--radius-lg)',
    headerPadding: '1rem 1.25rem',
    bodyPadding: '1.25rem',
    footerPadding: '1rem 1.25rem',
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && closeOnEscape) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const animations = {
    slideUp: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    slideDown: 'modalSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    fade: 'modalFade 0.25s ease',
    scale: 'modalScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: getPadding(),
        background: glassEffect 
          ? 'rgba(0, 0, 0, 0.55)' 
          : 'rgba(0, 0, 0, 0.75)',
        backdropFilter: glassEffect ? 'blur(10px) saturate(1.1)' : 'none',
        animation: 'modalBackdropFade 0.25s ease',
        WebkitBackdropFilter: glassEffect ? 'blur(10px) saturate(1.1)' : 'none',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={className}
        style={{
          width: '100%',
          maxWidth: getMaxWidth(),
          maxHeight: getMaxHeight(),
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: config.borderRadius,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          position: 'relative',
          animation: animations[animation] || animations.slideUp,
          transformOrigin: 'center center',
        }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* ✅ Decorative Elements */}
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--primary-glow)',
            opacity: 0.1,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            left: '-50px',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'var(--brand-accent)',
            opacity: 0.06,
            pointerEvents: 'none',
          }}
        />

        {/* ✅ Gradient Line */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent), var(--brand-primary))',
            backgroundSize: '200% 100%',
            animation: 'modalGradientMove 4s ease infinite',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
          }}
        />

        {/* ✅ Header */}
        <div
          style={{
            padding: config.headerPadding,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexShrink: 0,
            background: 'var(--surface)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  width: '3px',
                  height: '18px',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(180deg, var(--brand-primary), var(--brand-accent))',
                  flexShrink: 0,
                }}
              />
              <h3
                id="modal-title"
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
            </div>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.15rem',
                  marginBottom: 0,
                  paddingLeft: '1.2rem',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              style={{
                padding: '0.3rem',
                borderRadius: '50%',
                border: 'none',
                background: 'var(--surface-hover)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                width: '30px',
                height: '30px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--danger-bg)';
                e.currentTarget.style.color = 'var(--status-danger)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ✅ Body - স্ক্রল যোগ করা হয়েছে */}
        <div
          ref={contentRef}
          style={{
            padding: config.bodyPadding,
            overflowY: 'auto',
            flex: 1,
            background: 'var(--bg)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>

        {/* ✅ Footer */}
        {footer && (
          <div
            style={{
              padding: config.footerPadding,
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.6rem',
              flexShrink: 0,
              flexWrap: 'wrap',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {footer}
          </div>
        )}
      </div>

      {/* ✅ Animation Styles */}
      <style>{`
        @keyframes modalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes modalSlideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes modalFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScale {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes modalGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};

export default Modal;