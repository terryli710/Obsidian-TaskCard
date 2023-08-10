
# Display
- Debug no label, no due task.
- css fully adapt to themes.

# Interaction
- hover behavior
- click behavior

# Parsing and Formatting
- mostly done.

# Task adding and editing and deletion

## Task Adding
- 

## Attribute Adding 
- Auto suggestion: filter along typing.


## Task Deletion



# Project handling
- Project autoSuggest - show project + color;
- Project color picker debug - related to text;
- 

# BUGs


# Task Formats

## Original Markdown

- A symbol to indicate that this task should be formatted. (#TaskCard)


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
```

- Note: in reality they are on the same line, here's just for better visualization.

## Task Element (HTML Element)

```html
<div class="cm-active HyperMD-list-line HyperMD-list-line-1 HyperMD-task-line cm-line" data-task=" " style="text-indent:-23px;padding-inline-start:27px">
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span contenteditable="false"></span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <img class="cm-widgetBuffer" aria-hidden="true">
  <label class="task-list-label" contenteditable="false">
    <input class="task-list-item-checkbox" type="checkbox" data-task=" ">
  </label>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> An example task </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="priority">4</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="description">"- A multi line description.\n- the second line."</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="order">1</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="project">{"id":"project-123", "name":"Project Name"}</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="section-id">"section-456"</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="labels">["label1","label2","label3","label4","label5"]</span>
  </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-list-1"> </span>
  <img class="cm-widgetBuffer" aria-hidden="true">
  <span class="cm-html-embed" tabindex="-1" contenteditable="false">
    <span style="display:none;" class="completed">false</span>
  </
```


## Rendered HTML

- Note: defined in `TaskCard.svelte`

## Format Transformations
- `OrigMD` -> `FormatMD` - `taskParser`(✓) + `taskFormatter`(✓)
- `TaskEl` -> `RenderedEl` - `taskParser`(✓) + `TaskCard.svelte`(✓)
- `FormatMD` - `taskValidator`(✓)
- `OrigMD` - `taskValidator`(✓)
- `OrigMD` - `taskMonitor` -> should work with autosuggest... so later
