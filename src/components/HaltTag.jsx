import React from 'react';

/** Pauze or Gestopt, next to a campaign the recruiter still calls candidates for (Live campagnes, Mijn campagnes). */
export default function HaltTag({ t }) {
  return <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '6px', background: '#EEEAE5', color: '#5C5C5A' }}>{t}</span>;
}
