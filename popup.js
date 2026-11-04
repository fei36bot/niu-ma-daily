const DEFAULTS = { workStart: '09:00', workEnd: '18:00', payday: 10 };

function load(){
  chrome.storage.local.get(DEFAULTS, (d) => {
    document.getElementById('workStart').value = d.workStart || DEFAULTS.workStart;
    document.getElementById('workEnd').value = d.workEnd || DEFAULTS.workEnd;
    document.getElementById('payday').value = Number(d.payday) || DEFAULTS.payday;
  });
}

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const workStart = document.getElementById('workStart').value || DEFAULTS.workStart;
  const workEnd = document.getElementById('workEnd').value || DEFAULTS.workEnd;
  let payday = Number(document.getElementById('payday').value) || DEFAULTS.payday;
  payday = Math.min(28, Math.max(1, payday));
  chrome.storage.local.set({ workStart, workEnd, payday }, () => {
    const msg = document.getElementById('msg');
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 1500);
  });
});

load();
