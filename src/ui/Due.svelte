<script lang="ts">
    import { getContext } from "svelte";
    import { logger } from "../utils/log";
    import { displayDate, displayTime } from "../utils/dateTimeFormatter"
    import { DueDate } from "../taskModule/task";

    export let due: DueDate = {
      isRecurring: false,
      date: null,
      time: null,
      string: null,
      timezone: null
    };
  
    let dueDisplay = "";

    $: {
      let datePart = displayDate(due.date);
      let timePart = displayTime(due.time);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
    }
  </script>
  

<div class="task-card-due">
  {dueDisplay}
</div>
