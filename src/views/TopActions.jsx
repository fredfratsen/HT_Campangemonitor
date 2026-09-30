import React from 'react';

export default function TopActions({ v }) {
  const { ideaBg, inbox, inboxBg, news, newsBg, openIdea, openInbox, openNews } = v;
  return (
    <div className="top-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', margin: '-12px 0 20px', flexWrap: 'wrap' }}>
      <button onClick={openInbox} style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #E4E1DE', borderRadius: '999px', padding: '0 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', background: inboxBg }}>Meldingen{inbox.hasUnread ? <span style={{ minWidth: '20px', height: '20px', borderRadius: '999px', background: '#D32F2F', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{inbox.unread}</span> : null}</button>
      <button onClick={openNews} style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #E4E1DE', borderRadius: '999px', padding: '0 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', background: newsBg }}>Wat is er nieuw{news.hasNew ? <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg,#F9CE00 0%,#FB8915 100%)' }} /> : null}</button>
      <button onClick={openIdea} style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #E4E1DE', borderRadius: '999px', padding: '0 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', background: ideaBg }}>Bug of idee melden</button>
    </div>
  );
}
