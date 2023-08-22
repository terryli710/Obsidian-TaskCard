

# Releases
- TODO: Add simple docs.

# Features

- TODO: Aggregate by project, due and other filters (potentially achievable by dataview?).
- TODO: Auto added due.
- TODO: todoist sync?
- TODO: google calendar sync?

# Display

## Edit Mode
- like a normal markdown task.
- Using no display html to achieve this.
- formatted attribute saving.
- No direct edit method.
- Single line mode background problem - taskcard background compatibility
- TODO: BUG: when rerendering, all the task will be rerender to default mode. (can we memorize the display modes for each task?)

## Multi-mode display in preview mode
- Single line and multi line modes.
- Interactive UI in both modes.
- Modification reflective to the original doc.

## Icon
- Manually using lucide icon, because we cannot install lucide-svelte

# Interaction

## Settings

## Priority

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
- TODO: the font when editing.
- TODO: the text box when editing.
- TODO: font size and text box size when editing.

### Delete
- dropdown menu to delete.

## Labels
- TODO: BUG: when adding labels, single line mode will be enabled unexpected.

### Functionality
- TODO: searchable labels (currently cannot be searched).

### Addition
- bottom to add label.
- TODO: adjust bottom shape.

### Edit
- right click -> dropdown to edit.
- TODO: the css when editing.
- TODO: (optional) use dots besides the label to edit

### Delete
- dropdown menu to delete.
- TODO: (optional) use dots besides the label to delete.


## Project

- TODO: bug: sometimes the project cannot be correctly parsed when task has been added
  - case: when due is AFTER the project, project cannot be parsed.

### Functionality
- color is "randomly" generated from project name.

### Addition
- dropdown menu to add
- TODO: BUG: when there's no project in the setting, a circle will be added.
- TODO: OPTIMIZE: when there's no project, the project edit section.

### Edit
- Using a pop up menu
- CSS similar to the chosen project.

### Delete
- TODO: dropdown menu to delete.
- 

# Parsing and Formatting

- TODO: OPTIMIZE: when creating task, won't suggest attributes that has already been added.

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
- TODO: Description as appending paragraphs

# Task Formats

## Original Markdown

