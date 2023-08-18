


import { Menu } from 'obsidian';
import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';

export let taskSyncManager: ObsidianTaskSyncManager;


export function showCardMenu(event) {
    event.preventDefault();
    const cardMenu = new Menu();
    // description: add remove
    // due: add remove
    // labels: remove all
    // project: add remove
    // task: delete
    if (!taskSyncManager.obsidianTask.hasDescription()) {
        cardMenu.addItem((item) => {
            item.setTitle('Add Description');
            item.setIcon('plus');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                // the function that is called when the menu item is clicked
            })
        })
    } else {
        cardMenu.addItem((item) => {
            item.setTitle('Delete Description');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                // the function that is called when the menu item is clicked
            })
        })
    }

    if (!taskSyncManager.obsidianTask.hasDue()) {
        cardMenu.addItem((item) => {
            item.setTitle('Add Due');
            item.setIcon('plus');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                
            })
        })
    } else {
        cardMenu.addItem((item) => {
            item.setTitle('Delete Due');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                
            })
        })
    }
        
}