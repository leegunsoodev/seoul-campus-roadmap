import {universities, bands, missions, roadmap, fields} from './data.mjs';
import {scoreAverage, localDate, weekKey, newState, validateBackup, validateRecord} from './core.mjs';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids = universities.map(u=>u.id);
const storageKey = 'campus-compass-v1';
let state = newState(), evidence = new Map(), activeField = '전체', compare = [], storageAvailable = true;
let evidenceFailed = false;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) state = validateBackup(JSON.parse(saved),ids);
} catch {
  storageAvailable = false;
  // Do not overwrite unrecognized/corrupt saved data with an empty state.
  $('#main').insertAdjacentHTML('afterbegin','<aside class="notice"><div><strong>저장된 기록을 읽지 못했어요.</strong><p>기존 데이터를 덮어쓰지 않도록 자동 저장을 멈췄습니다. 정상 백업 파일을 불러오거나 브라우저 저장 설정을 확인해 주세요. 현재 작업은 백업으로 내려받을 수 있어요.</p></div></aside>');
}
try {
  const response = await fetch('./data-evidence.json');
  if (!response.ok) throw new Error('evidence unavailable');
  const rows = await response.json();
  evidence = new Map(rows.map(e => [{ssu:'soongsil',kw:'kwangwoon'}[e.id] || e.id,e]));
} catch { evidenceFailed = true; }

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>$('#toast').classList.remove('visible'),4200);
}
function persist(message='저장했어요.') {
  try {
    if (!storageAvailable) throw new Error('storage disabled');
    localStorage.setItem(storageKey,JSON.stringify(state));
    if(message) toast(message);
  } catch { toast('기기 저장이 안 돼요. 이 화면을 닫기 전에 기록을 백업해 주세요.'); }
}
function navigate(page, updateHash = true) {
  if (!['explore','journey','roadmap','guide'].includes(page)) page='explore';
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page);
  document.querySelectorAll('.nav-button').forEach(el=>{
    el.classList.toggle('active',el.dataset.nav===page);
    if(el.dataset.nav===page) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  if(updateHash) history.replaceState(null,'',`#${page}`);
  if(page==='journey') renderJourney();
  window.scrollTo({top:0,behavior:'instant'});
}
function pastValue(e) {
  if(!e) return '자료 불러오기 실패';
  return (e.school70 ?? e.schoolAverage)?.toFixed(2) ?? '미공개';
}
const pastKind = e => e?.school70 != null ? '70%컷' : '평균';
function renderCards() {
  const query=$('#search').value.trim().toLowerCase();
  const campus=$('#campus-filter').value;
  const visible=universities.filter(u=>(activeField==='전체'||u.fields.includes(activeField)) && (campus==='all'||campus==='seoul'&&u.seoul||campus==='outside'&&!u.seoul||campus==='saved'&&state.favorites.includes(u.id)) && `${u.name} ${u.en} ${u.majors.join(' ')} ${u.fields.join(' ')}`.toLowerCase().includes(query));
  $('#result-count').textContent=visible.length;
  $('#college-grid').innerHTML=visible.map(u=>{
    const e=evidence.get(u.id);
    return `<article class="college-card" style="--college-color:${u.color}"><div class="card-top"><span class="college-monogram" aria-hidden="true">${u.name.slice(0,2)}</span><span class="card-location">${u.area}</span><button class="favorite ${state.favorites.includes(u.id)?'selected':''}" data-favorite="${u.id}" aria-label="${u.name} 관심 대학" aria-pressed="${state.favorites.includes(u.id)}">${state.favorites.includes(u.id)?'★':'☆'}</button></div><h3>${u.name}</h3><div class="college-en">${u.en}</div><p class="card-desc">${u.description}</p>${!u.seoul?`<p class="campus-warning">↗ ${u.campus}</p>`:''}<div class="tags">${u.fields.slice(0,3).map(f=>`<span class="tag">${f}</span>`).join('')}</div><div class="past-box"><div class="past-label">2025 실제 사례 · 과거 9등급 내신</div><div class="past-value"><b>${pastValue(e)}</b><span>${e?'등급 · '+pastKind(e):''}</span></div><p>${e?`${esc(e.department)} · ${esc(e.route)}`:'공식 입학처에서 원문을 확인하세요.'}</p></div><div class="card-bottom"><label class="compare-label"><input type="checkbox" data-compare="${u.id}" ${compare.includes(u.id)?'checked':''}>비교에 담기</label><button class="text-button" data-detail="${u.id}">목표·성적 자세히 ↗</button></div></article>`;
  }).join('')||'<div class="empty"><h3>조건에 맞는 대학이 없어요.</h3><p>다른 분야를 선택하거나 검색어를 지워보세요.</p><button class="button" id="reset-filters">필터 초기화</button></div>';
  renderCompareBar();
}
function renderCompareBar() {
  $('#compare-bar').hidden=compare.length===0;
  $('#compare-label').textContent=`${compare.length}/3개 선택 · ${compare.map(id=>universities.find(u=>u.id===id).name.replace('대학교','대')).join(', ')}`;
}
function csatMarkup(e) {
  if(!e) return '<p>자료를 불러오지 못했습니다. 대학 입학처에서 직접 확인해 주세요.</p>';
  const c=e.csat;
  let result=`<p><b>${e.year}학년도 ${esc(c.route)} · ${esc(c.department)}</b></p>`;
  if(c.average70 != null) result+=`<div class="stat-tile"><small>원문 제공 70%컷 평균(백분위) 지표</small><strong>${c.average70}</strong><p>대학 전체 평균이 아닙니다. 아래 환산점수와 단위가 다릅니다.</p></div>`;
  if(c.korean!=null) {
    const isKorea=e.id==='korea';
    const hongik=e.id==='hongik';
    result+=`<div class="score-table-wrap"><table><caption>${isKorea?'원문 과목별 70%컷 지표':'환산점수 70% 위치의 과목별 공개 성적'} · 국·수·탐은 백분위, 영어는 등급</caption><thead><tr><th>국어</th><th>수학</th><th>탐구 1</th><th>탐구 2</th><th>영어 등급</th></tr></thead><tbody><tr><td>${c.korean??'미공개'}</td><td>${c.math??'미공개'}</td><td>${hongik?'표시 보류':c.inquiry1??'미공개'}</td><td>${hongik?'표시 보류':c.inquiry2??'미공개'}</td><td>${c.english??'미공개'}</td></tr></tbody></table></div><p class="subtle">${isKorea?'과목별 컷은 동일한 한 학생의 점수 조합이라는 뜻이 아닙니다.':'한 위치의 사례이며 학과 전체의 과목 평균이나 모든 합격자의 최저 기준이 아닙니다.'} ${hongik?'탐구 집계 의미가 불명확해 표시는 보류했습니다. ':''}당시 선택 탐구 체제이며 2030 통합사회·통합과학 점수로 옮겨 읽지 않아요.</p>`;
  } else if(c.average70==null) result+='<p>이 원문에서 백분위 값은 확인하지 못했습니다. 환산점수를 백분위로 바꿔 표시하지 않아요.</p>';
  result+=`<p>대학 자체 환산점수 70%컷: <b>${c.converted}</b><br><span class="subtle">대학별 총점·반영 방식이 다릅니다. 다른 대학 환산점수와 크기를 비교하지 마세요.</span></p>`;
  return result;
}
function openDetail(id) {
  const u=universities.find(x=>x.id===id); if(!u)return;
  const b=bands[u.band], e=evidence.get(id);
  $('#detail-content').innerHTML=`<div class="dialog-title"><span class="eyebrow">DISCOVER YOUR POSSIBILITY</span><h2 id="detail-title">${u.name}</h2><div class="college-en">${u.en}</div><p>${u.campus}</p></div><div class="tags">${u.majors.map(m=>`<span class="tag">${m}</span>`).join('')}</div><p>${u.description}</p><div class="parent-tip">${u.tip}</div><section class="dialog-block"><span class="eyebrow">01 · OFFICIAL PAST RESULT</span><h3>실제로 공개된 과거 성적은?</h3><p>2025학년도 대표 학과 한 곳의 사례입니다. 이공계 전체 평균이 아니며, 인기 학과 사례라 학과 전체를 대표하지 않을 수 있어요.</p><div class="stat-tile"><small>수시 · ${e?esc(e.route):'원문 확인 필요'}</small><strong>${pastValue(e)} ${e?'등급':''}</strong><p>${e?`${esc(e.department)} · 최종등록자 ${pastKind(e)} · 당시 9등급제`:''}</p></div><p class="subtle">이 숫자를 2030의 5등급 합격선으로 환산할 수 없습니다. 학종은 성적 외 서류를 함께 평가합니다.</p>${csatMarkup(e)}${e?`<ul class="check-list">${e.notes.slice(2).map(n=>`<li>${esc(n)}</li>`).join('')}</ul><a class="source-link" href="${e.url}" target="_blank" rel="noopener">대입정보포털 어디가 · 2025 결과 원문 ↗</a>`:''}</section><section class="dialog-block"><span class="eyebrow">02 · MY LEARNING DIRECTION</span><h3>그럼 지금은 무엇을 목표로 할까?</h3><div class="notice"><div><strong>아래는 편집자가 제안하는 연습 목표예요.</strong><p>대학이 발표한 기준이나 합격 예측이 아닙니다. 과거 입결에서 계산한 값도 아니에요. 현재 실력에 맞춰 한 단계씩 접근하세요.</p></div></div><div class="detail-stats"><div class="stat-tile"><small>2030 준비 · 고교 내신 5등급제</small><h3 style="margin-top:12px">${b.school}</h3><p>${b.schoolDetail}</p></div><div class="stat-tile"><small>개인 모의고사 연습 목표 범위</small><strong>${b.range[0]}–${b.range[1]}</strong><p>국어·수학·통합사회·통합과학 백분위 단순 평균<br>영어: ${b.english}</p></div></div><p><b>이번 학기 집중할 것</b><br>${b.focus}. 모의고사 평균과 내신을 서로 바꾸어 계산하지 않아요.</p></section><section class="dialog-block"><span class="eyebrow">03 · CHECK BEFORE APPLYING</span><h3>지원할 때 반드시 다시 확인해요</h3><ul class="check-list"><li>2030학년도 최종 모집요강의 모집단위·캠퍼스·지원 자격</li><li>수시: 반영 교과·과목 선택·추천·수능최저·면접</li><li>정시: 대학별 수능 반영식·영어 감점·학생부 반영 여부</li><li>계약학과·의약학계열·특별전형의 별도 조건</li></ul></section><div class="detail-actions"><button class="button primary" data-goal="${id}">${state.goal===id?'내 목표 대학 ✓':'나의 목표로 정하기 ↗'}</button><a class="button" href="${u.url}" target="_blank" rel="noopener">공식 입학처 ↗</a></div>`;
  if(!$('#detail-dialog').open)$('#detail-dialog').showModal();
  $('#detail-dialog').scrollTop=0;
}
function openCompare() {
  if(!compare.length)return;
  $('#compare-content').innerHTML=`<div class="compare-grid" style="--columns:${compare.length}">${compare.map(id=>{
    const u=universities.find(u=>u.id===id),e=evidence.get(id),b=bands[u.band];
    return `<article class="compare-col"><h3>${u.name}</h3><p>${u.campus}</p><div class="tags">${u.majors.slice(0,3).map(m=>`<span class="tag">${m}</span>`).join('')}</div><hr><p><b>2025 수시 사례 · 과거 9등급</b><br>${e?esc(e.department):''}<br>${e?esc(e.route):''}</p><div class="past-value"><b>${pastValue(e)}</b><span>등급 · ${pastKind(e)}</span></div>${csatMarkup(e)}<hr><p><b>새 5등급제 학습 방향 (제안)</b><br>${b.school}</p><p><b>연습용 백분위 목표 (제안)</b><br>${b.range.join('–')} · 국수통사통과 단순 평균</p><p class="subtle">합격선·예측값이 아닙니다.</p><button class="button full" data-goal="${id}">내 목표로 선택</button>${e?`<a class="source-link" href="${e.url}" target="_blank" rel="noopener">과거 결과 원문 ↗</a>`:''}</article>`;
  }).join('')}</div>`;
  $('#compare-dialog').showModal();
}
function renderJourney() {
  const u=universities.find(u=>u.id===state.goal);
  $('#goal-panel').innerHTML=u?`<section class="goal-card"><div><span class="eyebrow">MY NORTH STAR · 나의 방향</span><h2>${u.name}</h2><p>${u.campus}</p><div class="goal-details"><span>내신 방향: ${bands[u.band].school}</span><span>연습용 평균 백분위: ${bands[u.band].range.join('–')}</span></div><p>편집 학습 목표 · 합격선 아님 · 목표는 언제든 바꿔도 괜찮아요.</p></div><button class="button" data-detail="${u.id}">목표 자세히 ↗</button></section>`:`<section class="goal-card"><div><span class="eyebrow">MY NORTH STAR</span><h2>가보고 싶은 캠퍼스가 생겼나요?</h2><p>대학 상세 화면에서 ‘나의 목표로 정하기’를 눌러보세요.<br>아직 없어도 괜찮아요. 아래 작은 약속부터 시작해요.</p></div><button class="button" data-nav="explore">대학 둘러보기 ↗</button></section>`;
  const key=weekKey(), checked=state.weeks[key]||[];
  $('#week-label').textContent=`${key.slice(5).replace('-','.')} 시작 주`;
  $('#mission-progress').style.width=`${checked.length/5*100}%`;
  $('#mission-summary').textContent=`${checked.length}/5개 완료 · ${checked.length===5?'이번 주 약속을 모두 지켰어요!':checked.length?'이미 시작했다는 게 중요해. 한 걸음 더!':'첫 체크가 이번 주의 출발점이에요.'}`;
  $('#missions').innerHTML=missions.map(m=>`<label class="mission"><span class="mission-icon" aria-hidden="true">${m.icon}</span><span class="mission-text"><strong>${m.title}</strong><p>${m.desc}</p><small>${m.minutes}</small></span><input type="checkbox" data-mission="${m.id}" ${checked.includes(m.id)?'checked':''} aria-label="${m.title} 완료"></label>`).join('');
  const total=Object.values(state.weeks).reduce((sum,arr)=>sum+arr.length,0), fullWeeks=Object.values(state.weeks).filter(arr=>arr.length===5).length;
  $('#badges').innerHTML=[[total>=1,'✦ 첫 한 걸음'],[fullWeeks>=1,'✦ 한 주 완주'],[total>=20,'✦ 20개의 약속']].map(([done,label])=>`<span class="badge ${done?'earned':''}">${label}${done?' ✓':''}</span>`).join('')+`<span class="badge">누적 ${total}개 · 완주 ${fullWeeks}주</span>`;
  renderHistory();
}
function renderHistory() {
  const ordered=[...state.records].sort((a,b)=>a.date.localeCompare(b.date));
  const mocks=ordered.filter(r=>r.type==='mock').slice(-6);
  const schools=ordered.filter(r=>r.type==='school');
  let intro='';
  if(mocks.length>=2) {
    const diff=Math.round((scoreAverage(mocks.at(-1).values)-scoreAverage(mocks.at(-2).values))*10)/10;
    intro=`<p><b>최근 모의고사 변화: ${diff>0?'+':''}${diff.toFixed(1)}점</b> (네 영역 단순 평균 백분위)<br>시험마다 응시집단과 난도가 달라 추세를 살피는 참고용이에요. 한 번의 하락이 가능성을 정하지 않아요.</p>`;
  }
  if(schools.length>=2)intro+=`<p>최근 내신: ${schools.at(-2).grade.toFixed(2)} → <b>${schools.at(-1).grade.toFixed(2)}</b>등급 · 낮은 숫자일수록 높은 등급이에요. 같은 산출 기준으로 기록했을 때만 비교해요.</p>`;
  const chart=mocks.length?`<p class="subtle">최근 모의고사 학습지표 · 세로축 0~100 · 최신 6개 기록</p><div class="history-chart" role="img" aria-label="${esc(mocks.map(r=>`${r.date} 평균 백분위 ${scoreAverage(r.values)}`).join(', '))}">${mocks.map(r=>`<div class="chart-column"><b>${scoreAverage(r.values)}</b><div class="bar" style="height:${scoreAverage(r.values)}%"></div><small>${r.date.slice(2).replaceAll('-','.')}</small></div>`).join('')}</div>`:'';
  $('#history').innerHTML=state.records.length?intro+chart+`<div class="history-list">${ordered.reverse().map(r=>`<article class="record"><div><strong>${r.date} · ${r.type==='mock'?`모의고사 평균 백분위 ${scoreAverage(r.values)}`:`고교 내신 ${r.grade.toFixed(2)}등급 (5등급제)`}</strong>${r.type==='mock'?`<p>국어 ${r.values[0]} · 수학 ${r.values[1]} · 통합사회 ${r.values[2]} · 통합과학 ${r.values[3]} · 영어 ${r.english}등급</p>`:''}${r.note?`<p>${esc(r.note)}</p>`:''}</div><button class="delete" data-delete="${esc(r.id)}" aria-label="${r.date} 기록 삭제">삭제</button></article>`).join('')}</div>`:'<div class="empty"><h3>아직 기록이 없어도 괜찮아요.</h3><p>첫 기록은 평가가 아니라 출발점이에요.<br>실제 성적이 생기면 날짜와 함께 남겨보세요.</p></div>';
}
function renderRoadmap() {
  $('#roadmap-content').innerHTML=roadmap.map(r=>`<article class="timeline-item"><div class="timeline-year">${r.year}<span>${r.stage}</span></div><div class="panel"><h2>${r.title}</h2><ul class="check-list">${r.items.map(i=>`<li>${i}</li>`).join('')}</ul><div class="parent-tip"><b>부모님께</b> ${r.parent}</div></div></article>`).join('');
  $('#field-guide').innerHTML=Object.entries(fields).map(([name,f])=>`<article><h3>${name}</h3><p>${f.question}</p><p><b>연결되는 공부</b><br>${f.subjects}</p><p><b>작게 해볼 경험</b><br>${f.project}</p></article>`).join('');
}

document.addEventListener('click',event=>{
  const target=event.target.closest('button, a[data-nav]');
  if(!target)return;
  if(target.dataset.nav)navigate(target.dataset.nav);
  if(target.dataset.detail)openDetail(target.dataset.detail);
  if(target.dataset.favorite){const id=target.dataset.favorite;state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];persist('관심 대학을 업데이트했어요.');renderCards();}
  if(target.dataset.goal){state.goal=target.dataset.goal;persist('나의 목표를 정했어요. 오늘의 작은 약속부터 시작해요!');navigate('journey');}
  if(target.classList.contains('dialog-close'))target.closest('dialog').close();
  if(target.id==='reset-filters'){$('#search').value='';$('#campus-filter').value='all';activeField='전체';renderChips();renderCards();}
  if(target.dataset.field){activeField=target.dataset.field;renderChips();renderCards();}
  if(target.id==='compare-open')openCompare();
  if(target.id==='compare-clear'){compare=[];renderCards();}
  if(target.dataset.delete && confirm('이 성적 기록을 삭제할까요? 필요한 기록은 먼저 백업해 주세요.')){state.records=state.records.filter(r=>r.id!==target.dataset.delete);persist('기록을 삭제했어요.');renderHistory();}
});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.dataset.compare){
    const id=target.dataset.compare;
    if(target.checked){if(compare.length>=3){target.checked=false;toast('최대 3개 대학까지 비교할 수 있어요.');return;}compare.push(id);}else compare=compare.filter(x=>x!==id);
    renderCompareBar();
  }
  if(target.dataset.mission){const key=weekKey(), current=state.weeks[key]||[];state.weeks[key]=target.checked?[...new Set([...current,target.dataset.mission])]:current.filter(x=>x!==target.dataset.mission);const missionId=target.dataset.mission;persist(target.checked?'약속 하나를 지켰어요. 잘했어!':'체크를 해제했어요.');renderJourney();document.querySelector('[data-mission='+missionId+']').focus({preventScroll:true});}
});
function renderChips(){$('#field-filters').innerHTML=['전체',...Object.keys(fields)].map(f=>`<button class="chip ${activeField===f?'active':''}" data-field="${f}" aria-pressed="${activeField===f}">${f}</button>`).join('');}
$('#search').addEventListener('input',renderCards);
$('#campus-filter').addEventListener('change',renderCards);
$('#score-date').value=localDate();
$('#score-date').max=localDate();
$('#score-type').addEventListener('change',()=>{
  const school=$('#score-type').value==='school';
  $('#mock-fields').hidden=school;$('#school-fields').hidden=!school;
  $('#mock-fields').querySelectorAll('input').forEach(el=>{el.disabled=school;el.required=!school;});
  $('#score-grade').disabled=!school;$('#score-grade').required=school;
});
$('#score-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    if(state.records.length>=500)throw new Error('최대 500개까지 기록할 수 있어요. 백업 후 오래된 기록을 정리해 주세요.');
    const base={id:crypto.randomUUID(),date:$('#score-date').value,type:$('#score-type').value,note:$('#score-note').value.trim()};
    if(base.date>localDate())throw new Error('실제 시험을 치른 날짜를 입력해 주세요.');
    const record=validateRecord(base.type==='school'?{...base,grade:Number($('#score-grade').value)}:{...base,values:['korean','math','social','science'].map(key=>$(`#score-${key}`).value),english:Number($('#score-english').value)});
    state.records.push(record);persist('기록을 남겼어요. 지난번보다 달라진 점을 찾아보세요.');renderHistory();
    $('#form-message').textContent='기록을 추가했어요. 같은 시험을 중복해서 넣었다면 아래에서 삭제할 수 있어요.';
    $('#score-note').value='';
  } catch(error){$('#form-message').textContent=error.message;}
});
$('#export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`나의-진학기록-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('백업 파일을 내려받았어요. 개인 성적이 있으니 안전하게 보관해 주세요.');
});
$('#import').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>1000000)throw new Error('1MB 이하의 진학 나침반 백업 파일을 선택해 주세요.');
    const imported=validateBackup(JSON.parse(await file.text()),ids);
    if(!confirm(`백업의 성적 ${imported.records.length}개와 목표·미션으로 현재 기록을 교체할까요? 현재 기록은 먼저 백업해 주세요.`))return;
    state=imported;storageAvailable=true;persist('백업을 불러왔어요.');renderJourney();renderCards();
  }catch(error){toast(error instanceof SyntaxError?'JSON 백업 파일을 읽지 못했어요. 기존 기록은 유지됩니다.':error.message);}
  finally{event.target.value='';}
});
// Recompute the week after the tab has been left open overnight.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderJourney();});
function routeHash(){const hash=location.hash.slice(1);if(hash.startsWith('university/')){navigate('explore',false);openDetail(hash.split('/')[1]);}else if(hash==='university-list'){navigate('explore',false);$('#university-list').scrollIntoView();}else navigate(hash||'explore',false);}
window.addEventListener('hashchange',routeHash);
renderChips();renderCards();renderRoadmap();renderJourney();routeHash();
if(evidenceFailed)toast('과거 입결 자료를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.');

