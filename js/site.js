(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav shrink on scroll + hero parallax
  var nav = $('#nav'), dev = $('[data-parallax]');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 8);
    if (dev && !reduce && y < 900) dev.style.transform = 'translateY(' + (y * -0.06) + 'px)';
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Reveals, count-ups, rings
  function countUp(el) {
    var to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0;
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    var t0 = performance.now();
    (function step(t) {
      var p = Math.min(1, (t - t0) / 1600), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      if (e.target.matches('.rings')) e.target.classList.add('on');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 }) : null;
  $$('.reveal,.rings').forEach(function (el) { io ? io.observe(el) : el.classList.add('in', 'on'); });

  // Theme toggle
  $('#theme-btn').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });

  // Demo console (all fake, in-browser)
  var state = { acc: 0, ack: 0, ver: 0, dlq: 0 };
  var names = ['irrigation.valve.close', 'soil.alert.moisture', 'pump.restart', 'gateway.heartbeat', 'order.dispatch', 'sensor.battery.low'];
  var seq = 1000, running = 0;
  function set(id, v) { $(id).textContent = v; }
  function stamp() { return new Date().toLocaleTimeString([], { hour12: false }); }
  function row(parent, cls, text, max) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="dot ' + cls + '"></span><span></span><span class="t">' + stamp() + '</span>';
    li.children[1].textContent = text;
    parent.insertBefore(li, parent.firstChild);
    while (parent.children.length > (max || 8)) parent.removeChild(parent.lastChild);
    return li;
  }
  function sendEvent() {
    var id = 'evt_' + (++seq), name = names[Math.floor(Math.random() * names.length)];
    var tl = $('#timeline'), ev = $('#list-events');
    var fail = Math.random() < 0.12, step = reduce ? 0 : 650;
    state.acc++; set('#k-acc', state.acc);
    row(tl, 'blue', id + ' accepted · durable');
    var li = row(ev, 'blue', id + ' · ' + name + ' · accepted', 20);
    setTimeout(function () {
      row(tl, 'blue', id + ' notified');
      setTimeout(function () {
        state.ack++; set('#k-ack', state.ack);
        row(tl, 'ok', id + ' acknowledged');
        setTimeout(function () {
          if (fail) {
            state.dlq++; set('#k-dlq', state.dlq);
            row(tl, 'warn', id + ' dead-lettered after retries');
            li.querySelector('.dot').className = 'dot warn';
            var d = $('#list-dlq'), e = d.querySelector('.empty'); if (e) d.removeChild(e);
            row(d, 'warn', id + ' · ' + name + ' · needs review', 20);
          } else {
            state.ver++; set('#k-ver', state.ver);
            row(tl, 'ok', id + ' outcome verified');
            li.querySelector('.dot').className = 'dot ok';
          }
        }, step);
      }, step);
    }, step);
  }
  $('#send').addEventListener('click', sendEvent);
  $$('[role=tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[role=tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      ['dash', 'events', 'dlq'].forEach(function (k) { $('#pane-' + k).hidden = k !== b.dataset.tab; });
    });
  });
  var demoIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es[0].isIntersecting ? start() : stop();
  }) : null;
  var timer;
  function start() { if (!timer && !reduce) { timer = setInterval(sendEvent, 3200); if (!state.acc) sendEvent(); } else if (reduce && !state.acc) sendEvent(); }
  function stop() { clearInterval(timer); timer = null; }
  if (demoIO) demoIO.observe($('#demo'));

  // Command palette
  var pal = $('#palette'), inp = $('#palette-input'), list = $('#palette-list');
  var cmds = [
    ['Overview', function () { go('#overview'); }], ['Reliability', function () { go('#guarantees'); }],
    ['Console demo', function () { go('#demo'); }], ['Specs', function () { go('#specs'); }],
    ['Send demo event', function () { go('#demo'); sendEvent(); }],
    ['Toggle theme', function () { $('#theme-btn').click(); }],
    ['GitHub', function () { window.open('https://github.com/zyvorai', '_blank', 'noopener'); }]
  ];
  function go(h) { var t = $(h); if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  var sel = 0, shown = [];
  function render() {
    var q = inp.value.toLowerCase();
    shown = cmds.filter(function (c) { return c[0].toLowerCase().indexOf(q) > -1; });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    shown.forEach(function (c, i) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.textContent = c[0]; if (i === sel) b.className = 'sel';
      b.addEventListener('click', function () { run(i); });
      li.appendChild(b); list.appendChild(li);
    });
  }
  function run(i) { var c = shown[i]; close(); if (c) c[1](); }
  var prev;
  function open() { prev = document.activeElement; pal.hidden = false; inp.value = ''; sel = 0; render(); inp.focus(); }
  function close() { pal.hidden = true; if (prev) prev.focus(); }
  $('#palette-btn').addEventListener('click', open);
  pal.addEventListener('click', function (e) { if (e.target === pal) close(); });
  inp.addEventListener('input', function () { sel = 0; render(); });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % shown.length; render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + shown.length) % shown.length; render(); e.preventDefault(); }
    else if (e.key === 'Enter') run(sel);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? open() : close(); }
    else if (e.key === 'Escape' && !pal.hidden) close();
  });
})();
