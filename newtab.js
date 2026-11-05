const DEFAULT_MONEY = [
  '推进 1 件今天最重要的事',
  '把待办勾掉已完成项',
  '学习 / 练习 25 分钟',
  '记录一条今日收获（可改成你的清单）'
];

const DEFAULTS = {
  tasks: [],
  money: null,
  workStart: '09:00',
  workEnd: '18:00',
  payday: 10
};

function pad(n){ return String(n).padStart(2,'0'); }

function parseHM(hm, fallbackH, fallbackM){
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: fallbackH, mi: fallbackM };
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mi = Math.min(59, Math.max(0, Number(m[2])));
  return { h, mi };
}

function fmtRemain(ms){
  if (ms < 0) ms = 0;
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if (h > 48) return `${Math.floor(h/24)}天 ${h%24}小时`;
  return `${h}时 ${pad(m)}分 ${pad(sec)}秒`;
}

function isWeekend(d){
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Next work-start datetime (skips weekends). If already past today's start on a weekday, return today's start for "已上班" handling by caller. */
function todayAt(now, hm, fbH, fbM){
  const { h, mi } = parseHM(hm, fbH, fbM);
  const t = new Date(now);
  t.setHours(h, mi, 0, 0);
  return t;
}

function nextWeekdayAt(now, hm, fbH, fbM, { afterNow = true } = {}){
  const t = todayAt(now, hm, fbH, fbM);
  let cursor = new Date(t);
  if (afterNow && now >= cursor) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (isWeekend(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  // re-apply time after date shifts
  const { h, mi } = parseHM(hm, fbH, fbM);
  cursor.setHours(h, mi, 0, 0);
  return cursor;
}

function workEndStatus(now, workStart, workEnd){
  if (isWeekend(now)) {
    return { label: '今日休息', note: '周末' };
  }
  const end = todayAt(now, workEnd, 18, 0);
  const start = todayAt(now, workStart, 9, 0);
  if (now < start) return { label: fmtRemain(end - now), note: '距下班（含上班前）' };
  if (now < end) return { label: fmtRemain(end - now), note: '距下班' };
  return { label: '已下班', note: '辛苦了' };
}

/** Next Saturday 00:00. If already Sat/Sun, caller shows weekend message. */
function nextSaturday(now){
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  const day = t.getDay(); // 0 Sun … 6 Sat
  if (day === 6) return t; // today Saturday start (already weekend)
  if (day === 0) {
    // Sunday — weekend already; return today midnight for consistency
    return t;
  }
  const add = 6 - day; // Mon=1 → 5, Fri=5 → 1
  t.setDate(t.getDate() + add);
  return t;
}

function nextPayday(now, paydayDay){
  let day = Number(paydayDay) || 10;
  day = Math.min(28, Math.max(1, day));
  const t = new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0);
  if (now >= t) t.setMonth(t.getMonth() + 1);
  return t;
}

function stampLocal(d){
  const z = 'Asia/Shanghai';
  try {
    return d.toLocaleString('zh-CN', { hour12: false, timeZone: z }) + '（Asia/Shanghai）';
  } catch (_) {
    return d.toLocaleString('zh-CN', { hour12: false });
  }
}

async function loadState(){
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULTS, (d) => {
      resolve({
        tasks: Array.isArray(d.tasks) ? d.tasks : [],
        money: d.money || DEFAULT_MONEY.map(t => ({ text: t, done: false })),
        workStart: d.workStart || DEFAULTS.workStart,
        workEnd: d.workEnd || DEFAULTS.workEnd,
        payday: Number(d.payday) || DEFAULTS.payday
      });
    });
  });
}

function save(partial){
  chrome.storage.local.set(partial);
}

function autosize(ta){
  ta.style.height = 'auto';
  ta.style.height = Math.max(20, ta.scrollHeight) + 'px';
}

