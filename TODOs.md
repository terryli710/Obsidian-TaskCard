
# Display
- Debug no label, no due task.
- css fully adapt to themes.
- New display format.
  - New detection of the checkbox + content.

# Interaction
- hover behavior
- click behavior

# Parsing and Formatting

# Task adding and editing and deletion

## Task Adding
- Finish adding: when switch to preview mode;
  - Can we catch the preview mode toggle?

## Attribute Adding 


## Task Deletion



# Project handling


# BUGs


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


## Rendered HTML

- Note: defined in `TaskCard.svelte`

## Format Transformations
- `OrigMD` -> `FormatMD` - `taskParser`(✓) + `taskFormatter`(✓)
- `TaskEl` -> `RenderedEl` - `taskParser`(✓) + `TaskCard.svelte`(✓)
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