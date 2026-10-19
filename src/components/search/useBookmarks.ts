import { useEffect, useState } from 'react';
import { bookmarksApi, watchBookmarks, type BmNode } from '../../services/bookmarks';

// The browser's bookmark tree, kept live: any change made in DevDeck or in the
// browser's own bookmark manager re-renders whoever uses this hook.
export function useBookmarks() {
  const available = !!bookmarksApi();
  const [roots, setRoots] = useState<BmNode[] | null>(available ? null : []);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!available) return;
    return watchBookmarks(
      (r) => {
        setRoots(r);
        setError(null);
      },
      (e) => setError(e.message),
    );
  }, [available]);
  return { available, roots, error };
}
