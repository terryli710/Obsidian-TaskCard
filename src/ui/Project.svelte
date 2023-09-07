


<script lang="ts">
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Project } from "../taskModule/project";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import { logger } from "../utils/log";
  import { SettingStore } from "../settings";
  import { tick, afterUpdate } from "svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let params: TaskDisplayParams;

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
    taskSyncManager.updateObsidianTaskAttribute('project', selectedProject);
  }

  function isSameProject(project1: Project | null, project2: Project | null): boolean {
    if (!project1 && !project2) return true;
    if (!project1 || !project2) return false;
    const sameID = (project1.id === project2.id) || (!project1.id && !project2.id);
    const sameName = (project1.name === project2.name) || (!project1.name && !project2.name);
    return sameID && sameName;
  }

  async function adjustWrapperHeight() {
    await tick();
    if (projectPopup && projectWrapper) {
      const firstOption = projectPopup.firstChild as HTMLDivElement;
      if (firstOption) {
        const height = firstOption.offsetHeight;
        const padding = parseFloat(getComputedStyle(projectPopup).paddingTop);
        const margin = parseFloat(getComputedStyle(projectPopup).marginBottom);
        const totalHeight = height + padding + margin;
        projectWrapper.style.height = `${totalHeight}px`;
      }
    }
  }

  adjustWrapperHeight();

  function isSelectEvent(evt: MouseEvent | KeyboardEvent) {
    // return if it's mouse single click or keyboard "Enter" key press
    if (evt instanceof MouseEvent) {
      return evt.button === 0;
    }
    return evt instanceof KeyboardEvent && (evt.key === "Enter" || evt.key === " ");
  }

  function searchProject(evt: MouseEvent | KeyboardEvent, projectName: string) {
    if (!isSelectEvent(evt)) { return; }
    // @ts-ignore
    const searchResult = taskSyncManager.plugin.app.internalPlugins.getPluginById('global-search').instance.openGlobalSearch(`line:\(\"\\\"name\\\":\\\"${projectName}\\\"\"\)`);
  }
</script>

{#if params.mode === "single-line"}
  <div class="task-card-project">
    {#if project}
      <span class="project-color" style="background-color: {project.color};"></span>
    {/if}
  </div>
{:else}
  <div class="project-wrapper" bind:this={projectWrapper}>
    {#if taskSyncManager.getTaskCardStatus('projectStatus') === 'selecting' && availableProjects.length > 0}
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
                <div class="project-name">
                  {project.name}
                </div>
                <span class="project-color" style="background-color: {project.color};"></span>
              </div>
            </div>
        {/if}
        {#each availableProjects as availableProject, i}
          {#if (i !== 0 || project) && !isSameProject(project, availableProject)}
              <div class="divider"></div>
          {/if}
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
          <div class="project-name"
            title="search for project: {project.name}"
            on:click={(evt) => searchProject(evt, project.name)}
            on:keydown={(evt) => searchProject(evt, project.name)}
            tabindex="0"
            role="button"
          >
            {project.name}
          </div>
          <span
            class="project-color clickable-icon"
            style="background-color: {project.color};"
            title="select project"
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
    --project-popup-padding-y: 4px;
    --project-popup-padding-x: 6px;
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
      top: calc(-1 * (var(--project-popup-padding-y) + var(--border-width)));
      right: calc(-1 * (var(--project-popup-padding-x) + var(--border-width)));
      margin: 2px 0;
      padding: var(--project-popup-padding-y) var(--project-popup-padding-x);
      background-color: var(--interactive-normal);
      border: var(--border-width) solid var(--background-modifier-border);
      border-radius: var(--radius-m);
      z-index: 1;
    }

    .project-option {
      display: flex;
      justify-content: flex-end;
      cursor: pointer;
      border-radius: var(--radius-s);
    }

    .project-option:hover {
      background-color: var(--background-modifier-hover);
    }

    .project-option:active {
      background-color: var(--background-modifier-active-hover);
    }

    .divider {
      height: 1px;
      margin: 3px 0;
      background-color: transparent;
    }

  .project-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    padding: 4px;
    border-radius: 50%;
    margin: 4px;
    /* box-sizing: border-box; */
    border: var(--border-width) solid var(--background-primary);
  }

  .project-color.clickable-icon:hover {
    cursor: pointer; /* Change the cursor to a pointer on hover */
    border: var(--border-width) solid var(--background-modifier-border); /* Add a border on hover */
  }

  .project-name {
    background-color: var(--tag-background);
    border: var(--tag-border-width) solid var(--tag-border-color);
    border-radius: var(--tag-radius);
    color: var(--tag-color);
    font-size: var(--tag-size);
    font-weight: var(--tag-weight);
    text-decoration: var(--tag-decoration);
    padding: var(--tag-padding-y) var(--tag-padding-x);
    line-height: 1;
    cursor: pointer;
  }

  .project-name:hover {
    background-color: var(--tag-background-hover);
    border: var(--tag-border-width) solid var(--tag-border-color-hover);
    color: var(--tag-color-hover);
    text-decoration: var(--tag-decoration-hover);
  }
  </style>