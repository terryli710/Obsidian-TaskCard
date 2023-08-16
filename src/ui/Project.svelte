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

  let isEditingProject = false;

  function enableProjectEditMode() {
      logger.debug(`availableProjects: ${JSON.stringify(availableProjects)}`);
      isEditingProject = true;
  }

  function selectProject(selectedProject: Project) {
      project = selectedProject;
      isEditingProject = false;
      logger.debug(`project: ${JSON.stringify(project)}`);
      taskSyncManager.updateObsidianTaskAttribute('project', selectedProject);
  }

  function handleSelectionChange(e) {
  const selectedIndex = e.target.value;
  selectProject(availableProjects[selectedIndex]);
  }
</script>

{#if params.mode === "single-line"}
<div class="task-card-project">
  <span class="project-color" style="background-color: {project.color};"></span>
</div>
{:else}
<div class="task-card-project">
  {#if isEditingProject}
  <select on:change={handleSelectionChange}>
          {#each availableProjects as availableProject, index}
              <option value={index} selected={availableProject === project}>{availableProject.name}</option>
          {/each}
      </select>
  {:else}
      <a href="#{project.name}" class="tag" target="_blank" rel="noopener" on:contextmenu={enableProjectEditMode}>
          {project.name}
      </a>
      <span class="project-color" style="background-color: {project.color};"></span>
  {/if}
</div>
{/if}
