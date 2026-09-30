import { useEffect, useRef } from 'react';

/**
 * On phones the campaign queue is a sideways-scrolling strip (.q-list in styles/app.css). This keeps the selected
 * item (aria-current) centred in it whenever `key` changes. Does nothing when the list doesn't scroll sideways.
 */
export default function useCenterCurrent(key) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const cur = el.querySelector('[aria-current="true"]');
    if (cur) el.scrollTo({ left: cur.offsetLeft - (el.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
  }, [key]);
  return ref;
}
