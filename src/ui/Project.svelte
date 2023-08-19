<script lang="ts">
  import { TaskItemParams } from "../renderer/postProcessor";
  import { Project } from "../taskModule/project";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import { logger } from "../utils/log";
  import { SettingStore } from "../settings";
    import { tick } from "svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let params: TaskItemParams;

  let project: Project | null = taskSyncManager.obsidianTask.hasProject() ? taskSyncManager.obsidianTask.project : null;
  let availableProjects: Project[] = [];
  SettingStore.subscribe((settings) => {
    availableProjects = settings.userMetadata.projects;
  })

  let projectPopup;
  let projectWrapper;

  async function toggleProjectPopup() {
    if (taskSyncManager.getTaskCardStatus('projectStatus') === 'selecting') {
      // taskSyncManager.setTaskCardStatus('projectStatus', 'done');
      taskSyncManager.taskCardStatus.projectStatus = 'done';
    } else {
      // taskSyncManager.setTaskCardStatus('projectStatus', 'selecting');
      taskSyncManager.taskCardStatus.projectStatus = 'selecting';
      await adjustWrapperHeight();
    }
  }

  function selectProject(selectedProject: Project) {
    project = selectedProject;
    // taskSyncManager.setTaskCardStatus('projectStatus', 'done');
    taskSyncManager.taskCardStatus.projectStatus = 'done';
    logger.debug(`project: ${JSON.stringify(project)}`);
    taskSyncManager.updateObsidianTaskAttribute('project', selectedProject);
  }

  function isSameProject(project1: Project | null, project2: Project | null): boolean {
    // if both are null, they are the same
    if (!project1 && !project2) return true;
    // if one is null, they are not the same
    if (!project1 || !project2) return false;
    const sameID = (project1.id === project2.id) || (!project1.id && !project2.id);
    const sameName = (project1.name === project2.name) || (!project1.name && !project2.name);
    logger.debug(`comparing project ${JSON.stringify(project1)} and ${JSON.stringify(project2)}, sameID: ${sameID}, sameName: ${sameName}`);
    return sameID && sameName;
  }

  async function adjustWrapperHeight() {
    await tick();
    if (projectPopup && projectWrapper) {
      const firstOption = projectPopup.firstChild;
      projectWrapper.style.height = `${firstOption.offsetHeight}px`;
    }
  }

  adjustWrapperHeight();

</script>


{#if params.mode === "single-line"}
  <div class="task-card-project">
    {#if project}
      <span class="project-color" style="background-color: {project.color};"></span>
    {/if}
  </div>
{:else}
  <div class="project-wrapper" bind:this={projectWrapper}>
    {#if taskSyncManager.getTaskCardStatus('projectStatus') === 'selecting'}
      <div class="project-popup" bind:this={projectPopup}>
        {#if project}
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
        {/if}
        {#each availableProjects as availableProject}
          {#if !isSameProject(project, availableProject)}
            <div
              class="project-option"
              on:click={() => selectProject(availableProject)}
              on:keydown={(e) => e.key === 'Enter' && selectProject(availableProject)}
              tabindex="0"
              role="button"
            >
              <div class="task-card-project">
                <a href="#{availableProject.name}" class="tag" target="_blank" rel="noopener">
                  {availableProject.name}
                </a>
                <span class="project-color" style="background-color: {availableProject.color};"></span>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      {#if project}
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
  </div>
{/if}
