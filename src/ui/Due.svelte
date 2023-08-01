<script>
    import { getContext } from "svelte";
    import { logger } from "../log";
    
    export let due = {
      isRecurring: false,
      date: null,
      time: null,
      string: null,
      timezone: null
    };
  
    let dueDisplay;
  
    const formatDate = () => {
      let currentDate = new Date();
      let dueDate = new Date(due.date);
  
      if(due.time){
        dueDate = new Date(`${due.date}T${due.time}`);
      }
      let daysDiff = Math.floor((dueDate - currentDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) return 'Today';
      if (daysDiff === 1) return 'Tomorrow';
      if (daysDiff === -1) return 'Yesterday';
  
      let month = dueDate.toLocaleString('default', { month: 'short' });
      let date = dueDate.getDate();
      return `${month} ${date}`;
    };
  
    const formatTime = () => {
      if(due.time){
        let [hours, minutes] = due.time.split(":");
        return `${parseInt(hours) % 12 || 12}:${minutes} ${parseInt(hours) >= 12 ? 'PM' : 'AM'}`;
      }
      return null;
    };
  
    $: {
      let datePart = formatDate();
      let timePart = formatTime();
      logger.debug(`Due: ${datePart} ${timePart}`);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
    }
  
</script>

<div class="task-card-due">
  {dueDisplay}
</div>

<style>
    .task-card-due {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 15px;
        border: 1px solid gray;
        width: auto;
        font-size: 0.8em;
    }
</style>