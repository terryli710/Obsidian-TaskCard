import { MarkdownRenderChild } from "obsidian";
import { SvelteComponent } from 'svelte';
import StaticTaskList from '../ui/StaticTaskList.svelte';
import { MarkdownTaskMetadata } from "./StaticTaskListRenderer";



export class StaticTaskListSvelteAdapter extends MarkdownRenderChild {
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    mdTaskMetadataList: MarkdownTaskMetadata[]

    constructor(codeBlockEl: HTMLElement, mdTaskMetadataList: MarkdownTaskMetadata[]) {
        super(codeBlockEl);
        this.codeBlockEl = codeBlockEl
        this.mdTaskMetadataList = mdTaskMetadataList
    }

    onload() {
        this.svelteComponent = new StaticTaskList({
            target: this.codeBlockEl,
            props: {
                mdTaskMetadataList: this.mdTaskMetadataList
            }
        })
    }
}

// openLinkText to link to the original markdown task