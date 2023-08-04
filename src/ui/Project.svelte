<script lang="ts">
    import { TaskItemParams } from "../renderer/injector";
    import { Project } from "../taskModule/task";
    import { stringToColor } from "../utils/colorConverter";
    
    export let project: Project;
    export let params: TaskItemParams;
    let projectColor = stringToColor(project.name);
  </script>
  
  {#if params.mode === "single-line"}
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