


export type QueryFunction<T> = (item: T) => boolean;
export type IndexExtractor<T> = (item: T) => any;
export type IndexQueryFunction<T> = (value: T) => boolean;

export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type LogicalExpression<T> = {
  operator: LogicalOperator;
  operands: Array<LogicalExpression<T> | IndexQueryFunction<T>>;
};

export class IndexedMapDatabase<T> {
  protected data: Map<string, T> = new Map();
  protected indices: { [key: string]: Map<any, Set<string>> } = {};
  protected extractors: { [key: string]: IndexExtractor<T> } = {};

  createIndex(fieldName: string, extractor: IndexExtractor<T>): void {
    this.extractors[fieldName] = extractor;
    const index = new Map<any, Set<string>>();
    this.data.forEach((item, id) => {
      const value = extractor(item);
      if (!index.has(value)) {
        index.set(value, new Set());
      }
      index.get(value)?.add(id);
    });
    this.indices[fieldName] = index;
  }


  // Method to get all possible values of an index
  getAllIndexValues(fieldName: string): any[] | null {
    const index = this.indices[fieldName];
    if (!index) {
      return null; // Return null if the index does not exist
    }
    return Array.from(index.keys()); // Convert Set to Array and return
  }


  bulkStore(items: Array<{ id: string, item: T }>): void {
    items.forEach(({ id, item }) => {
      this.store(id, item);
    });
  }

  // Method to update the whole database, clear previous tasks, and update new tasks
  updateDatabase(newItems: Array<{ id: string, item: T }>): void {
    // Clear existing data and indices
    this.clearAllTasks();

    // Bulk store new items
    this.bulkStore(newItems);
  }

  // Method to clear all tasks
  clearAllTasks(): void {
    // Clear the main data map
    this.data.clear();

    // Clear all indices
    for (const index of Object.values(this.indices)) {
      index.clear();
    }
  }

  refreshTasksByAttribute(attribute: string, value: any, newTasks: Array<{ id: string, item: T }>): void {
    // Find tasks with the specific attribute and value
    const index = this.indices[attribute];
    const idsToDelete = index ? index.get(value) || new Set<string>() : new Set<string>();

    // Delete old tasks, removing them from every index so no stale ids linger
    idsToDelete.forEach(id => {
      const item = this.data.get(id);
      if (item !== undefined) {
        this.removeFromIndices(id, item);
      }
      this.data.delete(id);
    });

    // Add new tasks
    this.bulkStore(newTasks);
  }

  store(id: string, item: T): void {
    const existing = this.data.get(id);
    if (existing !== undefined) {
      this.removeFromIndices(id, existing);
    }
    this.data.set(id, item);
    this.updateIndices(id, item);
  }

  private indexExtractor(fieldName: string): IndexExtractor<T> {
    return this.extractors[fieldName] ?? ((item: T) => (item as any)[fieldName]);
  }

  private updateIndices(id: string, item: T): void {
    for (const [fieldName, index] of Object.entries(this.indices)) {
      const value = this.indexExtractor(fieldName)(item);
      if (!index.has(value)) {
        index.set(value, new Set());
      }
      index.get(value)?.add(id);
    }
  }

  private removeFromIndices(id: string, item: T): void {
    for (const [fieldName, index] of Object.entries(this.indices)) {
      const value = this.indexExtractor(fieldName)(item);
      const ids = index.get(value);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          index.delete(value);
        }
      }
    }
  }

  queryByComplexLogic(expression: LogicalExpression<T>): T[] {
    const evaluateExpression = (expr: LogicalExpression<T> | IndexQueryFunction<T>): Set<string> => {
      if (typeof expr === 'function') {
        const ids = new Set<string>();
        this.data.forEach((item, id) => {
          if (expr(item)) {
            ids.add(id);
          }
        });
        return ids;
      }
  
      const { operator, operands } = expr;

      if (operator === 'NOT') {
        // NOT of no operands = complement of the empty set = everything
        const ids = operands.length
          ? evaluateExpression(operands[0])
          : new Set<string>();
        const complementIds = new Set<string>();
        this.data.forEach((_, id) => {
          if (!ids.has(id)) {
            complementIds.add(id);
          }
        });
        return complementIds;
      }

      // AND starts from the full id set and intersects; OR starts empty and unions
      let resultIds: Set<string> =
        operator === 'AND' ? new Set(this.data.keys()) : new Set();

      operands.forEach(operand => {
        const ids = evaluateExpression(operand);
        if (operator === 'AND') {
          resultIds = new Set([...resultIds].filter(id => ids.has(id)));
        } else if (operator === 'OR') {
          resultIds = new Set([...resultIds, ...ids]);
        }
      });
  
      return resultIds;
    };
  
    const finalIds = evaluateExpression(expression);
    return Array.from(finalIds).map(id => this.data.get(id)!).filter(Boolean);
  }

  getLength(): number {
    return this.data.size;
  }
  
}