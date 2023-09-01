


export type QueryFunction<T> = (item: T) => boolean;
export type IndexExtractor<T> = (item: T) => any;
export type IndexQueryFunction<T> = (value: T) => boolean;

export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type LogicalExpression<T> = {
  operator: LogicalOperator;
  operands: Array<LogicalExpression<T> | IndexQueryFunction<T>>;
};

export class IndexedMapDatabase<T> {
  private data: Map<string, T> = new Map();
  private indices: { [key: string]: Map<any, Set<string>> } = {};

  createIndex(fieldName: string, extractor: IndexExtractor<T>): void {
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


  bulkStore(items: Array<{ id: string, item: T }>): void {
    // Add items to the main data map
    items.forEach(({ id, item }) => {
      this.data.set(id, item);
    });

    // Update indices for all items
    items.forEach(({ id, item }) => {
      this.updateIndices(id, item);
    });
  }
  

  store(id: string, item: T): void {
    this.data.set(id, item);
    this.updateIndices(id, item);
  }

  private updateIndices(id: string, item: T): void {
    for (const [fieldName, index] of Object.entries(this.indices)) {
      const extractor = (item: T) => item[fieldName];
      const value = extractor(item);
      if (!index.has(value)) {
        index.set(value, new Set());
      }
      index.get(value)?.add(id);
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
      let resultIds: Set<string> = new Set();

      if (operator === 'NOT') {
        const ids = evaluateExpression(operands[0]);
        this.data.forEach((_, id) => {
          if (!ids.has(id)) {
            resultIds.add(id);
          }
        });
        return resultIds;
      }

      operands.forEach(operand => {
        const ids = evaluateExpression(operand);
        if (operator === 'AND') {
          if (resultIds.size === 0) {
            resultIds = new Set(ids);
          } else {
            resultIds = new Set([...resultIds].filter(id => ids.has(id)));
          }
        } else if (operator === 'OR') {
          resultIds = new Set([...resultIds, ...ids]);
        }
      });

      return resultIds;
    };

    const finalIds = evaluateExpression(expression);
    return Array.from(finalIds).map(id => this.data.get(id)!).filter(Boolean);
  }
}