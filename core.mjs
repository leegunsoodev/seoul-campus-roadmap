// This is a personal learning indicator, never a university admission conversion score.
export function scoreAverage(values) {
  if (!Array.isArray(values) || values.length !== 4 || values.some(v => !['number','string'].includes(typeof v) || typeof v === 'string' && v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100)) return null;
  return Math.round(values.reduce((sum, v) => sum + Number(v), 0) / 4 * 10) / 10;
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return localDate(d);
}
export function newState() { return {version:1,goal:null,favorites:[],weeks:{},records:[]}; }
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
export function validateRecord(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id.trim() || r.id.length > 80 || !isDate(r.date) || typeof r.note !== 'string' || r.note.length > 300) throw new Error('기록의 날짜 또는 메모 형식을 확인해 주세요.');
  const base = {id:r.id,date:r.date,type:r.type,note:r.note};
  if (r.type === 'mock' && scoreAverage(r.values) !== null && Number.isInteger(r.english) && r.english >= 1 && r.english <= 9) return {...base,values:r.values.map(Number),english:r.english};
  if (r.type === 'school' && typeof r.grade === 'number' && Number.isFinite(r.grade) && r.grade >= 1 && r.grade <= 5) return {...base,grade:r.grade};
  throw new Error('모의고사 백분위는 0~100, 영어는 1~9등급, 고교 내신은 1~5 범위입니다.');
}
// Whitelist fields on import: no arbitrary object keys or HTML from backup files enter the UI.
export function validateBackup(input, ids) {
  if (!input || input.version !== 1 || !(input.goal === null || ids.includes(input.goal)) || !Array.isArray(input.favorites) || input.favorites.length > 15 || input.favorites.some(x=>!ids.includes(x)) || !input.weeks || typeof input.weeks !== 'object' || Array.isArray(input.weeks) || !Array.isArray(input.records) || input.records.length > 500) throw new Error('지원하지 않는 백업 파일입니다. 현재 기록은 유지됩니다.');
  const weeks = {};
  if (Object.keys(input.weeks).length > 600) throw new Error('주간 기록이 너무 많습니다.');
  for (const [key, values] of Object.entries(input.weeks)) {
    if (!isDate(key) || !Array.isArray(values) || values.some(v=>!['math','read','science','review','explore'].includes(v))) throw new Error('주간 기록 형식이 올바르지 않습니다.');
    weeks[key] = [...new Set(values)];
  }
  const records = input.records.map(validateRecord);
  if (new Set(records.map(r=>r.id)).size !== records.length) throw new Error('중복된 기록이 있습니다.');
  return {version:1,goal:input.goal,favorites:[...new Set(input.favorites)],weeks,records};
}