- A symbol to indicate that this task should be formatted. (#TaskCard)
- Edit the attributes using auto-suggests

```markdown
- [ ] An example task #label1 #label2 #TaskCard %%*priority:4*%% %%*description:"- A multi line description.\n- the second line."*%% %%*order:1*%% %%*project:{"id":"project-123", "name":"Project Name"}*%% %%*section-id:"section-456"*%% %%*parent:null*%% %%*children:[]*%% %%*due:"Aug 15, 2024"*%% %%*metadata:{"filePath":"/path/to/file"}*%%
```

## Formatted Markdown

- A json field for arbitrary matadata saving

```markdown
- [ ] An example task #TaskCard
<span class="priority" style="display:none;">4</span> 
<span class="description" style="display:none;">"- A multi line description.\n- the second line."</span> 
<span class="order" style="display:none;">1</span> 
<span class="project" style="display:none;">{"id":"project-123", "name":"Project Name"}</span> 
<span class="section-id" style="display:none;">"section-456"</span> 
<span class="labels" style="display:none;">["label1","label2"]</span> 
<span class="parent" style="display:none;">null</span> 
<span class="children" style="display:none;">[]</span> 
<span class="due" style="display:none;">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span> 
<span class="metadata" style="display:none;">{"filePath":"/path/to/file"}</span>
 .
```

- Note: in reality they are on the same line, here's just for better visualization.

## Task Element (HTML Element)

```html
<ul class="contains-task-list has-list-bullet">
  ...
  <li data-line="0" data-task="" class="task-list-item">
    <div class="list-bullet"></div>
    <input data-line="0" type="checkbox" class="task-list-item-checkbox">An example task 
    <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a>
    <span style="display:none;" class="priority">4</span>
    <span style="display:none;" class="description">"- A multi line description.\n- the second line."</span>
    <span style="display:none;" class="order">1</span>
    <span style="display:none;" class="project">{"id":"project-123", "name":"Project Name"}</span>
    <span style="display:none;" class="section-id">"section-456"</span>
    <span style="display:none;" class="labels">["label1","label2"]</span>
    <span style="display:none;" class="parent">null</span>
    <span style="display:none;" class="children">[]</span>
    <span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span>
    <span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span>
  </li>
</ul> 
```

```html
<li data-line="0" data-task="" class="task-list-item" style="display: none;"><div class="list-bullet"></div><input data-line="0" type="checkbox" class="task-list-item-checkbox">An example task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a><span style="display:none;" class="priority">4</span><span style="display:none;" class="description">"- A multi line description.\n- the second line."</span><span style="display:none;" class="order">1</span><span style="display:none;" class="project">{"id":"project-123", "name":"Project Name", "color":"#f1f1f1"}</span><span style="display:none;" class="section-id">"section-456"</span><span style="display:none;" class="labels">["label1","label2"]</span><span style="display:none;" class="parent">null</span><span style="display:none;" class="children">[]</span><span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span><span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span></li> 
```

```html
<li data-line="0" data-task="" class="task-list-item" style="display: none;"><div class="list-bullet"></div><input data-line="0" type="checkbox" class="task-list-item-checkbox">An example task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a><span style="display:none;" class="priority">4</span><span style="display:none;" class="description">"- A multi line description.\n- the second line."</span><span style="display:none;" class="order">1</span><span style="display:none;" class="project">{"id":"project-123", "name":"Project Name", "color":"#f1f1f1"}</span><span style="display:none;" class="section-id">"section-456"</span><span style="display:none;" class="labels">["label1","label2"]</span><span style="display:none;" class="parent">null</span><span style="display:none;" class="children">[]</span><span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span><span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span></li> 
```


## Rendered HTML

- Note: defined in `TaskCard.svelte`

## Format Transformations
- `OrigMD` -> `FormatMD` - `taskParser`(✓) + `TaskFormatter`(✓)
- `TaskEl` -> `RenderedEl` - `taskParser`(✓) + `TaskCard.svelte`(✓)
- `TaskEl` -> `FormatMD` - `taskParser`(✓) + TaskFormatter(✓)
- `FormatMD` - `taskValidator`(✓)
- `OrigMD` - `taskValidator`(✓)
- `TaskEl` - `ElementFilter`
- `OrigMD` - `taskMonitor` -> should work with autosuggest... so later


# Reference

## el.innerHTML

```html
<ul class="contains-task-list has-list-bullet">
<li data-line="0" data-task="" class="task-list-item"><div class="list-bullet"></div><input data-line="0" type="checkbox" class="task-list-item-checkbox">An example task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a><span style="display:none;" class="priority">4</span><span style="display:none;" class="description">"- A multi line description.\n- the second line."</span><span style="display:none;" class="order">1</span><span style="display:none;" class="project">{"id":"project-123", "name":"Project Name"}</span><span style="display:none;" class="section-id">"section-456"</span><span style="display:none;" class="labels">["label1","label2"]</span><span style="display:none;" class="parent">null</span><span style="display:none;" class="children">[]</span><span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span><span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span></li>
<li data-line="1" data-task="" class="task-list-item"><div class="list-bullet"></div><input data-line="1" type="checkbox" class="task-list-item-checkbox">An example task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a><span style="display:none;" class="priority">4</span><span style="display:none;" class="description">"- A multi line description.\n- the second line."</span><span style="display:none;" class="order">1</span><span style="display:none;" class="project">{"id":"project-123", "name":"Project Name"}</span><span style="display:none;" class="section-id">"section-456"</span><span style="display:none;" class="labels">["label1","label2"]</span><span style="display:none;" class="parent">null</span><span style="display:none;" class="children">[]</span><span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span><span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span><br>
Some normal content</li>
<li data-line="3" data-task="" class="task-list-item"><div class="list-bullet"></div><input data-line="3" type="checkbox" class="task-list-item-checkbox">unformatted task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a>   </li>
</ul> 
```


## el.innerHTML after rendering

```html
<ul class="contains-task-list has-list-bullet">
  <li data-line="0" data-task="" class="task-list-item" style="display: none;"><div class="list-bullet"></div><input data-line="0" type="checkbox" class="task-list-item-checkbox">An example task <a href="#TaskCard" class="tag" target="_blank" rel="noopener">#TaskCard</a><span style="display:none;" class="priority">4</span><span style="display:none;" class="description">"- A multi line description.\n- the second line."</span><span style="display:none;" class="order">1</span><span style="display:none;" class="project">{"id":"project-123", "name":"Project Name"}</span><span style="display:none;" class="section-id">"section-456"</span><span style="display:none;" class="labels">["label1","label2"]</span><span style="display:none;" class="parent">null</span><span style="display:none;" class="children">[]</span><span style="display:none;" class="due">{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","datetime":null,"timezone":null}</span><span style="display:none;" class="metadata">{"filePath":"/path/to/file"}</span></li>
  <li data-line="1" data-task="" class="task-list-item"><div class="list-bullet"></div><input data-line="1" type="checkbox" class="task-list-item-checkbox">A normal task<br>
  Some non task content</li>
  <li class="obsidian-taskcard task-list-item mode-multi-line">
    <div class="task-card-major-block">
      <div class="task-card-checkbox-wrapper">
        <input type="checkbox" class="task-card-checkbox 4"></div> 
        <div class="task-card-content-project-line">
          <div class="task-card-content">An example task</div> 
          <div class="task-card-project">
            <div class="task-card-project">
              <a href="#Project Name" class="tag" target="_blank" rel="noopener">Project Name</a> 
              <span class="project-color"></span>
            </div>
          </div>
          </div> 
      <div class="task-card-description">
        <ul>
          <li>A multi line description.</li>
          <li>the second line.</li>
        </ul>
      </div>
    </div> 
    <div class="task-card-attribute-bottom-bar"><div class="task-card-attribute-bottom-bar-left"><div class="task-card-due">Aug 15, 2024</div> <div class="task-card-attribute-separator">|</div> <div class="task-card-labels"><a href="#label1" class="tag" target="_blank" rel="noopener">#label1</a> <a href="#label2" class="tag" target="_blank" rel="noopener">#label2</a></div></div> <div class="task-card-attribute-bottom-bar-right"><button class="task-card-collapse-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="task-card-icon"><path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path></svg></button></div></div></li>
</ul> 
```