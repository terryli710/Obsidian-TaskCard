<script>
    import { getContext } from "svelte";
    import { logger } from "../log";
    import { displayDate, displayTime } from "../utils/dateTimeFormatter"

    export let due = {
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
      logger.debug(`Due: ${datePart} ${timePart}`);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
    }
  </script>
  

<div class="task-card-due">
  {dueDisplay}
</div>
