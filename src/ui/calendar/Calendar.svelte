<!-- <svelte:options immutable />

<script lang="ts">
  import type { Moment } from "moment";
  import moment from "moment";
  import {
    Calendar as CalendarBase,
    ICalendarSource,
    IWeekStartOption,
    configureGlobalMomentLocale,
  } from "obsidian-calendar-ui";
  import { createEventDispatcher, onDestroy } from "svelte";


  let today: Moment;

  $: today = getToday("system-default", "sunday");

  export let displayedMonth: Moment = today;
  export let sources: ICalendarSource[] = [];
  export let onHoverDay: (date: Moment, targetEl: EventTarget) => boolean = () => true;
  export let onHoverWeek: (date: Moment, targetEl: EventTarget) => boolean = () => true;
//   export let onClickDay: (date: Moment, isMetaPressed: boolean) => boolean = () => true;
  export let onClickWeek: (date: Moment, isMetaPressed: boolean) => boolean = () => true;
  export let onContextMenuDay: (date: Moment, event: MouseEvent) => boolean = () => true;
  export let onContextMenuWeek: (date: Moment, event: MouseEvent) => boolean = () => true;

  let selectedDate: Moment = displayedMonth.clone();

  export function tick() {
    today = window.moment();
  }



  function getToday(localeOverride: string, weekStart: IWeekStartOption) {
    configureGlobalMomentLocale(localeOverride, weekStart);
    return window.moment();
  }

  // 1 minute heartbeat to keep `today` reflecting the current day
  let heartbeat = setInterval(() => {
    tick();

    const isViewingCurrentMonth = displayedMonth.isSame(today, "day");
    if (isViewingCurrentMonth) {
      // if it's midnight on the last day of the month, this will
      // update the display to show the new month.
      displayedMonth = today;
    }
  }, 1000 * 60);

  onDestroy(() => {
    clearInterval(heartbeat);
  });

  const selectDateDispatch = createEventDispatcher();
  $: selectDateDispatch("selected", selectedDate);

  function onClickDay(date: Moment, isMetaPressed: boolean) {
    selectedDate = date;
  }

</script>


<CalendarBase
  {today}
  {onHoverDay}
  {onHoverWeek}
  {onContextMenuDay}
  {onContextMenuWeek}
  {onClickDay}
  {onClickWeek}
  bind:displayedMonth
  localeData={today.localeData()}
/> -->
