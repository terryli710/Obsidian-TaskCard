<script>
    export let project = {
        name : string,
        id : string
    };
    export let projectColor = "#49dbbb"; // TODO find the project color
  </script>
  
  <div class="task-card-project">
    <a href="#{project.name}" class="tag" target="_blank" rel="noopener">
      {project.name}
    </a>
    <span class="project-color" style="background-color: {projectColor};"></span>
  </div>