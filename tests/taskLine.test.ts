import { parseTaskLine } from '../src/utils/taskLine';

test.each(['- [ ] ', '* [-] ', '+ [X] ', '1. [/] ', '12) [?] ', '> - [ ] ', '> > 2. [x] ', '  > + [ ] ', '\t- [ ] '])('reads the exact native prefix %s', prefix => {
  const line = `${prefix}Review #TaskCard`;
  const parsed = parseTaskLine(line)!;
  expect(parsed.prefix).toBe(prefix);
  expect(parsed.body).toBe('Review #TaskCard');
  expect(line[parsed.statusOffset]).toBe(parsed.status);
  expect(line.slice(parsed.bodyOffset)).toBe(parsed.body);
});

test.each(['- plain text', '[ ] not a list', '- [] empty', '- [ab] multi', '1. no checkbox'])('rejects non-task %s', line => {
  expect(parseTaskLine(line)).toBeNull();
});
