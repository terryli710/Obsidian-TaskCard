import { App, TAbstractFile, TFile } from 'obsidian';
import TaskCardPlugin from '..';
import { logger } from '../utils/log';

export class FileOperator {
  app: App;
  plugin: TaskCardPlugin;

  constructor(plugin: TaskCardPlugin, app: App) {
    this.plugin = plugin;
    this.app = app;
  }

  async getFileContent(filePath: string): Promise<string | null> {
    const file: TAbstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return null;
    const content = await this.app.vault.read(file as TFile);
    return content;
  }

  async getFileLines(filePath: string): Promise<string[] | null> {
    const content = await this.getFileContent(filePath);
    if (content == null) return null; // '' is a valid (empty) file
    return content.split('\n');
  }
  
  async getLineFromFile(filePath: string, lineNumber: number): Promise<string | null> {
    const fileLines = await this.getFileLines(filePath);
    if (!fileLines || lineNumber < 1 || fileLines.length < lineNumber) return null;
    return fileLines[lineNumber - 1];
  }

  async getMarkdownBetweenLines(
    filePath: string,
    lineStart: number,
    lineEnd: number
  ): Promise<string | null> {
    const fileLines = await this.getFileLines(filePath);
    if (!fileLines) return null;
    return fileLines.slice(lineStart, lineEnd).join('\n');
  }

  // Display-only reads are served from Obsidian's cache (which falls back to
  // a disk read when stale). The render path must stay off disk I/O: a disk
  // read yields to the event loop long enough for the browser to paint the
  // raw section HTML, which is the visible "blink" when a card re-renders
  // after its own write-back. Write paths keep vault.read for freshness.
  async getFileContentForDisplay(filePath: string): Promise<string | null> {
    const file: TAbstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return null;
    return await this.app.vault.cachedRead(file as TFile);
  }

  async getMarkdownBetweenLinesForDisplay(
    filePath: string,
    lineStart: number,
    lineEnd: number
  ): Promise<string | null> {
    const content = await this.getFileContentForDisplay(filePath);
    if (content == null) return null;
    return content.split('\n').slice(lineStart, lineEnd).join('\n');
  }

  async updateFile(
    filePath: string,
    newContent: string,
    lineStart: number,
    lineEnd: number
  ): Promise<void> {
    const file = await this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    const fileLines = await this.getFileLines(filePath);
    if (fileLines == null) return;
    const newFileLines: string[] = [...fileLines];
    newFileLines.splice(lineStart, lineEnd - lineStart, newContent);
    await this.app.vault.modify(file as TFile, newFileLines.join('\n'));
  }

  async updateLineInFile(filePath: string, lineNumber: number, newContent: string): Promise<void> {
    const file = await this.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;
    const fileLines = await this.getFileLines(filePath);
    const newFileLines: string[] = [...fileLines];
    newFileLines[lineNumber - 1] = newContent;
    await this.app.vault.modify(file as TFile, newFileLines.join('\n'));
  }

  getAllFilesAndFolders(): string[] {
    const mdFiles = this.app.vault.getMarkdownFiles();
    const mdPaths = mdFiles.map((file) => file.path);

    // Initialize a Set to store the unique relative paths
    let relativePaths: Set<string> = new Set();
    // Loop through each Markdown file to get its path relative to the root
    mdPaths.forEach((relativePath) => {
      relativePaths.add(relativePath);
      
      // Add folders in between
      let folderPath = '';
      const pathParts = relativePath.split('/');
      for (let i = 0; i < pathParts.length - 1; i++) {
        folderPath += pathParts[i] + '/';
        relativePaths.add(folderPath);
      }
    });
    
    // Convert the Set back to an array of strings
    return Array.from(relativePaths);
  }

  getVaultRoot(): string {
    return this.app.vault.getRoot().path;
  }

}
