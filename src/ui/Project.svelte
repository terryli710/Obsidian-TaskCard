<script>
    import { stringToColor } from "../utils/colorConverter";
    import { modeStore } from "../renderer/store";
    $: mode = $modeStore;
    
    export let project = {
        name : string,
        id : string
    };
    export let projectColor = stringToColor(project.name);
  </script>
  
  {#if mode === "single-line"}
    <div class="task-card-project">
        <span class="project-color" style="background-color: {projectColor};"></span>
    </div>
  {:else}
    <div class="task-card-project">
        <a href="#{project.name}" class="tag" target="_blank" rel="noopener">
        {project.name}
        </a>
        <span class="project-color" style="background-color: {projectColor};"></span>
    </div>
  {/if}