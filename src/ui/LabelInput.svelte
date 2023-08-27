


<script lang='ts'>
    export let newLabel = '';
    // export let editingIndex = null;
    export let finishLabelEditing;
    export let inputElement: HTMLInputElement;


    setTimeout(() => {
        if (inputElement) {
            inputElement.focus();  // Focus on the input element
            inputElement.select(); // Select all text inside the input element
        }
    }, 0);
</script>

<div class="task-card-label-input-container">
    <div class="task-card-label-input-left-part">
        <span class="task-card-label-input-prefix">#</span>
    </div>
    <input
        type="text"
        class="task-card-label-input"
        bind:value={newLabel}
        bind:this={inputElement}
        on:keydown={(event) => finishLabelEditing(event, newLabel)}
    />
</div>


<style>
    .task-card-label-input-container {
        position: relative;
        display: flex;
        border-radius: 2em;
        overflow: hidden;
        height: 23px; /* TODO: hardcoded */
        border: var(--border-width) solid var(--text-accent);
    }

    .task-card-label-input-left-part {
        background-color: var(--background-secondary-alt);
        border-top-left-radius: 2em;
        border-bottom-left-radius: 2em;
        border-top-right-radius: var(--radius-s);
        border-bottom-right-radius: var(--radius-s);
        display: flex;
        align-items: center;
        padding: 0 5px;
        margin: 1.5px;
        height: 21.5px;
    }

    .task-card-label-input-prefix {
        color: var(--text-faint);
        font-size: calc(var(--font-ui-medium) * 0.875);
        line-height: 1;
    }

    .task-card-label-input {
        display: inline-block;
        padding: var(--tag-padding-y) var(--tag-padding-x);
        font-size: calc(var(--font-ui-medium) * 0.875);
        color: var(--text-muted);
        line-height: 1;
        box-sizing: border-box;
        width: 100px;
        height: auto;
        white-space: nowrap;
        border: none;
        flex-grow: 1;
    }

    .task-card-label-input:focus {
        outline: none;
        box-shadow: none;
    }

</style>