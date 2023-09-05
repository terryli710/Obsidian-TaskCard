# Releases

# Features

- TODO: Auto added due.
- TODO: google calendar sync?
- TODO: subtasks?
- TODO: todoist sync?
- TODO: recurring task?
- TODO: date parsing - date only?

# Commands
- 

# Display

## Edit Mode

- like a normal markdown task.
- Using no display html to achieve this.
- formatted attribute saving.
- No direct edit method.
- Single line mode background problem - taskcard background compatibility
- TODO: optimize the appearance.
- 

## Multi-mode display in preview mode

- Single line and multi line modes.
- Interactive UI in both modes.
- Modification reflective to the original doc.
- TODO: OPTIMIZE: keep the window position when rerendering!!
- TODO: BUG: line error when there's multiple text and spaces lines!!!
- TODO: OPTIMIZE: text between two tasks will be leave out. -> they should be shown in description.
- TODO: OPTIMIZE: multi-line description.

## Icon

- Manually using lucide icon, because we cannot install lucide-svelte

## Menu

# Interaction

## Settings


## Priority

## Complete

### Edit

## Content

### Addition

- NA

### Edit

- double click and edit content with single line window.
  - Save and discard edits

### Delete

- NA

## Description

- change line vs. save hot key?
- Add place holder to instruct people.

### Addition

- Dropdown menu to add.

### Edit

- double click and edit description with multi line support.
  - Save and discard edits.
- TODO: (far stretch) interactive display mode when editing.
- TODO: sub task in descriptions
- Sub task interactive.

### Delete

- dropdown menu to delete.

## Due

- `chrono` is not string enough for all the date formats.
- Add msg to indicate user when date parsing is failed.
- Add `sugar.js` to replace chrono.

### Addition

- dropdown menu to add.

### Edit

- double click and edit due string.
  - Save and discard edits.

### Delete

- dropdown menu to delete.

## Labels

### Functionality

### Addition

- bottom to add label.

### Edit

- right click -> dropdown to edit.

### Delete

- dropdown menu to delete.

## Project

### Functionality

- color is "randomly" generated from project name.

### Addition

- dropdown menu to add

### Edit

- Using a pop up menu
- CSS similar to the chosen project.

### Delete


# Parsing and Formatting

# Task adding and editing and deletion

- dropdown menu in preview mode to do attribute adding and editing etc.

## Task Adding

- Finish adding: when switch to preview mode;
  - Can we catch the preview mode toggle?

## Attribute Adding

- dropdown menu?

## Task Deletion

- Add delete button

# Project handling

# BUGs

# File <-> HTML Sync

## HTML pinpointing the MD

- Mostly done.
- TODO: OPTIMIZE: Description as appending paragraphs

# Task Formats

## Original Markdown

- A symbol to indicate that this task should be formatted. (#TaskCard)
- Edit the attributes using auto-suggests

```markdown
- [ ] An example task #label1 #label2 #TaskCard %%*priority: 4*%% %%*description: - A multi line description.\n- the second line.*%% %%*project: Project Name*%% %%*due:Aug 15, 2024*%%
```

## Formatted Markdown

- A json field for arbitrary matadata saving

```markdown
- [ ] Call family #PersonalLife #Family #TaskCard<span style="display:none">{"id": "ad36fe58-9425-4bad-9864-06ea0d80cd9c", "priority": 3, "description": "- Catch up with parents\n- Ask about siblings", "order": 0, "project": {"id": "", "name": ""}, "section-id": "", "parent": null, "children": [], "due": {"isRecurring": false, "date": "2023-08-26", "string": "this weekend"}, "metadata": {"taskItemParams": {"mode": "single-line"}}}</span> .
```

## Task Element (HTML Element)


```html
<li data-line="0" data-task="" class="task-list-item" style="display: none;">
  <div class="list-bullet"></div>
  <input data-line="0" type="checkbox" class="task-list-item-checkbox">
  An example task 
  <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a>
  <span style="display:none">{"id": "ad36fe58-9425-4bad-9864-06ea0d80cd9c", "priority": 3, "description": "- Catch up with parents\\n- Ask about siblings", "order": 0, "project": {"id": "", "name": ""}, "section-id": "", "parent": null, "children": [], "due": {"isRecurring": false, "date": "2023-08-26", "string": "this weekend"}, "metadata": {"taskItemParams": {"mode": "single-line"}}}</span>
</li>
```