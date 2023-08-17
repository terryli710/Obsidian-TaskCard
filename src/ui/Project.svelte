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

  let showProjectPopup = false;

  function toggleProjectPopup() {
    showProjectPopup = !showProjectPopup;
    logger.debug(`showProjectPopup: ${showProjectPopup}, availableProjects: ${JSON.stringify(availableProjects)}`);
  }

  function selectProject(selectedProject: Project) {
    project = selectedProject;
    showProjectPopup = false;
    logger.debug(`project: ${JSON.stringify(project)}`);
    taskSyncManager.updateObsidianTaskAttribute('project', selectedProject);
  }

  function isSameProject(project1: Project, project2: Project): boolean {
    const sameID = (project1.id === project2.id) || (!project1.id && !project2.id);
    const sameName = (project1.name === project2.name) || (!project1.name && !project2.name);
    logger.debug(`comparing project ${JSON.stringify(project1)} and ${JSON.stringify(project2)}, sameID: ${sameID}, sameName: ${sameName}`);
    return sameID && sameName;
  }

</script>

<style>
  .project-popup {
    position: absolute;
    /* top: 100%;
    left: 0; */
  }
</style>

{#if params.mode === "single-line"}
  <div class="task-card-project">
    <span class="project-color" style="background-color: {project.color};"></span>
  </div>
{:else}
  {#if showProjectPopup}
    <div class="project-popup">
      <div
        class="project-option"
        on:click={() => selectProject(project)}
        on:keydown={(e) => e.key === 'Enter' && selectProject(project)}
        tabindex="0"
        role="button"
      >
        <div class="task-card-project">
          <a href="#{project.name}" class="tag" target="_blank" rel="noopener">
            {project.name}
          </a>
          <span class="project-color" style="background-color: {project.color};"></span>
        </div>
      </div>
      {#each availableProjects as availableProject}
        {#if !isSameProject(project, availableProject)}
          <div
            class="project-option"
            on:click={() => selectProject(availableProject)}
            on:keydown={(e) => e.key === 'Enter' && selectProject(availableProject)}
            tabindex="0"
            role="button"
          >
            <a href="#{availableProject.name}" class="tag" target="_blank" rel="noopener">
              {availableProject.name}
            </a>
            <span class="project-color" style="background-color: {availableProject.color};"></span>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
  <div class="task-card-project">
    <a href="#{project.name}" class="tag" target="_blank" rel="noopener">
      {project.name}
    </a>
    <span
      class="project-color"
      style="background-color: {project.color};"
      on:click={toggleProjectPopup}
      on:keydown={(e) => e.key === 'Enter' && toggleProjectPopup()}
      tabindex="0"
      role="button"
    ></span>
  </div>
  {/if}
{/if}