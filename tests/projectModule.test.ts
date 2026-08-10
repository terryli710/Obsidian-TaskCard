import { Project, ProjectModule } from '../src/taskModule/project';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

describe('ProjectModule', () => {
  let projectModule: ProjectModule;

  beforeEach(() => {
    projectModule = new ProjectModule();
  });

  describe('getProjectsData', () => {
    it('should start empty', () => {
      expect(projectModule.getProjectsData()).toEqual([]);
    });

    it('should return projects sorted by name', () => {
      projectModule.addProjectByName('Zebra');
      projectModule.addProjectByName('Alpha');
      projectModule.addProjectByName('Mango');
      const names = projectModule.getProjectsData().map((p) => p.name);
      expect(names).toEqual(['Alpha', 'Mango', 'Zebra']);
    });
  });

  describe('addProjectByName', () => {
    it('should create a project with an id and an assigned palette color', () => {
      const project = projectModule.addProjectByName('My Project');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('My Project');
      expect(project!.id).toEqual(expect.any(String));
      expect(project!.id.length).toBeGreaterThan(0);
      // first palette color is deterministic
      expect(project!.color).toBe('#f67088');
    });

    it('should assign distinct palette colors to successive projects', () => {
      const first = projectModule.addProjectByName('First');
      const second = projectModule.addProjectByName('Second');
      expect(first!.color).toBe('#f67088');
      // the palette manager strides half the palette for contrast
      expect(second!.color).toBe('#34ad99');
      expect(second!.color).not.toBe(first!.color);
    });

    it('should return null for a duplicate name and keep the original', () => {
      const first = projectModule.addProjectByName('Dup');
      const second = projectModule.addProjectByName('Dup');
      expect(second).toBeNull();
      expect(projectModule.getProjectsData()).toHaveLength(1);
      expect(projectModule.getProjectByName('Dup')).toEqual(first);
    });
  });

  describe('addProject', () => {
    it('should create a project from a name-only partial', () => {
      expect(projectModule.addProject({ name: 'Partial' })).toBe(true);
      const project = projectModule.getProjectByName('Partial');
      expect(project).toBeDefined();
      expect(project!.id).toEqual(expect.any(String));
      expect(project!.color).toMatch(HEX_COLOR_REGEX);
    });

    it('should keep a provided id and color', () => {
      expect(
        projectModule.addProject({ id: 'fixed-id', name: 'Fixed', color: '#101010' })
      ).toBe(true);
      expect(projectModule.getProjectById('fixed-id')).toEqual({
        id: 'fixed-id',
        name: 'Fixed',
        color: '#101010'
      });
    });

    it('should reject an empty partial', () => {
      expect(projectModule.addProject({})).toBe(false);
      expect(projectModule.getProjectsData()).toEqual([]);
    });

    it('should reject duplicates by id', () => {
      projectModule.addProject({ id: 'dup-id', name: 'Original' });
      expect(projectModule.addProject({ id: 'dup-id', name: 'Other' })).toBe(
        false
      );
      expect(projectModule.getProjectById('dup-id')!.name).toBe('Original');
    });

    it('should reject duplicates by name', () => {
      projectModule.addProject({ name: 'Same Name' });
      expect(projectModule.addProject({ name: 'Same Name' })).toBe(false);
      expect(projectModule.getProjectsData()).toHaveLength(1);
    });
  });

  describe('lookup', () => {
    it('getProjectById should return undefined for an unknown id', () => {
      expect(projectModule.getProjectById('nope')).toBeUndefined();
    });

    it('getProjectByName should return undefined for an unknown name', () => {
      expect(projectModule.getProjectByName('Unknown Project')).toBeUndefined();
    });

    it('should find projects by id and by name', () => {
      projectModule.addProject({ id: 'p-1', name: 'Findable' });
      expect(projectModule.getProjectById('p-1')!.name).toBe('Findable');
      expect(projectModule.getProjectByName('Findable')!.id).toBe('p-1');
    });
  });

  describe('updateProject', () => {
    it('should ignore an empty partial', () => {
      projectModule.updateProject({});
      expect(projectModule.getProjectsData()).toEqual([]);
    });

    it('should create a new project when the name is unknown', () => {
      projectModule.updateProject({ name: 'Fresh' });
      const project = projectModule.getProjectByName('Fresh');
      expect(project).toBeDefined();
      expect(project!.color).toMatch(HEX_COLOR_REGEX);
    });

    it('should update the color of an existing project found by name', () => {
      projectModule.addProject({ id: 'p-1', name: 'Recolor' });
      projectModule.updateProject({ name: 'Recolor', color: '#abcdef' });
      expect(projectModule.getProjectById('p-1')!.color).toBe('#abcdef');
      expect(projectModule.getProjectsData()).toHaveLength(1);
    });

    it('should update an existing project found by id', () => {
      projectModule.addProject({ id: 'p-2', name: 'ById', color: '#111111' });
      projectModule.updateProject({ id: 'p-2', color: '#222222' });
      expect(projectModule.getProjectById('p-2')).toEqual({
        id: 'p-2',
        name: 'ById',
        color: '#222222'
      });
    });

    it('should not create duplicates when updating the same name twice', () => {
      projectModule.updateProject({ name: 'Once' });
      projectModule.updateProject({ name: 'Once' });
      expect(projectModule.getProjectsData()).toHaveLength(1);
    });

    it('should keep the name-to-id map in sync after a rename', () => {
      projectModule.addProject({ id: 'p-1', name: 'Old Name' });
      projectModule.updateProject({ id: 'p-1', name: 'New Name' });

      expect(projectModule.getProjectById('p-1')!.name).toBe('New Name');
      expect(projectModule.getProjectByName('New Name')!.id).toBe('p-1');
      expect(projectModule.getProjectByName('Old Name')).toBeUndefined();
    });

    it('should ignore an id-only partial for an unknown id (a name is required to create)', () => {
      const before = projectModule.getProjectsData().length;
      projectModule.updateProject({ id: 'orphan-id' });
      expect(projectModule.getProjectById('orphan-id')).toBeUndefined();
      expect(projectModule.getProjectsData()).toHaveLength(before);
    });
  });

  describe('updateProjects', () => {
    it('should do nothing for an empty or missing list', () => {
      projectModule.updateProjects([]);
      projectModule.updateProjects(null as unknown as Project[]);
      expect(projectModule.getProjectsData()).toEqual([]);
    });

    it('should batch-create projects and sort them by name', () => {
      projectModule.updateProjects([
        { id: 'p-b', name: 'Bravo' },
        { id: 'p-a', name: 'Alpha' }
      ] as Project[]);
      const data = projectModule.getProjectsData();
      expect(data.map((p) => p.name)).toEqual(['Alpha', 'Bravo']);
      // colors are filled in for projects that lack one
      for (const project of data) {
        expect(project.color).toMatch(HEX_COLOR_REGEX);
      }
    });

    it('should update existing entries instead of duplicating them', () => {
      projectModule.updateProjects([{ id: 'p-1', name: 'Solo' }] as Project[]);
      projectModule.updateProjects([
        { id: 'p-1', name: 'Solo', color: '#333333' }
      ] as Project[]);
      expect(projectModule.getProjectsData()).toHaveLength(1);
      expect(projectModule.getProjectById('p-1')!.color).toBe('#333333');
    });
  });

  describe('deletion', () => {
    it('deleteProjectById should remove the project and its name lookup', () => {
      projectModule.addProject({ id: 'del-1', name: 'Delete Me' });
      projectModule.deleteProjectById('del-1');
      expect(projectModule.getProjectById('del-1')).toBeUndefined();
      expect(projectModule.getProjectByName('Delete Me')).toBeUndefined();
      expect(projectModule.getProjectsData()).toEqual([]);
    });

    it('deleteProjectById should ignore unknown ids', () => {
      projectModule.addProject({ id: 'keep', name: 'Keeper' });
      expect(() => projectModule.deleteProjectById('unknown')).not.toThrow();
      expect(projectModule.getProjectsData()).toHaveLength(1);
    });

    it('deleteProjectByName should remove the project', () => {
      projectModule.addProject({ id: 'del-2', name: 'By Name' });
      projectModule.deleteProjectByName('By Name');
      expect(projectModule.getProjectById('del-2')).toBeUndefined();
      expect(projectModule.getProjectByName('By Name')).toBeUndefined();
    });

    it('deleteProjectByName should ignore unknown names', () => {
      expect(() =>
        projectModule.deleteProjectByName('Never Existed')
      ).not.toThrow();
    });

    it('should allow re-adding a name after deletion', () => {
      projectModule.addProject({ id: 'first', name: 'Recycled' });
      projectModule.deleteProjectByName('Recycled');
      const again = projectModule.addProjectByName('Recycled');
      expect(again).not.toBeNull();
      expect(again!.id).not.toBe('first');
      expect(projectModule.getProjectByName('Recycled')!.id).toBe(again!.id);
    });
  });

  describe('assignColor', () => {
    it('should hand out hex palette colors', () => {
      const color = projectModule.assignColor('anything');
      expect(color).toMatch(HEX_COLOR_REGEX);
    });

    it('should not repeat colors while the palette lasts', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 15; i++) {
        const color = projectModule.assignColor(`name-${i}`);
        expect(seen.has(color)).toBe(false);
        seen.add(color);
      }
    });
  });
});
