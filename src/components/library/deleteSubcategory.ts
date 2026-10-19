import { useStore } from '../../store';
import { showUndo } from '../ui/UndoToast';

// Delete a subcategory without asking: its sites go to the recycle bin and an
// Undo bar (5 s) brings the subcategory and its sites back exactly as they were.
export function deleteSubcategoryWithUndo(id: string) {
  const s = useStore.getState();
  const sub = s.subcategories.find((x) => x.id === id);
  if (!sub) return;
  const siteIds = s.sites
    .filter((x) => x.subcategoryId === id)
    .sort((a, b) => a.order - b.order)
    .map((x) => x.id);
  s.deleteSubcategory(id);
  const n = siteIds.length;
  showUndo(`Deleted ${sub.name}${n ? ` — ${n} site${n === 1 ? '' : 's'} moved to the recycle bin` : ''}`, () => {
    const now = useStore.getState();
    now.reinsertSubcategory(sub);
    for (const sid of siteIds) useStore.getState().restoreSite(sid, sub.categoryId, sub.id);
  });
}
