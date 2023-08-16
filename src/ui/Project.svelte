<script lang="ts">
    import { TaskItemParams } from "../renderer/postProcessor";
    import { Project } from "../taskModule/project";
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
    import { logger } from "../utils/log";
    import { SettingStore } from "../settings";

    export let taskSyncManager: ObsidianTaskSyncManager;

    let project: Project = taskSyncManager.obsidianTask.project;
    let availableProjects: Project[] = [];
    SettingStore.subscribe((settings) => {
      availableProjects = settings.userMetadata.projects;
    })
    export let params: TaskItemParams;
  </script>
  
  {#if params.mode === "single-line"}
    <div class="task-card-project">
        <span class="project-color" style="background-color: {project.color};"></span>
    </div>
  {:else}
    <div class="task-card-project">
        <a href="#{project.name}" class="tag" target="_blank" rel="noopener">
        {project.name}
        </a>
        <span class="project-color" style="background-color: {project.color};"></span>
    </div>
  {/if}