import { MarkdownRenderChild } from "obsidian";
import { SvelteComponent } from 'svelte';




export class StaticTaskListSvelteAdapter extends MarkdownRenderChild {
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement

    constructor(codeBlockEl: HTMLElement) {
        super(codeBlockEl);
        this.codeBlockEl = codeBlockEl
    }

    onload() {
        this.svelteComponent = 
    }
}