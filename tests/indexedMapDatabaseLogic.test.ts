import {
  IndexedMapDatabase,
  LogicalExpression,
  QueryFunction
} from '../src/query/indexMapDatabase';

interface Person {
  name: string;
  age: number;
  group: string;
}

/**
 * Small subclass to observe the protected `indices` / `data` members so the
 * tests can assert on index contents directly (no src changes).
 */
class InspectableDatabase<T> extends IndexedMapDatabase<T> {
  getIndexEntries(fieldName: string): Map<any, Set<string>> {
    return this.indices[fieldName];
  }

  getById(id: string): T | undefined {
    return this.data.get(id);
  }
}

const alice: Person = { name: 'Alice', age: 25, group: 'x' };
const bob: Person = { name: 'Bob', age: 30, group: 'x' };
const carol: Person = { name: 'Carol', age: 35, group: 'y' };

function seed(db: IndexedMapDatabase<Person>): void {
  db.bulkStore([
    { id: '1', item: alice },
    { id: '2', item: bob },
    { id: '3', item: carol }
  ]);
}

const names = (result: Person[]) => result.map((p) => p.name).sort();

describe('IndexedMapDatabase.queryByComplexLogic', () => {
  let db: IndexedMapDatabase<Person>;

  beforeEach(() => {
    db = new IndexedMapDatabase<Person>();
    seed(db);
  });

  it('plain OR returns the union of operand matches and nothing else', () => {
    const young: QueryFunction<Person> = (p) => p.age < 26; // Alice
    const old: QueryFunction<Person> = (p) => p.age > 34; // Carol
    const expression: LogicalExpression<Person> = {
      operator: 'OR',
      operands: [young, old]
    };

    const result = db.queryByComplexLogic(expression);
    // Bob (age 30) matches neither operand and must NOT be returned.
    expect(names(result)).toEqual(['Alice', 'Carol']);
  });

  it('OR with a single operand returns exactly the matches of that operand', () => {
    const result = db.queryByComplexLogic({
      operator: 'OR',
      operands: [(p) => p.group === 'x']
    });
    expect(names(result)).toEqual(['Alice', 'Bob']);
  });

  it('OR where no operand matches anything returns an empty array', () => {
    const result = db.queryByComplexLogic({
      operator: 'OR',
      operands: [(p) => p.age > 100, (p) => p.name === 'Nobody']
    });
    expect(result).toEqual([]);
  });

  it('NOT alone returns the complement of its first operand', () => {
    const result = db.queryByComplexLogic({
      operator: 'NOT',
      operands: [(p) => p.group === 'x'] // Alice, Bob
    });
    expect(names(result)).toEqual(['Carol']);
  });

  it('NOT of an all-matching operand returns nothing', () => {
    const result = db.queryByComplexLogic({
      operator: 'NOT',
      operands: [() => true]
    });
    expect(result).toEqual([]);
  });

  it('NOT ignores extra operands beyond the first', () => {
    const result = db.queryByComplexLogic({
      operator: 'NOT',
      operands: [(p) => p.name === 'Alice', () => true]
    });
    // Only the first operand (name === Alice) is negated.
    expect(names(result)).toEqual(['Bob', 'Carol']);
  });

  it('supports nested AND(OR(...), NOT(...))', () => {
    const expression: LogicalExpression<Person> = {
      operator: 'AND',
      operands: [
        {
          operator: 'OR',
          operands: [(p) => p.age < 26, (p) => p.age > 29] // Alice, Bob, Carol
        },
        {
          operator: 'NOT',
          operands: [(p) => p.group === 'x'] // complement -> Carol
        }
      ]
    };

    const result = db.queryByComplexLogic(expression);
    expect(names(result)).toEqual(['Carol']);
  });

  it('OR of two NOTs equals the complement of the intersection (De Morgan)', () => {
    // NOT(age < 31) = {Carol}; NOT(group === 'x') = {Carol}
    // union = {Carol}
    const result = db.queryByComplexLogic({
      operator: 'OR',
      operands: [
        { operator: 'NOT', operands: [(p) => p.age < 31] },
        { operator: 'NOT', operands: [(p) => p.group === 'x'] }
      ]
    });
    expect(names(result)).toEqual(['Carol']);

    // NOT(name==='Alice') = {Bob, Carol}; NOT(name==='Bob') = {Alice, Carol}
    // union = everyone (complement of Alice AND Bob, which is empty)
    const everyone = db.queryByComplexLogic({
      operator: 'OR',
      operands: [
        { operator: 'NOT', operands: [(p) => p.name === 'Alice'] },
        { operator: 'NOT', operands: [(p) => p.name === 'Bob'] }
      ]
    });
    expect(names(everyone)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('AND with empty operands returns all items (intersection identity)', () => {
    const result = db.queryByComplexLogic({ operator: 'AND', operands: [] });
    expect(names(result)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('OR with empty operands returns no items (union identity)', () => {
    const result = db.queryByComplexLogic({ operator: 'OR', operands: [] });
    expect(result).toEqual([]);
  });

  it('NOT with empty operands returns all items (complement of the empty set)', () => {
    const result = db.queryByComplexLogic({ operator: 'NOT', operands: [] });
    expect(result).toHaveLength(db.getLength());
  });

  it('AND over an operand matching nothing returns an empty array', () => {
    const result = db.queryByComplexLogic({
      operator: 'AND',
      operands: [() => true, (p) => p.age > 100]
    });
    expect(result).toEqual([]);
  });

  it('any expression on an empty database returns an empty array', () => {
    const empty = new IndexedMapDatabase<Person>();
    expect(
      empty.queryByComplexLogic({ operator: 'AND', operands: [] })
    ).toEqual([]);
    expect(
      empty.queryByComplexLogic({ operator: 'OR', operands: [() => true] })
    ).toEqual([]);
    expect(
      empty.queryByComplexLogic({ operator: 'NOT', operands: [() => true] })
    ).toEqual([]);
  });
});

describe('IndexedMapDatabase.refreshTasksByAttribute', () => {
  let db: InspectableDatabase<Person>;

  beforeEach(() => {
    db = new InspectableDatabase<Person>();
    db.createIndex('group', (p) => p.group);
    seed(db); // Alice(x), Bob(x), Carol(y)
  });

  const all = () =>
    db.queryByComplexLogic({ operator: 'AND', operands: [] });

  it('replaces all tasks holding the given attribute value', () => {
    const dave: Person = { name: 'Dave', age: 40, group: 'x' };
    db.refreshTasksByAttribute('group', 'x', [{ id: '4', item: dave }]);

    // Alice and Bob (group x) are gone, Dave took their place.
    expect(names(all())).toEqual(['Carol', 'Dave']);
    expect(db.getById('1')).toBeUndefined();
    expect(db.getById('2')).toBeUndefined();
    expect(db.getById('4')).toBe(dave);
  });

  it('keeps tasks with OTHER attribute values untouched', () => {
    db.refreshTasksByAttribute('group', 'x', []);
    expect(names(all())).toEqual(['Carol']);
    expect(db.getById('3')).toBe(carol);
    // the 'y' index bucket still points at Carol
    expect(db.getIndexEntries('group').get('y')).toEqual(new Set(['3']));
  });

  it('handles an attribute value with zero prior tasks (pure insert)', () => {
    const zoe: Person = { name: 'Zoe', age: 22, group: 'z' };
    db.refreshTasksByAttribute('group', 'z', [{ id: '5', item: zoe }]);

    // nothing deleted, one added
    expect(names(all())).toEqual(['Alice', 'Bob', 'Carol', 'Zoe']);
    expect(db.getLength()).toBe(4);
    expect(db.getIndexEntries('group').get('z')).toEqual(new Set(['5']));
  });

  it('re-indexes the new tasks under their attribute value', () => {
    const dave: Person = { name: 'Dave', age: 40, group: 'x' };
    db.refreshTasksByAttribute('group', 'x', [{ id: '4', item: dave }]);
    expect(db.getIndexEntries('group').get('x')).toEqual(new Set(['4']));
  });

  it('removes deleted ids from OTHER indices too (no ghost entries)', () => {
    db.createIndex('name', (p) => p.name);
    db.refreshTasksByAttribute('group', 'x', []);

    // Alice and Bob were deleted from `data`...
    expect(db.getById('1')).toBeUndefined();
    // ...and the 'name' index no longer lists them either.
    expect(db.getIndexEntries('name').get('Alice')).toBeUndefined();
    expect(db.getIndexEntries('name').get('Bob')).toBeUndefined();
    expect(db.getAllIndexValues('name')).toEqual(['Carol']);
  });

  it('tolerates refreshing by an attribute that has no index (pure insert)', () => {
    const zoe: Person = { name: 'Zoe', age: 22, group: 'z' };
    db.refreshTasksByAttribute('nonexistent', 'whatever', [
      { id: '5', item: zoe }
    ]);
    expect(names(all())).toEqual(['Alice', 'Bob', 'Carol', 'Zoe']);
  });
});

describe('IndexedMapDatabase.updateDatabase', () => {
  it('drops all old items and rebuilds indices from the new ones', () => {
    const db = new InspectableDatabase<Person>();
    db.createIndex('group', (p) => p.group);
    seed(db);
    expect(db.getAllIndexValues('group')!.sort()).toEqual(['x', 'y']);

    const dave: Person = { name: 'Dave', age: 40, group: 'z' };
    const erin: Person = { name: 'Erin', age: 41, group: 'z' };
    db.updateDatabase([
      { id: '10', item: dave },
      { id: '11', item: erin }
    ]);

    // old items are gone
    expect(db.getLength()).toBe(2);
    expect(db.getById('1')).toBeUndefined();
    const result = db.queryByComplexLogic({ operator: 'AND', operands: [] });
    expect(names(result)).toEqual(['Dave', 'Erin']);

    // indices were rebuilt: old values are gone, only new values remain
    expect(db.getAllIndexValues('group')).toEqual(['z']);
    expect(db.getIndexEntries('group').get('z')).toEqual(new Set(['10', '11']));
  });

  it('updateDatabase with an empty list empties data and indices', () => {
    const db = new InspectableDatabase<Person>();
    db.createIndex('group', (p) => p.group);
    seed(db);

    db.updateDatabase([]);
    expect(db.getLength()).toBe(0);
    expect(db.getAllIndexValues('group')).toEqual([]);
    expect(
      db.queryByComplexLogic({ operator: 'AND', operands: [] })
    ).toEqual([]);
  });
});

describe('IndexedMapDatabase.createIndex / updateIndices', () => {
  it('createIndex after data is stored indexes existing items via the extractor', () => {
    const db = new InspectableDatabase<Person>();
    seed(db);

    db.createIndex('group', (p) => p.group);
    expect(db.getAllIndexValues('group')!.sort()).toEqual(['x', 'y']);
    expect(db.getIndexEntries('group').get('x')).toEqual(new Set(['1', '2']));
    expect(db.getIndexEntries('group').get('y')).toEqual(new Set(['3']));
  });

  it('createIndex with a derived extractor works for pre-existing data', () => {
    const db = new InspectableDatabase<Person>();
    seed(db);

    db.createIndex('nameUpper', (p) => p.name.toUpperCase());
    expect(db.getAllIndexValues('nameUpper')!.sort()).toEqual([
      'ALICE',
      'BOB',
      'CAROL'
    ]);
  });

  it('store() after createIndex uses the registered (derived) extractor', () => {
    const db = new InspectableDatabase<Person>();
    db.createIndex('nameUpper', (p) => p.name.toUpperCase());

    db.store('4', { name: 'Dave', age: 40, group: 'z' });

    const index = db.getIndexEntries('nameUpper');
    expect(index.get('DAVE')).toEqual(new Set(['4']));
    expect(db.getAllIndexValues('nameUpper')).toEqual(['DAVE']);
  });

  it('store() of an existing id with a changed indexed value removes the stale entry', () => {
    const db = new InspectableDatabase<Person>();
    db.createIndex('group', (p) => p.group);
    db.store('1', { name: 'Alice', age: 25, group: 'x' });

    db.store('1', { name: 'Alice', age: 25, group: 'y' });

    const index = db.getIndexEntries('group');
    expect(index.get('y')).toEqual(new Set(['1'])); // new entry
    expect(index.get('x')).toBeUndefined(); // stale bucket cleaned up
    expect(db.getAllIndexValues('group')).toEqual(['y']);

    // Consequence: refreshing by the OLD value must not delete the item.
    db.refreshTasksByAttribute('group', 'x', []);
    expect(db.getById('1')).toBeDefined();

    // Refreshing by the CURRENT value does replace it.
    db.refreshTasksByAttribute('group', 'y', []);
    expect(db.getById('1')).toBeUndefined();
  });

  it('getAllIndexValues returns null for an index that was never created', () => {
    const db = new IndexedMapDatabase<Person>();
    expect(db.getAllIndexValues('missing')).toBeNull();
  });

  it('getLength reflects stores and clears', () => {
    const db = new IndexedMapDatabase<Person>();
    expect(db.getLength()).toBe(0);
    seed(db);
    expect(db.getLength()).toBe(3);
    db.clearAllTasks();
    expect(db.getLength()).toBe(0);
  });
});
