import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAverage, validateBackup, weekKey, newState, validateRecord } from './core.mjs';

test('four-domain learning indicator requires all four valid percentiles; never estimates missing scores', () => {
  assert.equal(scoreAverage([90, 94, 86, 90]), 90);
  assert.equal(scoreAverage([100, 100, 100, 100]), 100);
  for (const values of [[90, '', 90, 90], [90, null, 90, 90], [101, 90, 90, 90], [90, 90, 90], [-1, 90, 90, 90], [[],[90],' ',90]]) {
    assert.equal(scoreAverage(values), null);
  }
});

test('week missions share Monday key across Sunday and change on next Monday', () => {
  assert.equal(weekKey(new Date(2026, 9, 23, 12)), '2026-10-19');
  assert.equal(weekKey(new Date(2026, 9, 25, 12)), '2026-10-19');
  assert.equal(weekKey(new Date(2026, 9, 26, 12)), '2026-10-26');
});
test('backup round trip keeps goals and history, rejects malformed data without deleting local state', () => {
  const state = newState();
  state.goal = 'snu'; state.favorites = ['snu', 'yonsei'];
  state.weeks['2026-10-19'] = ['math'];
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(state)), ['snu','yonsei']), state);
  for (const invalid of [null, {}, {...state,version:999}, {...state,goal:'fake'}, {...state,weeks:{x: ['math']}}, {...state,records:[{date:'wrong'}]}]) {
    assert.throws(() => validateBackup(invalid, ['snu','yonsei']));
  }
});
test('records distinguish an actual 5-grade school result from a four-domain mock score', () => {
  assert.throws(() => validateRecord({id:'',date:'2026-10-23',type:'school',grade:1.5,note:''}));
  assert.equal(validateRecord({id:'a',date:'2027-03-01',type:'mock',values:[90,91,92,93],english:2,note:''}).type,'mock');
  assert.throws(() => validateRecord({id:'a',date:'2027-02-30',type:'school',grade:1.5,note:''}));
  assert.throws(() => validateRecord({id:'a',date:'2027-03-01',type:'school',grade:9,note:''}));
  assert.throws(() => validateRecord({id:'a',date:'2027-03-01',type:'mock',values:[90,'',90,90],english:2,note:''}));
});
