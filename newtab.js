const DEFAULT_MONEY = [
  'X 矿机老跳：推一条自己的项目笔记',
  '热帖价值回复 ≥5',
  '空投/测试网：只做零成本可验证步骤',
  '有真实到账再记一笔'
];

function pad(n){ return String(n).padStart(2,'0'); }
function fmtRemain(ms){
  if (ms < 0) ms = 0;
  const s = Math.floor(ms/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if (h > 48) return `${Math.floor(h/24)}天 ${h%24}小时`;
  return `${h}时 ${pad(m)}分 ${pad(sec)}秒`;
}
function nextOffWork(now){
  const t = new Date(now);
  t.setHours(18,0,0,0);
  if (now >= t) t.setDate(t.getDate()+1);
  // skip weekend for off-work display simply still next 18:00
  return t;
}
function nextWeekend(now){
  const t = new Date(now);
  const day = t.getDay(); // 0 Sun
  const add = (6 - day + 7) % 7 || 7; // next Saturday start
  t.setDate(t.getDate() + (day === 6 || day === 0 ? (day===6?0:0) : add));
  if (day === 0) { /* already weekend */ return new Date(now.getTime()); }
  if (day === 6) return new Date(now.getTime());
  t.setHours(0,0,0,0);
  return t;
}
function nextPayday(now){
  const t = new Date(now.getFullYear(), now.getMonth(), 10, 0, 0, 0, 0);
  if (now >= t) t.setMonth(t.getMonth()+1);
  return t;
}

async function loadState(){
  return new Promise(resolve => {
    chrome.storage.local.get({ tasks: [], money: null, payday: 10 }, (d) => {
      resolve({
        tasks: d.tasks,
        money: d.money || DEFAULT_MONEY.map(t => ({ text:t, done:false })),
        payday: d.payday
      });
    });
  });
}
function save(partial){
  chrome.storage.local.set(partial);
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
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = item.text;
    inp.addEventListener('change', () => {
      items[i].text = inp.value.trim() || items[i].text;
      save({ [key]: items });
    });
    li.append(cb, inp);
    el.appendChild(li);
  });
}

async function main(){
  const state = await loadState();
  const tasksEl = document.getElementById('tasks');
  const moneyEl = document.getElementById('money');
  renderTasks(tasksEl, state.tasks, 'tasks');
  renderTasks(moneyEl, state.money, 'money');
  document.getElementById('addTask').onclick = () => {
    state.tasks.push({ text: '新任务', done: false });
    save({ tasks: state.tasks });
    renderTasks(tasksEl, state.tasks, 'tasks');
  };
  function tick(){
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleString('zh-CN', { hour12:false });
    document.getElementById('offWork').textContent = fmtRemain(nextOffWork(now) - now);
    const w = nextWeekend(now);
    document.getElementById('weekend').textContent = (now.getDay()===0||now.getDay()===6) ? '已经在周末啦' : fmtRemain(w - now);
    const p = new Date(now.getFullYear(), now.getMonth(), state.payday||10);
    if (now >= p) p.setMonth(p.getMonth()+1);
    document.getElementById('payday').textContent = fmtRemain(p - now);
  }
  tick();
  setInterval(tick, 1000);
}
main();
