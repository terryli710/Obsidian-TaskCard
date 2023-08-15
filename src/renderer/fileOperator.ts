import { TFile } from "obsidian";
import TaskCardPlugin from "..";


export class FileOperator {
    plugin: TaskCardPlugin;
    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin;
    }

    getFileContent(file: TFile): string {
        return 
    }


}