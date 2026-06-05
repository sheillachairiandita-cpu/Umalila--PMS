import React from 'react';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../styles/theme';

/**
 * Card Component
 * Reusable card container with optional header and footer
 * 
 * @component
 * @example
 * <Card>
 *   <Card.Header title="Card Title" />
 *   <Card.Body>Content here</Card.Body>
 *   <Card.Footer>Footer content</Card.Footer>
 * </Card>
 */
function Card({ children, variant = 'default', padding = 'md', className = '', ...props }) {
  const variantStyles = {
    default: {
      background: COLORS.bgWhite,
      border: `1px solid ${COLORS.slate200}`,
      boxShadow: SHADOWS.sm,
    },
    elevated: {
      background: COLORS.bgWhite,
      border: 'none',
      boxShadow: SHADOWS.lg,
    },
    flat: {
      background: COLORS.slate50,
      border: `1px solid ${COLORS.slate200}`,
      boxShadow: 'none',
    },
  };

  const paddingMap = {
    sm: SPACING.md,
    md: SPACING.lg,
    lg: SPACING.xxl,
    none: '0',
  };

  return (
    <div
      style={{
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...variantStyles[variant],
      }}
      className={`card card-${variant} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Header - for use within Card component
 */
Card.Header = function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div
      style={{
        padding: SPACING.lg,
        borderBottom: `1px solid ${COLORS.slate200}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
      }}
      className={`card-header ${className}`}
    >
      <div>
        {title && (
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px 0', color: COLORS.textPrimary }}>
            {title}
          </h3>
        )}
        {subtitle && (
          <p style={{ fontSize: '0.85rem', margin: 0, color: COLORS.textTertiary }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

/**
 * Card Body - for use within Card component
 */
Card.Body = function CardBody({ children, className = '', padding = 'md' }) {
  const paddingMap = {
    sm: SPACING.md,
    md: SPACING.lg,
    lg: SPACING.xxl,
    none: '0',
  };

  return (
    <div
      style={{
        padding: paddingMap[padding],
      }}
      className={`card-body ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Card Footer - for use within Card component
 */
Card.Footer = function CardFooter({ children, align = 'flex-end', className = '' }) {
  return (
    <div
      style={{
        padding: SPACING.lg,
        borderTop: `1px solid ${COLORS.slate200}`,
        display: 'flex',
        gap: SPACING.md,
        justifyContent: align,
      }}
      className={`card-footer ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
