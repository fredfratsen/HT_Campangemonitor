// Horeca Toppers design-system button (from the design export).
import React from 'react';

const GRAD = 'linear-gradient(135deg, #F9CE00 0%, #FB8915 100%)';
const SIZES = {
  sm: { fontSize: 13, padding: '7px 14px', borderRadius: 6 },
  md: { fontSize: 14, padding: '10px 20px', borderRadius: 8 },
  lg: { fontSize: 16, padding: '14px 28px', borderRadius: 8 }
};
const VARIANTS = {
  primary: { background: GRAD, color: '#fff', border: 'none' },
  accent: { background: '#1B1B63', color: '#fff', border: 'none' },
  outline: { background: 'transparent', color: '#1B1B63', border: '1.5px solid #1B1B63' },
  ghost: { background: 'transparent', color: '#1D1D1B', border: '1.5px solid #E4E1DE' }
};

export default function Button({ children = 'Button', variant = 'primary', size = 'md', onClick, disabled = false, type = 'button' }) {
  const style = {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
    ...SIZES[size],
    ...VARIANTS[variant]
  };
  return <button type={type} style={style} onClick={onClick} disabled={disabled}>{children}</button>;
}
