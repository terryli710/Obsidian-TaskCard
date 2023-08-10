import { v4 as uuidv4 } from 'uuid';
import { HSLToRGB, RGBToHEX, stringToHSL } from '../../utils/colorConverter';

export type Project = {
    id: string;
    name: string;
    color?: string;
};

export class ProjectModule {
    private projects: Map<string, Project>;
    private nameToIdMap: Map<string, string>;

    constructor() {
        this.projects = new Map<string, Project>();
        this.nameToIdMap = new Map<string, string>();
    }

    // API to fetch the data as an array of Project objects
    getProjectsData(): Project[] {
        return [...this.projects.values()];
    }

    // Update or create multiple projects at once
    updateProjects(projectData: Project[]): void {
        // if empty, do nothing
        if (!projectData || !projectData.length) { return; }
        for (const project of projectData) {
            this.updateProject(project);
        }
    }

    // Accept update of the data using partial of the data structure
    updateProject(data: Partial<Project>): void {
        if (!data.name && !data.id) {
            return; // Empty info, don't create
        }

        let project: Project | undefined;
        if (data.id) {
            project = this.projects.get(data.id);
        } else if (data.name) {
            const id = this.nameToIdMap.get(data.name);
            if (id) {
                project = this.projects.get(id);
            }
        }

        if (project) {
            // Existing project, update
            const updatedProject = { ...project, ...data };
            this.ensureProjectData(updatedProject);
            this.projects.set(updatedProject.id, updatedProject);
        } else {
            // New project, create
            const newProject: Project = {
                id: data.id || uuidv4(),
                name: data.name!,
                color: data.color || this.assignColor(data.name!)
            };
            this.ensureProjectData(newProject);
            this.projects.set(newProject.id, newProject);
            this.nameToIdMap.set(newProject.name, newProject.id);
        }
    }

    // Ensure each project has all the necessary information
    private ensureProjectData(project: Project): void {
        if (!project.id) {
            project.id = uuidv4();
        }
        if (!project.color) {
            project.color = this.assignColor(project.name);
        }
    }

    // Look up of the data by ID
    getProjectById(id: string): Project | undefined {
        return this.projects.get(id);
    }

    // Look up of the data by Name
    getProjectByName(name: string): Project | undefined {
        const id = this.nameToIdMap.get(name);
        if (id) {
            return this.projects.get(id);
        }
        return undefined;
    }

    // Add a new project by providing the name
    addProject(name: string): Project | null {
        if (this.nameToIdMap.has(name)) {
            return null; // Project with the same name already exists
        }
        const id = uuidv4();
        const color = this.assignColor(name);
        const newProject: Project = { id, name, color };
        this.projects.set(id, newProject);
        this.nameToIdMap.set(name, id);
        return newProject;
    }

    // Delete a project by its ID
    deleteProjectById(id: string): void {
        const project = this.projects.get(id);
        if (project) {
            this.nameToIdMap.delete(project.name);
            this.projects.delete(id);
        }
    }

    deleteProjectByName(name: string): void {
        const id = this.nameToIdMap.get(name);
        if (id) {
            this.deleteProjectById(id);
        }
    }

    assignColor(name: string): string {
        return RGBToHEX(HSLToRGB(stringToHSL(name)));
    }
}
