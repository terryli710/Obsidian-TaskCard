
<script lang="ts">
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
    import MonoColorSVG from "../components/icons/MonoColorSVG.svelte";
    import GoogleCalendarLogo from "../components/icons/GoogleCalendarLogo.svelte";
    import { logger } from "../utils/log";

    export let taskSyncManager: ObsidianTaskSyncManager = undefined;
    export let providedMetadata = undefined;

    const MetadataLogoMapping = {
        googleSyncSetting: 'google',
    }

    let logoList = [];

    let metadata = taskSyncManager ? taskSyncManager.obsidianTask.metadata : providedMetadata;
    if (!metadata) metadata = {};
    // Check if taskSyncManager and its nested properties are not undefined
    if (metadata.syncMappings) {
        // Loop over the keys in MetadataLogoMapping
        for (const key in MetadataLogoMapping) {
            // Check if the key from MetadataLogoMapping exists in metadata.syncMappings
            if (key in metadata.syncMappings) {
                // Check if the value for this key in metadata is not empty or "{}"
                const metadataValue = metadata.syncMappings[key];
                if (metadataValue && metadataValue.id && metadataValue.id !== "") {
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
        width: 18px;
        height: 18px;
        align-items: center;
        margin: 0 2px;
        padding: 2px;
        border: calc(var(--border-width) / 2) solid var(--text-accent);
        border-radius: var(--radius-s);
    }
</style>