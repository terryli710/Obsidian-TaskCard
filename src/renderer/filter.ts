

function taskItemsFilter(el: HTMLElement): HTMLElement[] {
    // Select all elements with class HyperMD-task-line, as they seem common to your target elements.
  const taskLines = Array.from(el.querySelectorAll('.HyperMD-task-line'));

  const taskCards: HTMLElement[] = [];
  for (const taskLine of taskLines) {
    // Check if the element contains specific characteristics that distinguish the second type.
    if (taskLine.querySelectorAll('.cm-widgetBuffer').length > 5 && 
        taskLine.querySelectorAll('[style="display:none;"]').length > 0) {
            taskCards.push(taskLine as HTMLElement);
    }
  }

  const taskItems: HTMLElement[] = [];

  for (const taskCard of taskCards) { taskItems.push(taskCard.parentElement); }
  return taskItems;
}