import React from 'react';

/**
 * Official Brand Component for EdWth Academy
 *
 * Palette:
 * - Obsidian Dark: #171717 / #0A0A0A
 * - Academy Orange: #F58212
 * - Amber Gold: #FFB21A
 * - Warm Ivory: #FAF7F2
 *
 * Tagline: EMPOWERING EVERY LEARNER
 */
export const BrandLogo = ({
  variant = 'header', // 'full' | 'compact' | 'header' | 'symbol'
  productBadge = 'LMS',
  subtitle = null,
  size = 'md', // 'sm' | 'md' | 'lg'
  onClick = null,
  showTagline = false,
  className = '',
  style = {}
}) => {
  const isClickable = typeof onClick === 'function';

  // Dimension presets
  const sizeMap = {
    sm: { symbol: 32, height: 32, fontSize: '0.86rem', badgeSize: '0.6rem' },
    md: { symbol: 40, height: 40, fontSize: '1rem', badgeSize: '0.64rem' },
    lg: { symbol: 54, height: 54, fontSize: '1.25rem', badgeSize: '0.7rem' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // 1. Symbol-only variant (for icon rail / minimized sidebar)
  if (variant === 'symbol') {
    return (
      <div
        onClick={onClick}
        className={`brand-symbol ${className}`}
        title="EdWth Academy — Empowering Every Learner"
        style={{
          width: `${currentSize.symbol}px`,
          height: `${currentSize.symbol}px`,
          borderRadius: '12px',
          backgroundColor: '#171717',
          border: '1.5px solid rgba(245, 130, 18, 0.45)',
          boxShadow: '0 4px 14px -2px rgba(245, 130, 18, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isClickable ? 'pointer' : 'default',
          padding: '4px',
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'all 0.2s ease',
          ...style
        }}
      >
        <img
          src="/logo-transparent.png"
          alt="EdWth Academy"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.innerHTML = '<span style="font-size:1.2rem;font-weight:900;color:#F58212;">E</span>';
            }
          }}
        />
      </div>
    );
  }

  // 2. Full official wordmark hero variant (Login screens, modals, landing cards)
  if (variant === 'full') {
    return (
      <div
        onClick={onClick}
        className={`brand-full ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: isClickable ? 'pointer' : 'default',
          textAlign: 'center',
          ...style
        }}
      >
        <div
          style={{
            position: 'relative',
            maxHeight: size === 'lg' ? '120px' : size === 'sm' ? '60px' : '90px',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem'
          }}
        >
          <img
            src="/logo-transparent.png"
            alt="EdWth Academy — Empowering Every Learner"
            style={{
              maxHeight: size === 'lg' ? '110px' : size === 'sm' ? '56px' : '80px',
              maxWidth: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 16px rgba(245, 130, 18, 0.25))'
            }}
            onError={(e) => {
              // Fallback text if image fails
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {productBadge && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem' }}>
            <span
              style={{
                fontSize: currentSize.badgeSize,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#F58212',
                backgroundColor: 'rgba(245, 130, 18, 0.12)',
                padding: '0.15rem 0.6rem',
                borderRadius: '9999px',
                border: '1px solid rgba(245, 130, 18, 0.3)'
              }}
            >
              {productBadge}
            </span>
            {subtitle && (
              <span
                style={{
                  fontSize: currentSize.badgeSize,
                  fontWeight: 600,
                  color: 'var(--text-secondary, #94a3b8)',
                  backgroundColor: 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.05))',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))'
                }}
              >
                {subtitle}
              </span>
            )}
          </div>
        )}

        {showTagline && (
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#FFB21A',
              marginTop: '0.6rem'
            }}
          >
            EMPOWERING EVERY LEARNER
          </div>
        )}
      </div>
    );
  }

  // 3. Header / Sidebar brand bar variant (Default)
  return (
    <div
      onClick={onClick}
      className={`brand-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        cursor: isClickable ? 'pointer' : 'default',
        userSelect: 'none',
        ...style
      }}
    >
      <div
        style={{
          width: `${currentSize.symbol}px`,
          height: `${currentSize.symbol}px`,
          borderRadius: '11px',
          backgroundColor: '#171717',
          border: '1px solid rgba(245, 130, 18, 0.4)',
          boxShadow: '0 3px 10px rgba(245, 130, 18, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '3px',
          flexShrink: 0
        }}
      >
        <img
          src="/logo-transparent.png"
          alt="EdWth Academy"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span
            style={{
              color: 'var(--text-primary, #FFFFFF)',
              fontWeight: 800,
              fontSize: currentSize.fontSize,
              lineHeight: 1.2,
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap'
            }}
          >
            EdWth <span style={{ color: '#F58212' }}>Academy</span>
          </span>
          {productBadge && (
            <span
              style={{
                fontSize: currentSize.badgeSize,
                padding: '0.1rem 0.38rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(245, 130, 18, 0.14)',
                border: '1px solid rgba(245, 130, 18, 0.25)',
                color: '#F58212',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                lineHeight: 1.2
              }}
            >
              {productBadge}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: '0.67rem',
            fontWeight: 600,
            color: 'var(--text-secondary, #94a3b8)',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.01em'
          }}
        >
          {subtitle || (showTagline ? 'EMPOWERING EVERY LEARNER' : 'Empowering Every Learner')}
        </div>
      </div>
    </div>
  );
};

export default BrandLogo;
