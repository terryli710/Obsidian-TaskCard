<script>
    import {marked} from 'marked';
    import { logger } from "../log";

    export let description
    let descriptionMarkdown = marked(description);
</script>

<div class="task-card-description"> 
    {@html descriptionMarkdown} 
</div>