


<script lang="ts">
  import { TaskItemParams } from "../renderer/postProcessor";
  import { Project } from "../taskModule/project";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import { logger } from "../utils/log";
  import { SettingStore } from "../settings";
  import { tick, afterUpdate } from "svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let params: TaskItemParams;

  let project: Project | null = taskSyncManager.obsidianTask.hasProject() ? taskSyncManager.obsidianTask.project : null;
  let availableProjects: Project[] = [];
  SettingStore.subscribe((settings) => {
    availableProjects = settings.userMetadata.projects;
  })

  let projectPopup: HTMLDivElement;
  let projectWrapper: HTMLDivElement;

  async function toggleProjectPopup() {
    if (taskSyncManager.getTaskCardStatus('projectStatus') === 'selecting') {
      taskSyncManager.taskCardStatus.projectStatus = 'done';
    } else {
      taskSyncManager.taskCardStatus.projectStatus = 'selecting';
      await adjustWrapperHeight();
    }
  }

  function selectProject(selectedProject: Project) {
    project = selectedProject;
    taskSyncManager.taskCardStatus.projectStatus = 'done';
    logger.debug(`project: ${JSON.stringify(project)}`);
    taskSyncManager.updateObsidianTaskAttribute('project', selectedProject);
  }

  function isSameProject(project1: Project | null, project2: Project | null): boolean {
    if (!project1 && !project2) return true;
    if (!project1 || !project2) return false;
    const sameID = (project1.id === project2.id) || (!project1.id && !project2.id);
    const sameName = (project1.name === project2.name) || (!project1.name && !project2.name);
    logger.debug(`comparing project ${JSON.stringify(project1)} and ${JSON.stringify(project2)}, sameID: ${sameID}, sameName: ${sameName}`);
    return sameID && sameName;
  }

  async function adjustWrapperHeight() {
    await tick();
    logger.debug(`adjustWrapperHeight called`);
    if (projectPopup && projectWrapper) {
      const firstOption = projectPopup.firstChild as HTMLDivElement;
      if (firstOption) {
        const height = firstOption.offsetHeight;
        const padding = parseFloat(getComputedStyle(projectPopup).paddingTop);
        const totalHeight = height + 2 * padding;
        projectWrapper.style.height = `${totalHeight}px`;
        logger.debug(`adjusting height to ${totalHeight}px, height=${height}, padding=${padding}`);
      }
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
        {#each availableProjects as availableProject, i}
          <!-- {#if (i !== 0 || project) && !isSameProject(project, availableProject)}
              <div class="divider"></div>
          {/if} -->
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


<style>

  :root {
    --project-popup-padding: 4px;
  }
    
  .project-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .task-card-project {
    flex-shrink: 0;
    white-space: nowrap;
    display: flex;
    align-items: center;
    font-size: var(--font-ui-small);
  }

  .project-popup {
        position: absolute;
        top: calc(-1 * (var(--project-popup-padding) + var(--border-width)));
        right: calc(-1 * (var(--project-popup-padding) + var(--border-width)));
        margin: 0;
        padding: var(--project-popup-padding);
        background-color: var(--interactive-normal);
        border: var(--border-width) solid var(--background-modifier-border);
        border-radius: var(--radius-m);
    }

    .project-option {
        margin: 4px 0; /* Add equal margin to top and bottom */
        display: flex;
        justify-content: flex-end;
        cursor: pointer;
        transition: background-color 0.3s, color 0.3s;
    }

    .project-option:hover {
        background-color: #f0f0f0;
        color: #444;
    }

    .divider {
        height: 1px;
        background-color: #d0d0d0;
    }
  
  </style>