function renderTasks(el, items, key){
  el.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    if (item.done) li.classList.add('done');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!item.done;
    cb.addEventListener('change', () => {
      items[i].done = cb.checked;
      save({ [key]: items });
      renderTasks(el, items, key);
    });
    const inp = document.createElement('textarea');
    inp.className = 'item-text';
    inp.rows = 1;
    inp.value = item.text;
    inp.setAttribute('aria-label', '清单内容');
    const persist = () => {
      items[i].text = inp.value.trim() || items[i].text;
      save({ [key]: items });
    };
    inp.addEventListener('input', () => autosize(inp));
    inp.addEventListener('change', persist);
    inp.addEventListener('blur', persist);
    li.append(cb, inp);
    el.appendChild(li);
    autosize(inp);
  });
}

function buildExportText(state){
  const now = new Date();
  const done = state.tasks.filter(t => t.done);
  const todo = state.tasks.filter(t => !t.done);
  const lines = [];
  lines.push('牛马日报 · 今日导出');
  lines.push('时间：' + stampLocal(now));
  lines.push('作息：' + state.workStart + ' – ' + state.workEnd + ' · 发薪日每月 ' + state.payday + ' 日');
  lines.push('');
  lines.push('【已完成任务】');
  if (done.length === 0) lines.push('（无）');
  else done.forEach(t => lines.push('- ' + t.text));
  lines.push('');
  lines.push('【未完成任务】');
  if (todo.length === 0) lines.push('（无）');
  else todo.forEach(t => lines.push('- ' + t.text));
  lines.push('');
  lines.push('【搞钱 checklist】');
  state.money.forEach(t => lines.push((t.done ? '✓ ' : '○ ') + t.text));
  lines.push('');
  lines.push('—— 由「牛马日报」扩展本地生成，未上传 ——');
  return lines.join('\n');
}

function downloadTxt(filename, text){
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function main(){
  let state = await loadState();
  const tasksEl = document.getElementById('tasks');
  const moneyEl = document.getElementById('money');
  renderTasks(tasksEl, state.tasks, 'tasks');
  renderTasks(moneyEl, state.money, 'money');

  document.getElementById('addTask').onclick = () => {
    state.tasks.push({ text: '新任务', done: false });
    save({ tasks: state.tasks });
    renderTasks(tasksEl, state.tasks, 'tasks');
  };

  document.getElementById('exportBtn').onclick = async () => {
    state = await loadState();
    const y = new Date();
    const name = `niu-ma-daily-${y.getFullYear()}${pad(y.getMonth()+1)}${pad(y.getDate())}.txt`;
    downloadTxt(name, buildExportText(state));
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.workStart) state.workStart = changes.workStart.newValue || state.workStart;
    if (changes.workEnd) state.workEnd = changes.workEnd.newValue || state.workEnd;
    if (changes.payday) state.payday = Number(changes.payday.newValue) || state.payday;
    if (changes.tasks) {
      state.tasks = changes.tasks.newValue || [];
      renderTasks(tasksEl, state.tasks, 'tasks');
    }
    if (changes.money) {
      state.money = changes.money.newValue || state.money;
      renderTasks(moneyEl, state.money, 'money');
    }
  });

  function tick(){
    const now = new Date();
    document.getElementById('clock').textContent = stampLocal(now);

    // 上班
    if (isWeekend(now)) {
      document.getElementById('onWork').textContent = fmtRemain(nextWeekdayAt(now, state.workStart, 9, 0) - now);
    } else {
      const start = todayAt(now, state.workStart, 9, 0);
      document.getElementById('onWork').textContent = now < start ? fmtRemain(start - now) : '已上班';
    }

    // 下班
    const off = workEndStatus(now, state.workStart, state.workEnd);
    document.getElementById('offWork').textContent = off.label;

    // 周末（修正：工作日倒计到下周六 00:00；周末直接提示）
    if (isWeekend(now)) {
      document.getElementById('weekend').textContent = '已经在周末啦';
    } else {
      document.getElementById('weekend').textContent = fmtRemain(nextSaturday(now) - now);
    }

    // 发薪
    document.getElementById('payday').textContent = fmtRemain(nextPayday(now, state.payday) - now);

    document.getElementById('scheduleHint').textContent =
      `作息 ${state.workStart}–${state.workEnd} · 发薪每月${state.payday}日（弹窗可改）`;
  }
  tick();
  setInterval(tick, 1000);
}
main();
