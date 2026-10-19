// The big work panel (Currently processing → Queue → To-do). Any part of the
// page asks for it with an event, so cards, alerts and the extension's
// "Review" link don't need a shared parent.

export type BoardTab = 'processing' | 'queue' | 'todo';

export interface BoardRequest {
  tab: BoardTab;
  focus?: 'overdue'; // To-do: float overdue tasks to the top
  archive?: boolean; // To-do: open on the archive
  focusInput?: boolean; // To-do: put the cursor in quick add
}

export const OPEN_BOARD_EVENT = 'devdeck:open-board';

export function openBoard(req: BoardRequest): void {
  window.dispatchEvent(new CustomEvent<BoardRequest>(OPEN_BOARD_EVENT, { detail: req }));
}
