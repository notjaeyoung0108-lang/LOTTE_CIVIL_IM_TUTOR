/* LOTTE CIVIL IM TUTOR — no network, modules, framework, or runtime build. */
(() => {
  'use strict';
  const KEY = 'lotte_civil_im_tutor.v1';
  const DECK = [...(window.STAGE1 || []), ...(window.STAGE2 || []), ...(window.CASES || [])];
  const BOOK = window.BOOK || [];
  const byId = new Map(DECK.map(c => [c.id, c]));
  const categories = ['전체', '공사', '공무', '공정', '원가', '품질·안전', '현장리스크'];
  const difficulties = ['전체', '기본', '중급', '고급'];
  const fields = ['전체', '토공', '지반', '구조', '도로', '교량', '터널', '도심지', '종합'];
  const labels = ['', '공사·공무 기본', '토목 도메인', '현장 상황 해결'];
  const subtitles = ['', '현장에서는 누가, 무엇을, 어떤 순서로 관리할까요?', '공법을 이해하고, 현장의 영향을 연결해보세요.', '여러 제약을 비교하고, 나만의 해결안을 말해보세요.'];
  const ratings = ['몰랐어요', '헷갈려요', '설명할 수 있어요'];
  const intervals = [60000, 1200000, 86400000];
  const rubric = ['핵심 문제를 정확히 정의했는가?', '안전 및 품질을 우선적으로 고려했는가?', '공정 영향을 분석했는가?', '원가 영향을 분석했는가?', '최소 2개 이상의 대안을 비교했는가?', '이해관계자를 고려했는가?', '실행계획을 제시했는가?', '모니터링 방법을 제시했는가?'];
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const inline = value => esc(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');
  // A deliberately small, escaped Markdown dialect matching docs/. Raw HTML is never executed.
  function markdown(source) {
    const lines = String(source || '').split('\n');
    const out = []; let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^```/.test(line)) {
        const code = []; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
        if (i < lines.length) i++;
        out.push(`<pre tabindex="0" aria-label="현장 도식, 가로로 스크롤"><code>${esc(code.join('\n'))}</code></pre>`); continue;
      }
      const heading = /^(#{1,4})\s+(.+)/.exec(line);
      if (heading) { const n = heading[1].length; out.push(`<h${n}>${inline(heading[2])}</h${n}>`); i++; continue; }
      if (/^>/.test(line)) { out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
      if (/^[-*] /.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*] /.test(lines[i])) items.push(`<li>${inline(lines[i++].slice(2))}</li>`);
        out.push(`<ul>${items.join('')}</ul>`); continue;
      }
      if (/^\d+\. /.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\d+\. /, ''))}</li>`);
        out.push(`<ol>${items.join('')}</ol>`); continue;
      }
      if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
        const cells = l => l.replace(/^\||\|$/g, '').split('|').map(x => inline(x.trim()));
        const head = cells(line); const rows = []; i += 2;
        while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
        out.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="교재 표, 가로로 스크롤"><table><thead><tr>${head.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
      }
      const p = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#|>|[-*] |\d+\. |\||```)/.test(lines[i])) p.push(lines[i++]);
      out.push(`<p>${inline(p.join(' '))}</p>`);
    }
    return out.join('');
  }
  const BOOK_EDITION = 'growth-2026-09';
  const defaults = () => ({version:1, cards:{}, cases:{}, filters:{category:'전체',difficulty:'전체',field:'전체'}, log:[], book:{edition:BOOK_EDITION,last:0,part:'story',read:[]}});
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const number = v => Number.isFinite(v) && v >= 0;
  function warning(message) { $('storage-warning').hidden = !message; $('storage-warning').textContent = message; }
  function normalize(raw) {
    const s = defaults();
    if (!object(raw) || raw.version !== 1) throw new Error('unsupported state');
    for (const [id, v] of Object.entries(object(raw.cards) ? raw.cards : {})) {
      if (byId.has(id) && object(v) && number(v.reps) && number(v.last) && number(v.due) && [1,2,3].includes(v.grade)) s.cards[id] = {reps:v.reps,last:v.last,due:v.due,grade:v.grade,misses:number(v.misses)?v.misses:0};
    }
    for (const [id, v] of Object.entries(object(raw.cases) ? raw.cases : {})) {
      if (byId.get(id)?.s !== 3 || !object(v)) continue;
      s.cases[id] = {answer:typeof v.answer === 'string'?v.answer:'',hints:Math.min(byId.get(id).hints.length,Math.max(0,Math.floor(Number(v.hints)||0))),rubric:rubric.map((_, i) => !!v.rubric?.[i]),completed:!!v.completed,viewed:number(v.viewed)?v.viewed:0,lastPracticed:number(v.lastPracticed)?v.lastPracticed:0};
    }
    for (const [key, options] of Object.entries({category:categories,difficulty:difficulties,field:fields})) if (options.includes(raw.filters?.[key])) s.filters[key] = raw.filters[key];
    s.log = Array.isArray(raw.log) ? raw.log.filter(l => object(l) && byId.has(l.id) && number(l.at) && [1,2,3].includes(l.grade)).map(l => ({id:l.id,at:l.at,grade:l.grade})) : [];
    // Keep card practice; old book completion does not apply to new manuscripts.
    if (raw.book?.edition === BOOK_EDITION) {
      s.book.last = BOOK.some(b => b.id === raw.book.last) ? raw.book.last : 0;
      s.book.part = raw.book.part === 'study' ? 'study' : 'story';
      s.book.read = Array.isArray(raw.book.read) ? raw.book.read.filter(key => BOOK.some(b => key === `${b.id}/story` || key === `${b.id}/study`)) : [];
    }
    return s;
  }
  let state = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) state = normalize(JSON.parse(raw)); }
  catch { warning('저장된 기록을 읽지 못했습니다. 현재는 새 상태로 표시합니다. 다음 저장 시 새 기록이 적용됩니다.'); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); warning(''); return true; }
    catch { warning('브라우저 저장 공간에 기록하지 못했습니다. 현재 화면에서는 학습할 수 있지만 새로고침하면 최근 변경이 사라질 수 있습니다. 기록 탭에서 백업을 내려받으세요.'); return false; }
  }
  function caseState(id) {
    if (!state.cases[id]) state.cases[id] = {answer:'',hints:0,rubric:rubric.map(() => false),completed:false,viewed:0,lastPracticed:0};
    return state.cases[id];
  }
  const sessions = {1:{id:null,back:false},2:{id:null,back:false},3:{id:null,back:false}};
  let stage = 0, routeArg = '', routeName = '', toastTimer;
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2400); }
  function pool(s) {
    return DECK.filter(c => c.s === s && (state.filters.category === '전체' || c.category === state.filters.category || c.tags?.includes(state.filters.category)) && (s !== 3 || (state.filters.difficulty === '전체' || c.difficulty === state.filters.difficulty) && (state.filters.field === '전체' || c.field === state.filters.field)));
  }
  function due(s, now = Date.now()) { return pool(s).filter(c => state.cards[c.id] && state.cards[c.id].due <= now).sort((a,b) => state.cards[a.id].due - state.cards[b.id].due); }
  function pick(s, now = Date.now()) { return due(s, now)[0] || pool(s).find(c => !state.cards[c.id]) || null; }
  function grade(id, value, now = Date.now()) {
    const old = state.cards[id] || {reps:0,misses:0};
    state.cards[id] = {reps:old.reps+1,last:now,due:now+intervals[value-1],grade:value,misses:old.misses+(value===1?1:0)};
    state.log.push({id,at:now,grade:value});
    if (byId.get(id).s === 3) { const cs = caseState(id); cs.completed = true; cs.lastPracticed = now; }
    save();
  }
  function badges() {
    document.querySelectorAll('#tabs a').forEach(a => {
      a.querySelector('.badge')?.remove();
      const n = /^s([123])$/.exec(a.dataset.tab);
      if (!n) return;
      const count = due(Number(n[1])).length;
      if (count) a.insertAdjacentHTML('beforeend', `<span class="badge" aria-label="복습 ${count}개">${count > 99 ? '99+' : count}</span>`);
    });
  }
  function chips(name, values) { return `<div class="chips" role="group" aria-label="${name==='category'?'업무':name==='difficulty'?'난이도':'Case 분야'} 필터">${values.map(v => `<button class="chip ${state.filters[name]===v?'active':''}" aria-pressed="${state.filters[name]===v}" data-filter="${name}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div>`; }
  function filters(s) { return chips('category',categories) + (s===3 ? `<div class="filter-label">난이도</div>${chips('difficulty',difficulties)}<div class="filter-label">Case 분야</div>${chips('field',fields)}` : ''); }
  function heading(s) { return `<div class="eyebrow">STEP 0${s} / ${s===1?'FOUNDATION':s===2?'CIVIL ENGINEERING':'CASE TRAINING'}</div><div class="topline"><h1>${labels[s]}</h1><span class="pill">${DECK.filter(c=>c.s===s).length}${s===3?' CASES':' CARDS'}</span></div><p class="intro">${subtitles[s]}</p>`; }
  function gradeButtons() { return `<div class="grades" aria-label="학습 난이도 자기평가">${ratings.map((label, i) => `<button class="grade" data-grade="${i+1}"><strong>${label}</strong><small>${['1분','20분','1일'][i]} 뒤 복습</small></button>`).join('')}</div><p class="shortcut"><kbd>Space</kbd> 앞·뒤 전환 &nbsp; <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 자기평가 · 입력 중에는 단축키가 꺼집니다.</p>`; }
  function related(c) { const b = BOOK.find(b => b.id===c.chapter); return b ? `<div class="related"><small>같은 판단을 PART B 학습에서 다시 살펴보세요.</small><br><a href="#book/${b.id}/study">CASE ${String(b.id).padStart(2,'0')} ${esc(b.title)} ↗</a></div>` : ''; }
  function metadata(c) { return `<div class="meta"><span class="tag level">${c.s===3?c.difficulty:`${c.s}단계`}</span><span>${esc(c.domain)}</span><span>·</span><span>${(state.cards[c.id]?.reps || 0)+1}회째</span>${(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`; }
  function flashImage(c) {
    return c.image ? `<figure class="flash-image"><img src="${esc(c.image)}" alt="${esc(c.imageAlt || c.g || c.q)}" decoding="async"><figcaption hidden role="status">이미지를 불러오지 못했습니다. 질문과 답변으로 학습을 계속할 수 있습니다.</figcaption></figure>` : '';
  }
  function flash(c, back) {
    return `<article class="panel">${metadata(c)}${back ? `<h2>${esc(c.q)}</h2>${flashImage(c)}<div class="prose">${markdown(c.a)}</div>${related(c)}` : `<div class="flash-front"><h2>${esc(c.q)}</h2>${flashImage(c)}<p>${c.s===1||c.answerFormat==='concept'?'정의 → 역할 → 현장 활용':'현상 → 원인 → 영향 → 관리방법'} 순서로 설명해보세요.</p></div>`}<div class="card-id"><span>${c.id.toUpperCase()} · ${esc(c.g)}</span><span>${back?'ANSWER':'QUESTION'}</span></div></article>${back?`<button class="button subtle full" data-action="flip">← 질문 다시 보기</button>${gradeButtons()}`:`<button class="button primary full" data-action="flip">정답 보기 <span aria-hidden="true">↗</span></button><p class="shortcut"><kbd>Space</kbd> 정답 보기</p>`}`;
  }
  function comparison(c) { return `<p class="note">공기·비용은 제시 조건에 따른 비교입니다. 표를 좌우로 밀어 모든 항목을 확인하세요.</p><div class="table-scroll" tabindex="0" role="region" aria-label="대안 비교표, 가로로 스크롤"><table><thead><tr>${['대안','공기효과','추가비용','안전','품질','환경·민원','승인'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${c.comparison.map(o=>`<tr>${['name','time','cost','safety','quality','civil','approval'].map((k,i)=>i?`<td>${esc(o[k])}</td>`:`<th scope="row">${esc(o[k])}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
  function caseFront(c) {
    const cs = caseState(c.id);
    return `<article class="panel">${metadata(c)}<h2 class="case-title">${esc(c.title)}</h2><h3>프로젝트 상황</h3><p class="case-background">${esc(c.background)}</p><h3>동시에 발생한 문제</h3><ul class="issues">${c.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul><p class="question">${esc(c.question)}</p>
    <div class="answer-box"><button class="button" data-action="write">내 해결안 작성 <span aria-hidden="true">↗</span></button><label for="case-answer" class="note">나의 판단 · 생각을 정리하거나 2~3분 답변을 적어보세요.</label><textarea id="case-answer" placeholder="상황 파악 → 우선순위 → 원인·영향 → 대안 → 비교·선택 → 실행·협의 → 모니터링\n\n저라면 우선…">${esc(cs.answer)}</textarea><div id="save-status" class="save-status">${cs.answer?'저장된 답변':'입력하면 이 브라우저에 자동 저장됩니다.'}</div></div>
    <div id="hint-list">${c.hints.slice(0,cs.hints).map((h,i)=>`<p class="hint"><strong>힌트 ${i+1}</strong> · ${esc(h)}</p>`).join('')}</div><button class="button subtle full" data-action="hint" ${cs.hints>=c.hints.length?'disabled':''} style="margin-top:14px">힌트 보기 ${cs.hints} / ${c.hints.length}</button>${related(c)}</article>
    <p class="note" style="margin:0 0 10px">먼저 직접 판단해보는 것을 권장합니다.</p><button class="button primary full" data-action="flip">모범 접근방법 보기 ↗</button><p class="shortcut"><kbd>Space</kbd> 모범 접근방법 보기</p>`;
  }
  function caseBack(c) {
    const cs = caseState(c.id);
    return `<article class="panel">${metadata(c)}<h2>${esc(c.title)}</h2><p class="priority">법규·안전 → 품질·구조 안정성 → 계약·발주처 요구 → 공정 → 원가 → 민원·이해관계자<br><small>기본 사고 순서입니다. 안전과 연결된 민원은 즉시 대응하며, 사례별 상충관계를 함께 판단합니다.</small></p>
    <div class="section-title"><h2>현장 해결 7단계</h2><span>MODEL APPROACH</span></div><ol class="steps">${c.framework.map(f=>`<li><h3>${esc(f.title.replace(/^\d+\.\s*/,''))}</h3><p>${esc(f.body)}</p></li>`).join('')}</ol>
    <div class="section-title"><h2>대안 비교</h2></div>${comparison(c)}
    <div class="section-title"><h2>면접용 2~3분 답변</h2></div><p class="note">말하는 속도에 따라 길이가 달라집니다. 소리 내어 읽고 본인의 표현으로 줄여보세요.</p><div class="interview">${esc(c.interviewAnswer)}</div>
    <div class="section-title"><h2>놓치기 쉬운 포인트</h2></div><ul class="issues">${c.keyPoints.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><div class="section-title"><h2>피해야 할 답변</h2></div><ul class="issues">${c.pitfalls.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>
    <details><summary>내가 작성한 답변과 비교하기</summary><p class="interview" style="margin-top:12px">${esc(cs.answer || '아직 작성한 답변이 없습니다. 질문 화면에서 생각을 적어보세요.')}</p></details>
    <div class="section-title"><h2>자기평가 체크리스트</h2></div><p class="note">AI 채점이 아닙니다. 내 답변에 실제로 포함한 항목을 직접 확인하세요.</p><div class="rubric">${rubric.map((r,i)=>`<label class="check"><input type="checkbox" data-rubric="${i}" ${cs.rubric[i]?'checked':''}><span>${r}</span></label>`).join('')}</div><p id="rubric-status" class="note">${cs.rubric.filter(Boolean).length} / 8개 항목을 직접 확인했습니다.</p>${related(c)}<div class="card-id"><span>${c.id.toUpperCase()}</span><span>SELF REVIEW</span></div></article><button class="button subtle full" data-action="flip">← 질문·내 답변으로 돌아가기</button>${gradeButtons()}<p class="note">위 평가 버튼을 누르면 연습 완료로 기록되고 다음 복습이 예약됩니다.</p>`;
  }
  function directory(list) {
    return `<details class="case-directory"><summary>Case 목록에서 직접 선택 · ${list.length}개</summary><p class="note">001은 지정 종합 예제입니다. 처음이라면 002부터 기본 → 중급 → 고급 순으로 연습하세요.</p><div class="case-list">${list.map(c=>`<a class="case-item" href="#s3/${c.id}"><small>${c.id.slice(-3)} · ${esc(c.difficulty)} · ${esc(c.field)} ${state.cases[c.id]?.completed?'· 연습 완료':''}</small><strong>${esc(c.title)}</strong></a>`).join('')}</div></details>`;
  }
  function renderStudy() {
    const session = sessions[stage], list = pool(stage);
    let c = byId.get(session.id);
    if (!c || c.s!==stage) { c = pick(stage); session.id = c?.id || null; session.back = false; }
    let content = heading(stage) + filters(stage);
    content += `<div class="study-bar"><span>복습 <strong>${due(stage).length}</strong> · 새 카드 <strong>${list.filter(c=>!state.cards[c.id]).length}</strong></span><span>${routeArg?'직접 선택 · ':''}${list.length}개 선택됨</span></div>`;
    if (!c) {
      content += `<section class="panel empty"><div class="eyebrow">${list.length?'SESSION COMPLETE':'NO CARDS'}</div><h2>${list.length?'지금 할 학습을 마쳤어요.':'선택한 조건에 자료가 없어요.'}</h2><p id="waitline">${list.length?'다음 복습 시간을 확인하고 있습니다.':'필터를 바꾸거나 전체 범위로 돌아가세요.'}</p><button class="button" data-action="${list.length?'practice':'clear-filters'}">${list.length?'자유 연습 한 장':'필터 초기화'}</button></section>`;
    } else {
      if (stage===3) { const cs=caseState(c.id); if (!cs.viewed) {cs.viewed=Date.now();save();} }
      content += stage===3 ? (session.back?caseBack(c):caseFront(c)) : flash(c,session.back);
    }
    if (stage===3) content+=directory(list);
    $('main').innerHTML = content; badges(); updateWait();
  }
  function updateWait() {
    if (!stage || sessions[stage].id || !$('waitline')) return;
    const next = pick(stage);
    if (next) { sessions[stage].id = next.id; renderStudy(); return; }
    const upcoming = pool(stage).map(c=>state.cards[c.id]?.due).filter(n=>n>Date.now()).sort((a,b)=>a-b)[0];
    if (upcoming) { const sec=Math.max(0,Math.ceil((upcoming-Date.now())/1000)); $('waitline').textContent = `다음 복습까지 ${sec>=3600?`${Math.floor(sec/3600)}시간 `:''}${Math.floor(sec%3600/60)}분 ${sec%60}초 · 기한이 되면 자동으로 이어집니다.`; }
  }
  function blueprint() { return `<div class="blueprint" aria-hidden="true"><span>FIELD NOTE / SECTION 01</span><svg viewBox="0 0 320 190" fill="none"><path d="M22 140H298M35 146V154M285 146V154M35 150H285M60 118V92H98V118M222 118V92H260V118M43 118H111L127 78H193L210 118H277M43 123H114L132 85H188L205 123H277M74 115V77M246 115V77M74 91H246M75 81H245M79 82L100 91L124 82L147 91L170 82L194 91L218 82L240 91M138 140V96H182V140M144 140V102H176V140" stroke="currentColor" stroke-width="1.2"/><path d="M25 139L44 124M40 139L58 124M57 139L73 124M75 139L92 124M93 139L109 124M211 139L228 124M229 139L246 124M247 139L264 124M265 139L280 126" stroke="currentColor" stroke-width=".5"/><circle cx="160" cy="64" r="3" stroke="currentColor"/><path d="M160 36V58M160 69V76M23 118H32M287 118H299" stroke="currentColor" stroke-dasharray="3 3"/></svg></div>`; }
  function bookHome() {
    const groups = [...new Set(BOOK.map(b=>b.growth))];
    $('main').innerHTML = `<div class="hero"><div><div class="eyebrow">FIELD SIMULATION / 성장형 현장 교재</div><h1>현장을 경험하고,<br>판단의 이유를 배우다.</h1><p class="intro">신입 안재영이 담당구간을 판단하고 후배에게 설명하기까지.<br>한 사건의 소설을 읽은 뒤, 공사·공무의 사고체계로 해부합니다.</p></div>${blueprint()}</div>
      <section class="panel"><h2>한 사건, 두 번의 읽기</h2><p>PART A. 현장소설에서 공간·사람·갈등을 경험합니다. 사건이 끝나면 PART B. 학습에서 미확인 사실, 통제 범위, 대안과 그 이유를 검토합니다.</p><p class="note">18개 사건 · 소설과 학습 별도 화면 · 숙련된 담당자의 사고방식을 훈련하며 실제 현장 경력을 대체하지 않습니다.</p></section>
      ${state.book.last?`<a class="backlink" href="#book/${state.book.last}/${state.book.part}">이어서 읽기 · ${esc(BOOK.find(b=>b.id===state.book.last)?.title)} · PART ${state.book.part==='study'?'B':'A'} →</a>`:''}
      ${groups.map((group,i)=>`<section><div class="section-title"><h2>${String(i+1).padStart(2,'0')} ${esc(group)}</h2></div><div class="chapter-grid">${BOOK.filter(b=>b.growth===group).map(b=>`<a class="chapter" href="#book/${b.id}/story"><span class="num">${String(b.id).padStart(2,'0')}</span><div><strong>${esc(b.title)}</strong><small>PART A 소설 ${state.book.read.includes(b.id+'/story')?'✓':''} → PART B 학습 ${state.book.read.includes(b.id+'/study')?'✓':''}</small></div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div></section>`).join('')}
      ${BOOK.length?'':'<p class="empty">교재 데이터가 없습니다. data/book.js를 확인하세요.</p>'}
      <div class="section-title"><h2>보조 회상과 전이 연습</h2></div><div class="journey">${[1,2,3].map((s,i)=>`<a href="#s${s}"><small>REVIEW 0${s} ↗</small><strong>${['기본을 회상하다','기술을 연결하다','다른 사건에 적용하다'][i]}</strong><p>${DECK.filter(c=>c.s===s).length}${s===3?'개 실전 Case':'장 학습 카드'}</p></a>`).join('')}</div>
      <div class="reference-links"><a href="docs/00_교재사용법.md">교재 사용법</a><a href="reference/현장용어집.md">현장용어집</a><a href="reference/도면읽기.md">도면 읽기</a><a href="reference/기술검증.md">기술 검증 범위</a></div>
      <p class="footer-note">LOTTE CIVIL IM TUTOR · 개인 학습도구 · 롯데건설 공식 서비스가 아닙니다.<br>인물·현장·수량은 교육용 가상 설정입니다. 학습 기록은 이 브라우저에 저장됩니다.</p>`;
  }
  function bookChapter(id, part = 'story') {
    const b = BOOK.find(x=>x.id===id); if (!b) return bookHome();
    part = part === 'study' ? 'study' : 'story';
    state.book.last=id; state.book.part=part; save();
    const index = BOOK.indexOf(b), linked = DECK.filter(c=>c.chapter===id), isStudy=part==='study';
    const prev = isStudy ? `#book/${id}/story` : index>0 ? `#book/${BOOK[index-1].id}/study` : '#book';
    const next = !isStudy ? `#book/${id}/study` : index<BOOK.length-1 ? `#book/${BOOK[index+1].id}/story` : '#book';
    $('main').innerHTML = `<a class="backlink" href="#book">← 성장형 교재 목차</a><div class="eyebrow">CHAPTER ${String(id).padStart(2,'0')} / ${esc(b.growth)} / PART ${isStudy?'B':'A'}</div>
      <nav class="book-parts" aria-label="이 사건의 읽기 영역"><a class="button ${!isStudy?'primary':''}" href="#book/${id}/story" ${!isStudy?'aria-current="page"':''}>PART A. 현장소설</a><a class="button ${isStudy?'primary':''}" href="#book/${id}/study" ${isStudy?'aria-current="page"':''}>PART B. 학습</a></nav>
      <article class="panel prose">${markdown(isStudy?b.studyMd:b.md)}</article>
      <button class="button full" data-action="read" data-chapter="${id}" data-part="${part}">${state.book.read.includes(id+'/'+part)?'✓ 읽은 영역':`PART ${isStudy?'B':'A'} 읽음으로 표시`}</button>
      <div class="book-nav"><a class="button" href="${prev}">${isStudy?'← 이 사건 소설':'← 이전 학습'}</a><a class="button subtle" href="#book">목차</a><a class="button" href="${next}">${!isStudy?'이 사건 학습 →':index<BOOK.length-1?'다음 사건 →':'전체 목차 →'}</a></div>
      ${isStudy&&linked.length?`<section class="related"><h3>보조 회상·전이 연습</h3>${[1,2,3].map(s=>{const c=linked.find(c=>c.s===s);return c?`<a href="#s${s}/${c.id}">${s}단계 · ${esc(c.title||c.g)} ↗</a>`:'';}).join('')}</section>`:''}`;
  }
  function caseListSection(title, list, empty) { return `<div class="section-title"><h2>${title}</h2><span>${list.length}개</span></div>${list.length?`<div class="case-list">${list.slice(0,6).map(c=>`<a class="case-item" href="#s3/${c.id}"><small>${c.id.slice(-3)} · ${c.difficulty}${state.cards[c.id]?.misses?` · 몰랐어요 ${state.cards[c.id].misses}회`:''}</small><strong>${esc(c.title)}</strong></a>`).join('')}</div>${list.length>6?'<p class="note">최근/우선 6개를 표시합니다. 전체 목록은 실전 탭에서 확인하세요.</p>':''}`:`<p class="note">${empty}</p>`}`; }
  function home() {
    const now=Date.now(), today=new Date().setHours(0,0,0,0), seen=DECK.filter(c=>state.cards[c.id]).length, allCases=DECK.filter(c=>c.s===3), completed=allCases.filter(c=>state.cases[c.id]?.completed).length;
    const recent=allCases.filter(c=>state.cases[c.id]?.lastPracticed).sort((a,b)=>state.cases[b.id].lastPracticed-state.cases[a.id].lastPracticed);
    const hard=allCases.filter(c=>state.cards[c.id]?.misses).sort((a,b)=>state.cards[b.id].misses-state.cards[a.id].misses);
    const unseen=allCases.filter(c=>!state.cases[c.id]?.viewed);
    $('main').innerHTML = `<div class="eyebrow">MY STUDY / LEARNING RECORD</div><h1>쌓이는 이해, 나의 기록.</h1><p class="intro">하루의 작은 반복이 현장에서의 판단이 됩니다.</p><div class="stats">${[['오늘 학습',state.log.filter(l=>l.at>=today&&l.at<=now).length],['학습한 카드',seen],['전체 카드',DECK.length],['실전 Case 완료',completed]].map(([label,n])=>`<div class="stat"><span>${label}</span><strong>${n}</strong></div>`).join('')}</div>
      <section class="panel"><h2>단계별 진행률</h2>${[1,2,3].map(s=>{const list=DECK.filter(c=>c.s===s),done=list.filter(c=>s===3?state.cases[c.id]?.completed:state.cards[c.id]?.grade===3).length;return `<a class="progress-row" style="display:block" href="#s${s}"><div class="progress-head"><strong>${s}단계 ${labels[s]}</strong><span>${s===3?'연습 Case':'외운 카드'} ${done} / ${list.length}</span></div><progress aria-label="${s}단계 진행률" value="${done}" max="${list.length||1}"></progress></a>`;}).join('')}<p class="note">외운 카드 = 최근 평가가 ‘설명할 수 있어요’인 카드. Case 완료 = 모범 접근방법 확인 후 자기평가한 Case. 진행률은 전체 자료 기준입니다.</p></section>
      ${caseListSection('최근 연습 Case',recent,'실전 문제를 읽고 자기평가하면 이곳에 기록됩니다.')}${caseListSection('다시 짚어볼 Case',hard,'‘몰랐어요’를 선택한 Case가 이곳에 모입니다.')}${caseListSection('아직 보지 않은 Case',unseen,'모든 Case를 한 번 이상 열어봤습니다.')}
      <div class="section-title"><h2>최근 학습 로그</h2><span>최근 20회 · 전체 ${state.log.length}회</span></div>${state.log.slice(-20).reverse().map(l=>`<div class="history-row"><a href="#s${byId.get(l.id).s}/${l.id}">${esc(byId.get(l.id).title||byId.get(l.id).g)}<br><small>${new Date(l.at).toLocaleString('ko-KR')}</small></a><span>${ratings[l.grade-1]}</span></div>`).join('')||'<p class="note">아직 평가한 기록이 없습니다.</p>'}
      <div class="reset-area"><h3>이 브라우저의 학습 데이터</h3><p class="note">기기·브라우저 간 자동 동기화는 없습니다. 브라우저 데이터를 삭제하기 전에 백업하세요. 파일 경로나 접속 주소를 바꾸면 저장 공간이 달라질 수 있습니다.</p><div class="actions"><button class="button" data-action="export">기록 백업 내려받기</button><button class="button danger" data-action="reset-ask">학습 기록 초기화</button></div><div id="reset-confirm" hidden class="reset-confirm"><strong>모든 학습 기록을 지울까요?</strong><p class="note">작성 답변, 힌트, 자기평가, 반복 일정, 필터, 교재 읽음 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p><div class="actions"><button class="button" data-action="reset-cancel">취소</button><button class="button danger" data-action="reset-confirm">모든 기록 삭제</button></div></div></div>`;
  }
  function route() {
    const parts=(location.hash||'#book').slice(1).split('/');
    routeName=parts[0];routeArg=parts[1]||'';
    const match=/^s([123])$/.exec(routeName);stage=match?Number(match[1]):0;
    if (!['book','home','s1','s2','s3'].includes(routeName)) { location.replace('#book');return; }
    $('main').className=stage?'study':'';
    document.querySelectorAll('#tabs a').forEach(a=>{if(a.dataset.tab===routeName)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if (stage) {
      if (routeArg) {
        const c=byId.get(routeArg);
        if (c?.s===stage) { sessions[stage].id=c.id;sessions[stage].back=false; }
        else { sessions[stage].id=null;sessions[stage].back=false;routeArg='';toast('해당 카드를 찾지 못해 학습 목록을 표시합니다.'); }
      } else {
        // A newly entered review session prioritizes the oldest due card.
        // Never interrupt an open draft or card merely because time passes.
        const nextDue = due(stage)[0];
        if (nextDue && sessions[stage].id !== nextDue.id) sessions[stage] = {id:nextDue.id,back:false};
      }
      renderStudy();
    } else if (routeName==='book') { if(routeArg)bookChapter(Number(routeArg),parts[2]);else bookHome(); }
    else home();
    badges(); window.scrollTo(0,0);
    $('main').focus({preventScroll:true});
    document.title=`${stage?labels[stage]:routeName==='book'?'교재':'기록'} | 롯데건설 토목 IM 학습튜터`;
  }
  function clearRouteArg() { if (routeArg) {history.replaceState(null,'',`#s${stage}`);routeArg='';} }
  function flip() { if(!stage||!sessions[stage].id)return;sessions[stage].back=!sessions[stage].back;renderStudy();window.scrollTo(0,0); }
  function applyGrade(value) {
    if(!stage||!sessions[stage].id||!sessions[stage].back)return;
    grade(sessions[stage].id,value);sessions[stage]={id:null,back:false};clearRouteArg();renderStudy();window.scrollTo(0,0);toast(`${ratings[value-1]} · ${['1분','20분','1일'][value-1]} 뒤 복습`);
  }
  // Image errors do not bubble; capture also handles cards inserted after navigation.
  $('main').addEventListener('error',e=>{
    if (!e.target.matches?.('.flash-image img')) return;
    e.target.hidden=true;
    e.target.nextElementSibling.hidden=false;
  },true);
  $('main').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.filter){const name=button.dataset.filter;state.filters[name]=button.dataset.value;save();[1,2,3].forEach(s=>{sessions[s]={id:null,back:false};});clearRouteArg();renderStudy();return;}
    if(button.dataset.grade){applyGrade(Number(button.dataset.grade));return;}
    const action=button.dataset.action;
    if(action==='flip')flip();
    if(action==='write')$('case-answer')?.focus();
    if(action==='hint'){const c=byId.get(sessions[stage].id),cs=caseState(c.id);cs.hints=Math.min(c.hints.length,cs.hints+1);save();const y=scrollY;renderStudy();window.scrollTo(0,y);}
    if(action==='practice'){const c=pool(stage).sort((a,b)=>(state.cards[a.id]?.last||0)-(state.cards[b.id]?.last||0))[0];if(c){sessions[stage]={id:c.id,back:false};renderStudy();}}
    if(action==='clear-filters'){state.filters=defaults().filters;save();clearRouteArg();renderStudy();}
    if(action==='read'){const key=Number(button.dataset.chapter)+'/'+button.dataset.part;state.book.read=[...new Set([...state.book.read,key])];save();button.textContent='✓ 읽은 영역';toast('읽음으로 표시했습니다.');}
    if(action==='reset-ask'){$('reset-confirm').hidden=false;$('reset-confirm').scrollIntoView({block:'center'});}
    if(action==='reset-cancel')$('reset-confirm').hidden=true;
    if(action==='reset-confirm'){state=defaults();[1,2,3].forEach(s=>{sessions[s]={id:null,back:false};});save();home();badges();toast('학습 기록을 초기화했습니다.');}
    if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lotte-im-record-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  $('main').addEventListener('input',e=>{
    if(e.target.id==='case-answer'&&stage===3){caseState(sessions[3].id).answer=e.target.value;const ok=save();$('save-status').textContent=ok?'자동 저장됨 · '+new Date().toLocaleTimeString('ko-KR'):'저장하지 못했습니다 · 입력 내용은 현재 화면에 유지됩니다.';}
  });
  $('main').addEventListener('change',e=>{
    if(e.target.dataset.rubric!==undefined&&stage===3){const cs=caseState(sessions[3].id);cs.rubric[Number(e.target.dataset.rubric)]=e.target.checked;save();$('rubric-status').textContent=`${cs.rubric.filter(Boolean).length} / 8개 항목을 직접 확인했습니다.`;}
  });
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('textarea,input,select,[contenteditable="true"]'))return;
    if(e.code==='Space'&&!e.target.closest('button,a,summary')){e.preventDefault();flip();}
    if(['1','2','3'].includes(e.key)&&!e.target.closest('button,a,summary')){e.preventDefault();applyGrade(Number(e.key));}
  });
  // This is an extension point, not an AI grader. No answer is sent anywhere.
  function evaluateCaseAnswer(caseId,userAnswer){return {mode:'self-review',caseId,userAnswer,rubric:rubric.slice(),feedback:null,score:null};}
  window.LotteTutor={KEY,pick,intervals:intervals.slice(),evaluateCaseAnswer};
  document.querySelector('.skip').addEventListener('click', e => {
    e.preventDefault();
    $('main').focus();
    $('main').scrollIntoView({block:'start'});
  });
  addEventListener('hashchange',route);
  addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)toast('다른 탭의 기록이 변경되었습니다. 입력을 마친 뒤 새로고침해 확인하세요.');});
  setInterval(()=>{badges();updateWait();},1000);
  route();
})();
