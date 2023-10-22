
<script lang="ts">
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
    import MonoColorSVG from "../components/icons/MonoColorSVG.svelte";
    import GoogleCalendarLogo from "../components/icons/GoogleCalendarLogo.svelte";
    import { logger } from "../utils/log";

    export let taskSyncManager: ObsidianTaskSyncManager;

    const MetadataLogoMapping = {
        googleSyncSetting: 'google',
    }

    let logoList = [];

    // Check if taskSyncManager and its nested properties are not undefined
    if (taskSyncManager.obsidianTask.metadata.syncMappings) {
        // Loop over the keys in MetadataLogoMapping
        for (const key in MetadataLogoMapping) {
            // Check if the key from MetadataLogoMapping exists in taskSyncManager.obsidianTask.metadata.syncMappings
            if (key in taskSyncManager.obsidianTask.metadata.syncMappings) {
                // Check if the value for this key in metadata is not empty or "{}"
                const metadataValue = taskSyncManager.obsidianTask.metadata.syncMappings[key];
                if (metadataValue && metadataValue !== "{}") {
                    // Add the corresponding value from MetadataLogoMapping to logoList
                    logoList.push(MetadataLogoMapping[key]);
                }
            }
        }
    }

</script>


{#if logoList.includes('google')}
    <div class="logo-wrapper">
        <GoogleCalendarLogo width="14px" height="14px" ariaLabel="Google Calendar Synced" />
        <!-- <MonoColorSVG 
            SomeSvelteComponent={GoogleCalendarLogo} 
            componentProps={{ width: "14px", height: "14px", ariaLabel: "Google Calendar Synced" }} 
            color="#800080" 
        /> -->
    </div>
{/if}

<style>
    .logo-wrapper {
        display: flex;
        /* width: 14px;
        height: 14px; */
        align-items: center;
        padding: 0 4px;
    }
</style>