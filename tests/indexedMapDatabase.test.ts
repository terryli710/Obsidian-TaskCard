
import { IndexedMapDatabase, LogicalExpression, QueryFunction } from "../src/query/indexMapDatabase";


describe('IndexedMapDatabase', () => {
  let db: IndexedMapDatabase<{ age: number; name: string }>;

  beforeEach(() => {
    db = new IndexedMapDatabase();
  });

  it('should store and query items', () => {
    db.store('1', { age: 25, name: 'Alice' });
    db.store('2', { age: 30, name: 'Bob' });

    const query: QueryFunction<{ age: number; name: string }> = item => item.age > 26;
    const expression: LogicalExpression<{ age: number; name: string }> = {
      operator: 'AND',
      operands: [query],
    };

    const result = db.queryByComplexLogic(expression);
    expect(result).toEqual([{ age: 30, name: 'Bob' }]);
  });

  it('should bulk store items', () => {
    db.bulkStore([
      { id: '1', item: { age: 25, name: 'Alice' } },
      { id: '2', item: { age: 30, name: 'Bob' } },
    ]);

    const query: QueryFunction<{ age: number; name: string }> = item => item.age > 26;
    const expression: LogicalExpression<{ age: number; name: string }> = {
      operator: 'AND',
      operands: [query],
    };

    const result = db.queryByComplexLogic(expression);
    expect(result).toEqual([{ age: 30, name: 'Bob' }]);
  });

  it('should create and query by index', () => {
    db.store('1', { age: 25, name: 'Alice' });
    db.store('2', { age: 30, name: 'Bob' });
    db.createIndex('age', item => item.age);

    const query: QueryFunction<{ age: number; name: string }> = item => item.age > 26;
    const expression: LogicalExpression<{ age: number; name: string }> = {
      operator: 'AND',
      operands: [query],
    };

    const result = db.queryByComplexLogic(expression);
    expect(result).toEqual([{ age: 30, name: 'Bob' }]);
  });

  it('should handle complex logical queries', () => {
    db.bulkStore([
      { id: '1', item: { age: 25, name: 'Alice' } },
      { id: '2', item: { age: 30, name: 'Bob' } },
      { id: '3', item: { age: 35, name: 'Charlie' } },
    ]);

    const query1: QueryFunction<{ age: number; name: string }> = item => item.age > 26;
    const query2: QueryFunction<{ age: number; name: string }> = item => item.age < 34;

    const expression: LogicalExpression<{ age: number; name: string }> = {
      operator: 'AND',
      operands: [
        query1,
        {
          operator: 'NOT',
          operands: [query2],
        },
      ],
    };

    const result = db.queryByComplexLogic(expression);
    expect(result).toEqual([{ age: 35, name: 'Charlie' }]);
  });

  it('should return empty array for no matches', () => {
    db.store('1', { age: 25, name: 'Alice' });

    const query: QueryFunction<{ age: number; name: string }> = item => item.age > 26;
    const expression: LogicalExpression<{ age: number; name: string }> = {
      operator: 'AND',
      operands: [query],
    };

    const result = db.queryByComplexLogic(expression);
    expect(result).toEqual([]);
  });
});
