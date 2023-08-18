


import { Menu } from 'obsidian';
import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
import { logger } from '../utils/log';


export function showCardMenu(event, taskSyncManager: ObsidianTaskSyncManager) {
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
                taskSyncManager.setTaskCardStatus('descriptionStatus', 'editing');
            })
        })
    } else {
        cardMenu.addItem((item) => {
            item.setTitle('Delete Description');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.updateObsidianTaskAttribute('description', '');
            })
        })
    }

    if (!taskSyncManager.obsidianTask.hasDue()) {
        cardMenu.addItem((item) => {
            item.setTitle('Add Due');
            item.setIcon('plus');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.setTaskCardStatus('dueStatus', 'editing');
            })
        })
    } else {
        cardMenu.addItem((item) => {
            item.setTitle('Delete Due');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.updateObsidianTaskAttribute('due', null);
            })
        })
    }

    if (taskSyncManager.obsidianTask.hasAnyLabels()) {
        cardMenu.addItem((item) => {
            item.setTitle('Remove All Labels');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.updateObsidianTaskAttribute('labels', []);
            })
        })
    }

    if (taskSyncManager.obsidianTask.hasProject()) {
        cardMenu.addItem((item) => {
            item.setTitle('Remove Project');
            item.setIcon('trash');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.updateObsidianTaskAttribute('project', null);
            })
        })
    } else {
        cardMenu.addItem((item) => {
            item.setTitle('Add Project');
            item.setIcon('plus');
            item.onClick((evt: MouseEvent | KeyboardEvent) => {
                taskSyncManager.setTaskCardStatus('projectStatus', 'selecting');
            })
        })
    }

    cardMenu.showAtPosition({ x: event.clientX, y: event.clientY });
    logger.debug(`showCardMenu at ${event.clientX}, ${event.clientY}`);
}