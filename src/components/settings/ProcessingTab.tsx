import { ProcessingEditor } from '../processing/ProcessingEditor';

// Workspace → Queue & processing: the same sites panel the Queue box opens.
export function ProcessingTab() {
  return (
    <div className="h-[min(720px,calc(calc(92vh/var(--ui-zoom,1))-200px))] min-h-[520px]">
      <ProcessingEditor />
    </div>
  );
}
