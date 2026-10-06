/* Payroll Transaction list (Sprint 2) - demo app.
 *
 * Vanilla JS, no build step, no dependencies. Served over http:// (never file://).
 * Labels, roles and data-testids that a Part 1 test relies on are kept stable on
 * purpose: a regression test written against the last sprint must still run here.
 */

var BUILD = 'build sprint2-2026-10-06';

var EXTRAS = new URLSearchParams(window.location.search).get('extras') === '1';

/* ------------------------------------------------------------------- state */

var COLUMN_DEFS = [
  { key: 'employeeNo', label: 'Employee number' },
  { key: 'employeeName', label: 'Name' },
  { key: 'type', label: 'Transaction type' },
  { key: 'period', label: 'Period' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'costCenter', label: 'Cost center' },
  { key: 'projectCode', label: 'Project code' },
  { key: 'account', label: 'Account' },
  { key: 'status', label: 'Status' }
];

var PAGE_SIZES = [25, 50, 100];

function defaultColumns() {
  return COLUMN_DEFS.map(function (c) { return { key: c.key, visible: true }; });
}

function emptyFilters() {
  return { type: 'all', period: 'all', status: 'all', search: '' };
}

var state = {
  view: 'signin',
  runId: DEFAULT_RUN,
  signedIn: false,
  user: '',
  signinUser: '',
  signinError: '',
  searchInput: '',
  filters: emptyFilters(),
  /* The period the list is currently scoped to. Kept beside filters.period so
   * the period index is only rebuilt when the period actually changes. */
  periodScope: 'all',
  grouped: true,
  columns: defaultColumns(),
  columnPickerOpen: false,
  sort: { key: null, dir: 'asc' },
  page: 1,
  pageSize: 25,
  savedViews: [],
  saveViewOpen: false,
  viewNameInput: '',
  viewError: '',
  selection: [],
  detailId: null,
  rejectOpen: false,
  rejectReason: '',
  rejectError: '',
  editingId: null,
  editInput: '',
  editError: '',
  loading: false,
  confirmOpen: false,
  message: ''
};

/* Storage keys are specific to this page. Part 1's page lives on the same
 * origin, and must not read or overwrite anything this page stores. */
var SESSION_KEY = 'payroll-sprint2-session';
function columnsKey() { return 'payroll-sprint2-columns:' + state.user; }
function viewsKey() { return 'payroll-sprint2-views:' + state.user; }

function saveSession() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      signedIn: state.signedIn, user: state.user, view: state.view, runId: state.runId
    }));
  } catch (e) { /* private mode: the page still works, it just forgets */ }
}

function loadSession() {
  try {
    var raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    var s = JSON.parse(raw);
    if (s && s.signedIn) {
      state.signedIn = true;
      state.user = s.user || '';
      state.view = (s.view === 'transactions') ? 'transactions' : 'runs';
      state.runId = s.runId || DEFAULT_RUN;
    }
  } catch (e) { /* ignore a corrupt value rather than breaking the page */ }
}

function readStored(key, fallback) {
  try {
    var raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

/* FR-1: the column choice is saved per user and persists. */
function saveColumns() { writeStored(columnsKey(), state.columns); }

function normaliseColumns(cols) {
  var known = COLUMN_DEFS.map(function (d) { return d.key; });
  var out = [];
  (cols || []).forEach(function (c) {
    if (c && known.indexOf(c.key) !== -1 &&
        !out.some(function (o) { return o.key === c.key; })) {
      out.push({ key: c.key, visible: c.visible !== false });
    }
  });
  known.forEach(function (k) {
    if (!out.some(function (o) { return o.key === k; })) out.push({ key: k, visible: true });
  });
  return out;
}

function loadUserSettings() {
  state.columns = normaliseColumns(readStored(columnsKey(), null));
  state.savedViews = readStored(viewsKey(), []);
}

/* ----------------------------------------------------------------- helpers */

function el(tag, props, children) {
  var node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    });
  }
  (children || []).forEach(function (c) {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

var SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(paths) {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'status-icon');
  paths.forEach(function (d) {
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  });
  return svg;
}

/* FR-4: colour AND an icon, so the statuses can be told apart without colour. */
var STATUS_ICONS = {
  Approved: ['M3 8.5l3 3 7-7', ''],
  Pending: ['M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z', 'M8 4.5V8l2.5 1.5'],
  blocking: ['M8 1.8L15 14H1z', 'M8 6v4', 'M8 11.6v.4'],
  warning: ['M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z', 'M8 4.8v4', 'M8 10.8v.4'],
  Rejected: ['M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z', 'M3.8 3.8l8.4 8.4']
};

function statusPill(t, testid) {
  var iconKey = t.status === 'Error' ? (t.severity === 'warning' ? 'warning' : 'blocking') : t.status;
  var cls = 'status status-' + t.status.toLowerCase() +
    (t.status === 'Error' ? ' severity-' + (t.severity || 'blocking') : '');
  return el('span', { class: cls, 'data-testid': testid }, [
    svgIcon(STATUS_ICONS[iconKey].filter(Boolean)),
    t.status
  ]);
}

/* Amounts are integer oere. Formatted by hand (not toLocaleString) so the output
 * is byte-identical in every browser and locale, with a plain ASCII space as the
 * thousands separator. */
function fmtAmount(cents) {
  var neg = cents < 0;
  var a = Math.abs(cents);
  var whole = Math.floor(a / 100);
  var frac = a % 100;
  var w = String(whole);
  var out = '';
  while (w.length > 3) {
    out = ' ' + w.slice(-3) + out;
    w = w.slice(0, -3);
  }
  out = w + out;
  return (neg ? '-' : '') + out + ',' + (frac < 10 ? '0' + frac : String(frac));
}

/* FR-11: Norwegian number format, two decimals. "1 234,50", "1234,50", "-400,00". */
function parseNorwegianAmount(text) {
  var s = String(text).replace(/ /g, ' ').trim();
  if (!/^-?(\d{1,3}( \d{3})+|\d+),\d{2}$/.test(s)) return null;
  var neg = s.charAt(0) === '-';
  var digits = s.replace(/[^\d]/g, '');
  var cents = Number(digits);
  return neg ? -cents : cents;
}

var clockTicks = 0;
function demoNow() {
  var total = DEMO_CLOCK.hour * 60 + DEMO_CLOCK.minute + clockTicks;
  clockTicks += 1;
  var h = Math.floor(total / 60) % 24;
  var m = total % 60;
  return DEMO_CLOCK.date + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function runById(id) {
  return RUNS.filter(function (r) { return r.id === id; })[0];
}

function runTransactions() {
  return TRANSACTIONS.filter(function (t) { return t.run === state.runId; });
}

function txById(id) {
  return TRANSACTIONS.filter(function (t) { return t.id === id; })[0];
}

function isBlocking(t) {
  return t.status === 'Error' && t.severity === 'blocking';
}

function isSelectable(t) {
  return !isBlocking(t) && t.status !== 'Rejected';
}

function isEditable(t) {
  if (t.status === 'Pending') return true;
  return EXTRAS && t.status === 'Approved';
}

/* ------------------------------------------------------------------ filters */

function matchesStatus(t, status) {
  if (status === 'all') return true;
  if (status === 'Error-blocking') return isBlocking(t);
  return t.status === status;
}

function matchesFilters(t) {
  var f = state.filters;
  var typeOk = f.type === 'all' || t.type === f.type;
  var statusOk = matchesStatus(t, f.status);
  if (f.type !== 'all' && f.status !== 'all') {
    if (!typeOk && !statusOk) return false;
  } else if (!typeOk || !statusOk) {
    return false;
  }
  if (state.periodScope !== 'all' && t.period !== state.periodScope) return false;
  if (f.search) {
    var q = f.search.toLowerCase();
    if (t.employeeName.toLowerCase().indexOf(q) === -1) return false;
  }
  return true;
}

function filteredTransactions() {
  return runTransactions().filter(matchesFilters);
}

function activeFilterChips() {
  var f = state.filters;
  var chips = [];
  /* The remove button's accessible name deliberately does NOT repeat the field
   * name: getByLabel() matches on a substring, so "Remove filter Status: Error"
   * would make getByLabel('Status') ambiguous. */
  if (f.type !== 'all') chips.push({ key: 'type', label: 'Type: ' + f.type, value: f.type });
  if (f.period !== 'all') chips.push({ key: 'period', label: 'Period: ' + f.period, value: f.period });
  if (f.status !== 'all') {
    var statusLabel = (f.status === 'Error-blocking') ? 'Error (blocking)' : f.status;
    chips.push({ key: 'status', label: 'Status: ' + statusLabel, value: statusLabel });
  }
  if (f.search) chips.push({ key: 'search', label: 'Search: ' + f.search, value: f.search });
  return chips;
}

function setPeriod(value) {
  state.filters.period = value;
  state.periodScope = value;
}

function visibleColumns() {
  return state.columns
    .filter(function (c) { return c.visible; })
    .map(function (c) {
      return COLUMN_DEFS.filter(function (d) { return d.key === c.key; })[0];
    });
}

/* ------------------------------------------------------------ sort + paging */

function compareBy(key) {
  if (key === 'amount') {
    if (EXTRAS) {
      return function (a, b) {
        var x = fmtAmount(a.amount);
        var y = fmtAmount(b.amount);
        return x < y ? -1 : (x > y ? 1 : 0);
      };
    }
    return function (a, b) { return a.amount - b.amount; };
  }
  /* Periods are "YYYY-MM", so text order is chronological order. */
  return function (a, b) {
    return String(a[key]).localeCompare(String(b[key]), 'en', { numeric: true });
  };
}

/* Every row matching the filter, in display order, across all pages. */
function orderedTransactions() {
  var rows = filteredTransactions();
  var index = {};
  rows.forEach(function (t, i) { index[t.id] = i; });
  var cmp = state.sort.key ? compareBy(state.sort.key) : null;
  var dir = state.sort.dir === 'desc' ? -1 : 1;
  return rows.slice().sort(function (a, b) {
    if (state.grouped && a.employeeNo !== b.employeeNo) {
      return a.employeeNo < b.employeeNo ? -1 : 1;
    }
    if (cmp) {
      var c = cmp(a, b) * dir;
      if (c !== 0) return c;
    }
    return index[a.id] - index[b.id];
  });
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / state.pageSize));
}

function pageSlice(ordered) {
  var pages = pageCount(ordered.length);
  if (state.page > pages) state.page = pages;
  if (state.page < 1) state.page = 1;
  var start = (state.page - 1) * state.pageSize;
  return ordered.slice(start, start + state.pageSize);
}

/* ------------------------------------------------------------------ totals */

function sumAmounts(rows) {
  return rows.reduce(function (sum, t) { return sum + t.amount; }, 0);
}

function subtotalFor(employeeNo, rows) {
  return sumAmounts(rows.filter(function (t) { return t.employeeNo === employeeNo; }));
}

/* FR-3 + FR-13: the grand total covers every row that matches the filter. */
function grandTotal() {
  return sumAmounts(filteredTransactions());
}

/* --------------------------------------------------------------- rendering */

function captureFocus() {
  var a = document.activeElement;
  if (!a || !a.getAttribute) return null;
  var id = a.getAttribute('data-testid');
  if (!id) return null;
  var snap = { testid: id, start: null, end: null };
  try {
    if (a.selectionStart !== null && a.selectionStart !== undefined) {
      snap.start = a.selectionStart;
      snap.end = a.selectionEnd;
    }
  } catch (e) { /* selectionStart is not readable on every input type */ }
  return snap;
}

function restoreFocus(snap) {
  if (!snap) return;
  var node = document.querySelector('[data-testid="' + snap.testid + '"]');
  if (!node) return;
  node.focus();
  if (snap.start !== null && node.setSelectionRange) {
    try { node.setSelectionRange(snap.start, snap.end); } catch (e) { /* not a text input */ }
  }
}

function render() {
  var snap = captureFocus();
  var root = document.getElementById('app');
  root.innerHTML = '';
  if (!state.signedIn) root.appendChild(renderSignIn());
  else if (state.view === 'runs') root.appendChild(renderRunList());
  else root.appendChild(renderTransactions());
  renderFooter();
  restoreFocus(snap);
}

function renderFooter() {
  document.getElementById('build-stamp').textContent = BUILD + (EXTRAS ? ' · extras on' : '');
}

/* ---- sign in ---- */

function renderSignIn() {
  var wrap = el('section', { class: 'card signin', 'aria-labelledby': 'signin-heading' });
  wrap.appendChild(el('h1', { id: 'signin-heading', text: 'Sign in to Payroll' }));

  wrap.appendChild(el('div', { class: 'creds', 'data-testid': 'demo-credentials' }, [
    el('p', { text: 'Demo credentials (this is a training page, not a real system):' }),
    el('p', {}, [
      el('strong', { text: 'Username: ' }), el('code', { text: 'payroll.admin' }),
      el('span', { text: '  ' }),
      el('strong', { text: 'Password: ' }), el('code', { text: 'Workshop2026!' })
    ])
  ]));

  if (state.signinError) {
    wrap.appendChild(el('p', { class: 'error-msg', role: 'alert', 'data-testid': 'signin-error',
      text: state.signinError }));
  }

  var user = el('input', { id: 'username', name: 'username', type: 'text',
    autocomplete: 'off', 'data-testid': 'username', value: state.signinUser,
    oninput: function (ev) { state.signinUser = ev.target.value; } });
  var pass = el('input', { id: 'password', name: 'password', type: 'password',
    autocomplete: 'off', 'data-testid': 'password' });

  wrap.appendChild(el('form', {
    'data-testid': 'signin-form',
    onsubmit: function (ev) {
      ev.preventDefault();
      if (user.value === 'payroll.admin' && pass.value === 'Workshop2026!') {
        state.signedIn = true;
        state.user = user.value;
        state.view = 'runs';
        state.signinError = '';
        state.signinUser = '';
        loadUserSettings();
        saveSession();
      } else {
        state.signinError = 'Wrong username or password.';
      }
      render();
    }
  }, [
    el('div', { class: 'field' }, [el('label', { for: 'username', text: 'Username' }), user]),
    el('div', { class: 'field' }, [el('label', { for: 'password', text: 'Password' }), pass]),
    el('button', { type: 'submit', class: 'primary', 'data-testid': 'signin-submit',
      text: 'Sign in' })
  ]));
  return wrap;
}

/* ---- run list ---- */

function renderRunList() {
  var wrap = el('section', { class: 'card', 'aria-labelledby': 'runs-heading' });
  wrap.appendChild(el('h1', { id: 'runs-heading', text: 'Payroll runs' }));
  wrap.appendChild(el('p', { class: 'muted', text: 'Open a run to review its transactions.' }));

  var list = el('ul', { class: 'run-list', 'data-testid': 'run-list' });
  RUNS.forEach(function (r) {
    var count = TRANSACTIONS.filter(function (t) { return t.run === r.id; }).length;
    list.appendChild(el('li', { class: 'run', 'data-testid': 'run-' + r.id }, [
      el('div', { class: 'run-main' }, [
        el('span', { class: 'run-label', text: r.label }),
        el('span', { class: 'run-meta',
          text: r.state + ' · ' + count + ' transactions · paid ' + r.paidOn })
      ]),
      el('button', {
        class: 'primary', 'aria-label': 'Open payroll run ' + r.label,
        'data-testid': 'open-run-' + r.id,
        onclick: function () { openRun(r.id); },
        text: 'Open run'
      })
    ]));
  });
  wrap.appendChild(list);
  return wrap;
}

function openRun(id) {
  state.runId = id;
  state.view = 'transactions';
  resetFilters();
  state.sort = { key: null, dir: 'asc' };
  state.page = 1;
  state.selection = [];
  state.detailId = null;
  state.editingId = null;
  state.message = '';
  saveSession();
  render();
}

/* ---- transaction list ---- */

function renderTransactions() {
  var run = runById(state.runId);
  var wrap = el('section', { class: 'tx-view', 'aria-labelledby': 'tx-heading' });

  wrap.appendChild(el('div', { class: 'crumbs' }, [
    el('button', {
      class: 'link', 'data-testid': 'back-to-runs',
      onclick: function () {
        state.view = 'runs';
        state.detailId = null;
        saveSession();
        render();
      },
      text: '← All payroll runs'
    }),
    el('button', {
      class: 'link', 'data-testid': 'sign-out',
      onclick: function () {
        state.signedIn = false;
        state.view = 'signin';
        state.user = '';
        saveSession();
        render();
      },
      text: 'Sign out'
    })
  ]));

  wrap.appendChild(el('h1', { id: 'tx-heading', text: 'Transactions — ' + run.label }));

  /* The column picker REPLACES the filter toolbar: the picker lists a column
   * called "Transaction type" and the toolbar has a filter with that label, and
   * getByLabel() matches on a substring. One at a time, never both. */
  wrap.appendChild(state.columnPickerOpen ? renderColumnPicker() : renderToolbar());
  wrap.appendChild(renderChips());
  if (state.selection.length > 0) wrap.appendChild(renderBulkBar());

  if (state.message) {
    wrap.appendChild(el('p', { class: 'message', role: 'status', 'data-testid': 'message',
      text: state.message }));
  }

  var body = el('div', { class: 'tx-body' });
  body.appendChild(state.loading ? renderSpinner() : renderTable());
  if (state.detailId) body.appendChild(renderDetail());
  wrap.appendChild(body);

  if (state.confirmOpen) wrap.appendChild(renderConfirm());
  return wrap;
}

function renderSpinner() {
  return el('div', { class: 'spinner-box', role: 'status', 'data-testid': 'loading-spinner' }, [
    el('span', { class: 'spinner', 'aria-hidden': 'true' }),
    el('span', { text: 'Working, please wait...' })
  ]);
}

function selectField(id, testid, label, value, options, onchange) {
  var sel = el('select', { id: id, 'data-testid': testid, onchange: onchange });
  options.forEach(function (o) {
    var opt = el('option', { value: o.value, text: o.label });
    if (String(o.value) === String(value)) opt.setAttribute('selected', '');
    sel.appendChild(opt);
  });
  return el('div', { class: 'field' }, [el('label', { for: id, text: label }), sel]);
}

function renderToolbar() {
  var f = state.filters;

  var search = el('input', {
    id: 'search', type: 'search', 'data-testid': 'search-input',
    placeholder: 'Name or employee number', value: state.searchInput,
    oninput: function (ev) {
      state.searchInput = ev.target.value;
      scheduleSearch();
    }
  });

  var periods = [];
  runTransactions().forEach(function (t) {
    if (periods.indexOf(t.period) === -1) periods.push(t.period);
  });
  periods.sort().reverse();

  var toolbar = el('div', { class: 'toolbar', 'data-testid': 'toolbar' }, [
    el('div', { class: 'field' }, [el('label', { for: 'search', text: 'Search' }), search]),

    selectField('filter-type', 'filter-type', 'Transaction type', f.type, [
      { value: 'all', label: 'All types' },
      { value: 'Salary', label: 'Salary' },
      { value: 'Overtime', label: 'Overtime' },
      { value: 'Deduction', label: 'Deduction' },
      { value: 'Reimbursement', label: 'Reimbursement' }
    ], function (ev) { state.filters.type = ev.target.value; applyFilterChange(); }),

    selectField('filter-period', 'filter-period', 'Period', f.period,
      [{ value: 'all', label: 'All periods' }].concat(periods.map(function (p) {
        return { value: p, label: p };
      })),
      function (ev) { setPeriod(ev.target.value); applyFilterChange(); }),

    selectField('filter-status', 'filter-status', 'Status', f.status, [
      { value: 'all', label: 'All statuses' },
      { value: 'Approved', label: 'Approved' },
      { value: 'Pending', label: 'Pending' },
      { value: 'Error', label: 'Error' },
      { value: 'Error-blocking', label: 'Error (blocking only)' },
      { value: 'Rejected', label: 'Rejected' }
    ], function (ev) { state.filters.status = ev.target.value; applyFilterChange(); })
  ]);

  var groupWrap = el('div', { class: 'field checkbox-field' });
  var groupBox = el('input', {
    id: 'group-by-employee', type: 'checkbox', 'data-testid': 'group-by-employee',
    onchange: function (ev) { state.grouped = ev.target.checked; state.page = 1; render(); }
  });
  if (state.grouped) groupBox.setAttribute('checked', '');
  groupWrap.appendChild(groupBox);
  groupWrap.appendChild(el('label', { for: 'group-by-employee', text: 'Group by employee' }));
  toolbar.appendChild(groupWrap);

  toolbar.appendChild(el('button', {
    class: 'secondary', 'data-testid': 'toggle-column-picker',
    'aria-expanded': state.columnPickerOpen ? 'true' : 'false',
    onclick: function () { state.columnPickerOpen = !state.columnPickerOpen; render(); },
    text: 'Columns'
  }));

  toolbar.appendChild(el('button', {
    class: 'secondary', 'data-testid': 'export-excel',
    onclick: exportToExcel,
    text: 'Export to Excel'
  }));

  toolbar.appendChild(renderSavedViews());
  return toolbar;
}

/* ---- saved views (FR-10) ---- */

function renderSavedViews() {
  var box = el('div', { class: 'saved-views', 'data-testid': 'saved-views' });

  var options = [{ value: '', label: 'Choose a saved view' }].concat(
    state.savedViews.map(function (v) { return { value: v.name, label: v.name }; }));
  box.appendChild(selectField('saved-view', 'saved-view-select', 'Saved view', '', options,
    function (ev) { if (ev.target.value) applyView(ev.target.value); }));

  if (!state.saveViewOpen) {
    box.appendChild(el('button', {
      class: 'secondary', 'data-testid': 'save-view-open',
      onclick: function () {
        state.saveViewOpen = true;
        state.viewNameInput = '';
        state.viewError = '';
        render();
        var input = document.querySelector('[data-testid="view-name"]');
        if (input) input.focus();
      },
      text: 'Save current view'
    }));
    return box;
  }

  var name = el('input', {
    id: 'view-name', type: 'text', 'data-testid': 'view-name', value: state.viewNameInput,
    oninput: function (ev) { state.viewNameInput = ev.target.value; }
  });
  box.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'view-name', text: 'View name' }), name
  ]));
  box.appendChild(el('button', {
    class: 'primary', 'data-testid': 'save-view', onclick: saveCurrentView, text: 'Save view'
  }));
  box.appendChild(el('button', {
    class: 'link', 'data-testid': 'save-view-cancel',
    onclick: function () { state.saveViewOpen = false; render(); },
    text: 'Cancel saving'
  }));
  if (state.viewError) {
    box.appendChild(el('p', { class: 'field-error', role: 'alert', 'data-testid': 'view-error',
      text: state.viewError }));
  }
  return box;
}

function saveCurrentView() {
  var name = state.viewNameInput.trim();
  if (!name) {
    state.viewError = 'Give the view a name.';
    render();
    return;
  }
  var view = {
    name: name,
    filters: {
      type: state.filters.type, period: state.filters.period,
      status: state.filters.status, search: state.filters.search
    },
    columns: state.columns.map(function (c) { return { key: c.key, visible: c.visible }; })
  };
  var existing = state.savedViews.filter(function (v) { return v.name === name; })[0];
  if (existing) state.savedViews[state.savedViews.indexOf(existing)] = view;
  else state.savedViews.push(view);
  writeStored(viewsKey(), state.savedViews);
  state.saveViewOpen = false;
  state.viewError = '';
  state.message = existing ? 'View "' + name + '" updated.' : 'View "' + name + '" saved.';
  render();
}

function applyView(name) {
  var view = state.savedViews.filter(function (v) { return v.name === name; })[0];
  if (!view) return;
  var saved = view.filters || {};
  ['type', 'period', 'status', 'search'].forEach(function (k) {
    var value = saved[k];
    if (value === undefined || value === 'all' || value === '') return;
    if (k === 'period') setPeriod(value);
    else state.filters[k] = value;
  });
  state.searchInput = state.filters.search;
  state.columns = normaliseColumns(view.columns);
  saveColumns();
  applyFilterChange();
  state.message = 'View "' + name + '" applied.';
}

/* ---- chips ---- */

function renderChips() {
  var chips = activeFilterChips();
  var box = el('div', { class: 'chips', 'data-testid': 'filter-chips' });
  if (chips.length === 0) {
    box.appendChild(el('span', { class: 'muted', 'data-testid': 'no-filters',
      text: 'No filters applied' }));
    return box;
  }
  chips.forEach(function (c) {
    box.appendChild(el('span', { class: 'chip' }, [
      el('span', { text: c.label }),
      el('button', {
        class: 'chip-x', 'aria-label': 'Remove filter for ' + c.value,
        'data-testid': 'remove-filter-' + c.key,
        onclick: function () {
          if (c.key === 'search') {
            cancelSearch();
            state.filters.search = '';
            state.searchInput = '';
          } else if (c.key === 'period') {
            setPeriod('all');
          } else {
            state.filters[c.key] = 'all';
          }
          applyFilterChange();
        },
        text: '×'
      })
    ]));
  });
  box.appendChild(el('button', {
    class: 'link', 'data-testid': 'clear-all-filters',
    onclick: function () { clearAllFilters(); applyFilterChange(); },
    text: 'Clear all'
  }));
  return box;
}

/* ---- columns ---- */

function renderColumnPicker() {
  var box = el('div', { class: 'card column-picker', 'data-testid': 'column-picker',
    'aria-label': 'Choose columns' });
  box.appendChild(el('h2', { text: 'Columns' }));
  box.appendChild(el('p', { class: 'muted',
    text: 'Choose which columns are visible, and reorder them. Your choice is saved.' }));

  var list = el('ul', { class: 'column-list' });
  state.columns.forEach(function (c, i) {
    var def = COLUMN_DEFS.filter(function (d) { return d.key === c.key; })[0];
    var boxId = 'col-' + c.key;
    var cb = el('input', {
      id: boxId, type: 'checkbox', 'data-testid': 'column-toggle-' + c.key,
      onchange: function (ev) {
        c.visible = ev.target.checked;
        saveColumns();
        render();
      }
    });
    if (c.visible) cb.setAttribute('checked', '');

    /* The move buttons carry the column name for screen-reader users, which makes
     * getByLabel('Period') ambiguous inside this panel; use
     * getByRole('checkbox', { name: 'Period' }) here. */
    list.appendChild(el('li', {}, [
      cb,
      el('label', { for: boxId, text: def.label }),
      el('button', {
        class: 'tiny', 'aria-label': 'Move ' + def.label + ' up',
        'data-testid': 'column-up-' + c.key, disabled: i === 0,
        onclick: function () { moveColumn(i, -1); }, text: '↑'
      }),
      el('button', {
        class: 'tiny', 'aria-label': 'Move ' + def.label + ' down',
        'data-testid': 'column-down-' + c.key, disabled: i === state.columns.length - 1,
        onclick: function () { moveColumn(i, 1); }, text: '↓'
      })
    ]));
  });
  box.appendChild(list);
  box.appendChild(el('button', {
    class: 'primary', 'data-testid': 'close-column-picker',
    onclick: function () { state.columnPickerOpen = false; render(); },
    text: 'Done'
  }));
  return box;
}

function moveColumn(index, delta) {
  var target = index + delta;
  if (target < 0 || target >= state.columns.length) return;
  var tmp = state.columns[index];
  state.columns[index] = state.columns[target];
  state.columns[target] = tmp;
  saveColumns();
  render();
}

/* ---- bulk approve ---- */

function renderBulkBar() {
  var n = state.selection.length;
  return el('div', { class: 'bulk-bar', role: 'region', 'aria-label': 'Bulk actions',
    'data-testid': 'bulk-toolbar' }, [
    el('span', { 'data-testid': 'selected-count', text: n + ' selected' }),
    el('button', {
      class: 'primary', 'data-testid': 'bulk-approve',
      onclick: function () { state.confirmOpen = true; render(); },
      text: 'Approve selected'
    }),
    el('button', {
      class: 'secondary', 'data-testid': 'clear-selection',
      onclick: function () { state.selection = []; render(); },
      text: 'Clear selection'
    })
  ]);
}

function approvableSelection() {
  return state.selection.map(txById).filter(function (t) { return t && isSelectable(t); });
}

function renderConfirm() {
  var n = approvableSelection().length;
  var noun = n === 1 ? 'transaction' : 'transactions';
  return el('div', { class: 'modal-backdrop' }, [
    el('div', {
      class: 'modal', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'confirm-title', 'data-testid': 'confirm-dialog'
    }, [
      el('h2', { id: 'confirm-title', text: 'Approve transactions' }),
      el('p', { 'data-testid': 'confirm-text',
        text: 'You are about to approve ' + n + ' ' + noun + '. Are you sure?' }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'primary', 'data-testid': 'confirm-yes',
          onclick: doBulkApprove, text: 'Yes, approve' }),
        el('button', { class: 'secondary', 'data-testid': 'confirm-cancel',
          onclick: function () { state.confirmOpen = false; render(); }, text: 'Cancel' })
      ])
    ])
  ]);
}

function doBulkApprove() {
  var rows = approvableSelection();
  var when = demoNow();
  rows.forEach(function (t) {
    if (t.status !== 'Approved') {
      t.audit.events.push('Approved by ' + state.user + ' on ' + when);
    }
    t.status = 'Approved';
    t.severity = null;
  });
  state.selection = [];
  state.confirmOpen = false;
  state.message = 'Approved ' + rows.length + ' transactions.';
  render();
}

/* ---- table ---- */

function renderTable() {
  var ordered = orderedTransactions();
  var rows = pageSlice(ordered);
  var cols = visibleColumns();
  var all = runTransactions();

  var box = el('div', { class: 'table-box' });

  box.appendChild(el('p', {
    class: 'result-count', role: 'status', 'data-testid': 'result-count',
    text: 'Showing ' + ordered.length + ' of ' + all.length + ' transactions'
  }));

  if (ordered.length === 0) {
    box.appendChild(el('p', { class: 'empty', 'data-testid': 'empty-state',
      text: 'No transactions match the current filters.' }));
    return box;
  }

  var table = el('table', { 'data-testid': 'transaction-table' });
  table.appendChild(el('caption', { class: 'sr-only',
    text: 'Payroll transactions for ' + runById(state.runId).label }));

  /* FR-7: filter -> select all -> approve. "All" means every row matching the
   * filter, on every page, not just the 25 on screen. The accessible name is
   * kept from the last sprint so existing tests still find the checkbox. */
  var selectable = ordered.filter(isSelectable);
  var allSelected = selectable.length > 0 && selectable.every(function (t) {
    return state.selection.indexOf(t.id) !== -1;
  });
  var selectAll = el('input', {
    type: 'checkbox', 'aria-label': 'Select all visible transactions',
    'data-testid': 'select-all',
    onchange: function (ev) {
      var ids = selectable.map(function (t) { return t.id; });
      if (ev.target.checked) {
        ids.forEach(function (id) { if (state.selection.indexOf(id) === -1) state.selection.push(id); });
      } else {
        state.selection = state.selection.filter(function (id) { return ids.indexOf(id) === -1; });
      }
      render();
    }
  });
  if (allSelected) selectAll.setAttribute('checked', '');

  var headRow = el('tr', {}, [
    el('th', { scope: 'col', class: 'col-select' }, [selectAll]),
    sortableHeader({ key: 'id', label: 'Transaction' })
  ]);
  cols.forEach(function (c) { headRow.appendChild(sortableHeader(c)); });
  table.appendChild(el('thead', {}, [headRow]));

  var tbody = el('tbody', {});
  if (state.grouped) {
    var i = 0;
    while (i < rows.length) {
      var empNo = rows[i].employeeNo;
      var segment = [];
      while (i < rows.length && rows[i].employeeNo === empNo) { segment.push(rows[i]); i += 1; }
      var name = segment[0].employeeName;
      var firstOfGroup = ordered.filter(function (t) { return t.employeeNo === empNo; })[0];
      var continued = firstOfGroup.id !== segment[0].id;

      tbody.appendChild(el('tr', { class: 'group-head', 'data-testid': 'group-' + empNo }, [
        el('th', { colspan: cols.length + 2, scope: 'colgroup',
          text: name + ' (' + empNo + ')' + (continued ? ' — continued' : '') })
      ]));
      segment.forEach(function (t) { tbody.appendChild(renderRow(t, cols)); });
      tbody.appendChild(el('tr', { class: 'subtotal-row' }, [
        el('td', { colspan: cols.length + 1, text: 'Subtotal ' + name + ' (' + empNo + ')' }),
        el('td', { class: 'numeric', 'data-testid': 'subtotal-' + empNo,
          text: fmtAmount(subtotalFor(empNo, rows)) })
      ]));
    }
  } else {
    rows.forEach(function (t) { tbody.appendChild(renderRow(t, cols)); });
  }
  table.appendChild(tbody);

  table.appendChild(el('tfoot', {}, [
    el('tr', { class: 'grand-total-row' }, [
      el('td', { colspan: cols.length + 1, text: 'Grand total' }),
      el('td', { class: 'numeric', 'data-testid': 'grand-total', text: fmtAmount(grandTotal()) })
    ])
  ]));

  box.appendChild(table);
  box.appendChild(renderPager(ordered.length));
  return box;
}

/* FR-14: the active sort is shown in the header (arrow + aria-sort). The button
 * carries no aria-label, so the column header's accessible name stays exactly
 * the column name. */
function sortableHeader(c) {
  var active = state.sort.key === c.key;
  var arrow = active ? (state.sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return el('th', {
    scope: 'col', class: c.numeric ? 'numeric' : null,
    'aria-sort': active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : null
  }, [
    el('button', {
      class: 'sort-btn' + (active ? ' is-sorted' : ''), type: 'button',
      'data-testid': 'sort-' + c.key,
      onclick: function () { cycleSort(c.key); }
    }, [
      c.label,
      el('span', { class: 'sort-arrow', 'aria-hidden': 'true', text: arrow })
    ])
  ]);
}

function cycleSort(key) {
  if (state.sort.key !== key) state.sort = { key: key, dir: 'asc' };
  else if (state.sort.dir === 'asc') state.sort = { key: key, dir: 'desc' };
  else state.sort = { key: null, dir: 'asc' };
  state.page = 1;
  render();
}

function renderPager(total) {
  var pages = pageCount(total);
  var start = (state.page - 1) * state.pageSize + 1;
  var end = Math.min(total, state.page * state.pageSize);
  /* Page size is a group of buttons rather than a <select>: the column picker
   * replaces the filter toolbar precisely so no select is on screen while it is
   * open, and a Part 1 locator check asserts exactly that. */
  var sizes = el('div', { class: 'page-sizes', role: 'group', 'aria-labelledby': 'page-size-label',
    'data-testid': 'page-size' }, [
    el('span', { id: 'page-size-label', class: 'muted', text: 'Rows per page' })
  ].concat(PAGE_SIZES.map(function (n) {
    return el('button', {
      class: 'tiny' + (state.pageSize === n ? ' is-current' : ''), type: 'button',
      'aria-pressed': state.pageSize === n ? 'true' : 'false',
      'data-testid': 'page-size-' + n,
      onclick: function () { state.pageSize = n; state.page = 1; render(); },
      text: String(n)
    });
  })));
  return el('div', { class: 'pager', 'data-testid': 'pager' }, [
    sizes,
    el('span', { class: 'page-range', 'data-testid': 'page-range',
      text: 'Rows ' + start + '–' + end + ' of ' + total }),
    el('button', {
      class: 'secondary', 'data-testid': 'page-prev', disabled: state.page <= 1,
      onclick: function () { state.page -= 1; render(); }, text: 'Previous page'
    }),
    el('span', { 'data-testid': 'page-indicator', text: 'Page ' + state.page + ' of ' + pages }),
    el('button', {
      class: 'secondary', 'data-testid': 'page-next', disabled: state.page >= pages,
      onclick: function () { state.page += 1; render(); }, text: 'Next page'
    })
  ]);
}

function renderRow(t, cols) {
  var selected = state.selection.indexOf(t.id) !== -1;
  var canSelect = isSelectable(t);
  var reason = isBlocking(t) ? 'blocking error' : 'rejected';

  var cb = el('input', {
    type: 'checkbox',
    'aria-label': canSelect ? 'Select transaction ' + t.id : 'Cannot select ' + t.id + ' - ' + reason,
    'data-testid': 'select-' + t.id,
    disabled: !canSelect,
    onchange: function (ev) {
      if (ev.target.checked) state.selection.push(t.id);
      else state.selection = state.selection.filter(function (id) { return id !== t.id; });
      render();
    }
  });
  if (selected) cb.setAttribute('checked', '');

  var tr = el('tr', {
    class: 'tx-row' + (selected ? ' is-selected' : ''),
    'data-testid': 'row-' + t.id,
    'data-transaction-id': t.id,
    onclick: function (ev) {
      var tag = ev.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'label' || tag === 'button' || tag === 'textarea') return;
      if (ev.target.closest && ev.target.closest('.edit-box')) return;
      openDetail(t.id);
    }
  }, [
    el('td', { class: 'col-select', 'data-label': '' }, [cb]),
    el('td', { 'data-label': 'Transaction' }, [
      el('button', {
        class: 'link tx-id', 'data-testid': 'open-' + t.id,
        'aria-label': 'Open details for ' + t.id,
        onclick: function (ev) { ev.stopPropagation(); openDetail(t.id); },
        text: t.id
      })
    ])
  ]);

  cols.forEach(function (c) {
    var cell;
    if (c.key === 'amount') {
      cell = renderAmountCell(t, c);
    } else if (c.key === 'status') {
      cell = el('td', { 'data-label': c.label }, [statusPill(t, 'status-' + t.id)]);
    } else if (c.key === 'period') {
      cell = el('td', { 'data-label': c.label }, [
        t.period,
        t.retroOf ? el('span', {
          class: 'retro-tag', 'data-testid': 'retro-' + t.id,
          title: 'Retroactive correction for ' + t.retroOf.label,
          text: '↺ RETRO'
        }) : null
      ]);
    } else {
      var value = t[c.key];
      cell = el('td', { 'data-label': c.label, text: (value === '' ? '—' : value) });
    }
    tr.appendChild(cell);
  });
  return tr;
}

/* ---- inline amount edit (FR-11) ---- */

function renderAmountCell(t, c) {
  if (state.editingId === t.id) {
    var input = el('input', {
      type: 'text', class: 'edit-input', inputmode: 'decimal',
      'aria-label': 'Edit value for ' + t.id, 'data-testid': 'edit-input-' + t.id,
      value: state.editInput,
      oninput: function (ev) { state.editInput = ev.target.value; },
      onkeydown: function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); saveEdit(t); }
        if (ev.key === 'Escape') { cancelEdit(); }
      }
    });
    return el('td', { class: 'numeric', 'data-label': c.label }, [
      el('div', { class: 'edit-box' }, [
        input,
        el('button', { class: 'primary tiny-btn', 'data-testid': 'edit-save-' + t.id,
          onclick: function (ev) { ev.stopPropagation(); saveEdit(t); }, text: 'Save' }),
        el('button', { class: 'link', 'data-testid': 'edit-cancel-' + t.id,
          onclick: function (ev) { ev.stopPropagation(); cancelEdit(); }, text: 'Cancel edit' }),
        state.editError ? el('span', { class: 'field-error', role: 'alert',
          'data-testid': 'edit-error', text: state.editError }) : null
      ])
    ]);
  }
  return el('td', { class: 'numeric', 'data-label': c.label }, [
    el('span', { class: 'amount', 'data-testid': 'amount-' + t.id, text: fmtAmount(t.amount) }),
    isEditable(t) ? el('button', {
      class: 'link edit-btn', 'aria-label': 'Edit ' + t.id, 'data-testid': 'edit-' + t.id,
      onclick: function (ev) {
        ev.stopPropagation();
        state.editingId = t.id;
        state.editInput = fmtAmount(t.amount);
        state.editError = '';
        render();
        var node = document.querySelector('[data-testid="edit-input-' + t.id + '"]');
        if (node) { node.focus(); node.select(); }
      },
      text: 'Edit'
    }) : null
  ]);
}

function saveEdit(t) {
  var cents = parseNorwegianAmount(state.editInput);
  if (cents === null) {
    state.editError = 'Use the Norwegian format with two decimals, for example 1 234,50.';
    render();
    return;
  }
  if (cents <= 0 && !t.retroOf) {
    state.editError = 'The amount must be above zero.';
    render();
    return;
  }
  var before = t.amount;
  t.amount = cents;
  if (before !== cents) {
    t.audit.events.push('Amount changed by ' + state.user + ' on ' + demoNow() + ': ' +
      fmtAmount(before) + ' → ' + fmtAmount(cents));
  }
  state.editingId = null;
  state.editError = '';
  state.message = 'Amount for ' + t.id + ' is now ' + fmtAmount(cents) + '.';
  render();
}

function cancelEdit() {
  state.editingId = null;
  state.editError = '';
  render();
}

/* ---- detail panel ---- */

function openDetail(id) {
  state.detailId = id;
  state.rejectOpen = false;
  state.rejectReason = '';
  state.rejectError = '';
  render();
  var panel = document.querySelector('[data-testid="detail-panel"]');
  if (panel) panel.focus();
}

function renderDetail() {
  var t = txById(state.detailId);
  if (!t) return el('div');

  var panel = el('aside', {
    class: 'card detail', 'data-testid': 'detail-panel', tabindex: '-1',
    role: 'complementary', 'aria-labelledby': 'detail-heading'
  });

  panel.appendChild(el('div', { class: 'detail-head' }, [
    el('h2', { id: 'detail-heading', text: t.id }),
    el('button', {
      class: 'link', 'aria-label': 'Close detail panel', 'data-testid': 'close-detail',
      onclick: function () { state.detailId = null; render(); }, text: '×'
    })
  ]));

  function row(label, value) {
    return el('div', { class: 'detail-row' }, [
      el('span', { class: 'detail-label', text: label }),
      el('span', { class: 'detail-value' }, [value])
    ]);
  }

  panel.appendChild(el('div', { class: 'detail-grid' }, [
    row('Employee', t.employeeName + ' (' + t.employeeNo + ')'),
    row('Transaction type', t.type),
    row('Period', t.period),
    row('Amount', fmtAmount(t.amount)),
    row('Cost center', t.costCenter),
    row('Project code', t.projectCode === '' ? '—' : t.projectCode),
    row('Account', t.account),
    row('Status', statusPill(t, 'detail-status'))
  ]));

  if (t.status === 'Rejected') {
    panel.appendChild(el('div', { class: 'detail-block rejection-block',
      'data-testid': 'detail-rejection' }, [
      el('h3', { text: 'Rejected' }),
      el('p', {}, [
        el('span', { class: 'detail-label', text: 'Reason: ' }),
        el('span', { 'data-testid': 'rejection-reason', text: t.rejectReason || '—' })
      ])
    ]));
  }

  if (t.retroOf) {
    panel.appendChild(el('div', { class: 'detail-block retro-block', 'data-testid': 'detail-retro' }, [
      el('h3', { text: '↺ Retroactive correction' }),
      el('p', { text: 'This is a back-dated correction for ' + t.retroOf.label + '.' }),
      el('p', {}, [
        el('span', { text: 'Corrects transaction ' }),
        el('a', { href: '#', 'data-testid': 'retro-original',
          onclick: function (ev) { ev.preventDefault(); }, text: t.retroOf.id }),
        el('span', { text: ' in the ' + t.retroOf.label + ' run.' })
      ])
    ]));
  }

  if (t.error && t.status === 'Error') {
    var severityLine = (t.severity === 'blocking')
      ? 'This error blocks payment. It must be fixed before the run can be paid.'
      : 'This is a warning. Payment can still go ahead, but it will be flagged.';
    panel.appendChild(el('div', {
      class: 'detail-block error-block severity-' + t.severity, 'data-testid': 'detail-error'
    }, [
      el('h3', { text: t.severity === 'blocking' ? 'Blocking error' : 'Warning' }),
      el('p', { 'data-testid': 'error-reason', text: t.error.reason }),
      el('p', { class: 'severity-line', 'data-testid': 'error-severity', text: severityLine }),
      el('div', { class: 'rule-vs-actual', 'data-testid': 'rule-vs-actual' }, [
        el('div', {}, [el('h4', { text: 'Rule' }),
          el('p', { 'data-testid': 'error-rule', text: t.error.rule })]),
        el('div', {}, [el('h4', { text: 'Actual' }),
          el('p', { 'data-testid': 'error-actual', text: t.error.actual })])
      ]),
      el('p', {}, [
        el('a', {
          href: '#', 'data-testid': 'error-fix-link',
          onclick: function (ev) {
            ev.preventDefault();
            state.message = 'In the real product this opens: ' + t.error.fixLabel;
            render();
          },
          text: t.error.fixLabel
        })
      ])
    ]));
  }

  if (t.status === 'Pending') panel.appendChild(renderRejectBlock(t));

  var history = [
    el('li', { text: 'Created by ' + t.audit.createdBy + ' on ' + t.audit.createdAt }),
    t.audit.changedBy
      ? el('li', { text: 'Changed by ' + t.audit.changedBy + ' on ' + t.audit.changedAt })
      : (t.audit.events.length ? null : el('li', { text: 'Not changed since it was created' }))
  ].concat(t.audit.events.map(function (e) { return el('li', { text: e }); }));

  panel.appendChild(el('div', { class: 'detail-block', 'data-testid': 'detail-audit' }, [
    el('h3', { text: 'History' }),
    el('ul', { class: 'audit' }, history)
  ]));

  return panel;
}

/* ---- reject with reason (FR-12) ---- */

function renderRejectBlock(t) {
  var block = el('div', { class: 'detail-block reject-block', 'data-testid': 'reject-block' });
  if (!state.rejectOpen) {
    block.appendChild(el('button', {
      class: 'secondary', 'data-testid': 'reject-open',
      onclick: function () {
        state.rejectOpen = true;
        state.rejectReason = '';
        state.rejectError = '';
        render();
        var box = document.querySelector('[data-testid="reject-reason"]');
        if (box) box.focus();
      },
      text: 'Reject transaction'
    }));
    return block;
  }
  var area = el('textarea', {
    id: 'reject-reason', rows: '3', 'data-testid': 'reject-reason',
    oninput: function (ev) { state.rejectReason = ev.target.value; }
  });
  area.value = state.rejectReason;
  block.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'reject-reason', text: 'Reason for rejection' }),
    area,
    el('span', { class: 'muted hint', text: 'At least 10 characters.' })
  ]));
  if (state.rejectError) {
    block.appendChild(el('p', { class: 'field-error', role: 'alert', 'data-testid': 'reject-error',
      text: state.rejectError }));
  }
  block.appendChild(el('div', { class: 'modal-actions' }, [
    el('button', { class: 'primary', 'data-testid': 'reject-confirm',
      onclick: function () { doReject(t); }, text: 'Confirm rejection' }),
    el('button', { class: 'link', 'data-testid': 'reject-cancel',
      onclick: function () { state.rejectOpen = false; render(); }, text: 'Cancel rejection' })
  ]));
  return block;
}

function doReject(t) {
  var reason = state.rejectReason.trim();
  if (reason.length > 0 && reason.length < 10) {
    state.rejectError = 'The reason must be at least 10 characters.';
    render();
    return;
  }
  t.status = 'Rejected';
  t.severity = null;
  t.rejectReason = reason;
  t.audit.events.push('Rejected by ' + state.user + ' on ' + demoNow());
  state.selection = state.selection.filter(function (id) { return id !== t.id; });
  state.rejectOpen = false;
  state.rejectError = '';
  state.message = t.id + ' rejected.';
  render();
}

/* ---- export (FR-9): the current view - columns, filter, grouping, all pages ---- */

function exportToExcel() {
  var ordered = orderedTransactions();
  var cols = visibleColumns();
  var amountAt = -1;
  cols.forEach(function (c, i) { if (c.key === 'amount') amountAt = i + 1; });
  var width = cols.length + 1;
  var totalAt = amountAt >= 0 ? amountAt : width;

  function cellFor(t, c) {
    if (c.key === 'amount') return { v: t.amount / 100, num: true };
    var v = t[c.key];
    return { v: v === '' ? '' : v };
  }
  function totalRow(label, cents) {
    var r = [{ v: label, bold: true }];
    for (var i = 1; i <= totalAt; i++) r.push(null);
    r[totalAt] = { v: cents / 100, num: true, bold: true };
    return r;
  }
  function txRow(t) {
    return [{ v: t.id + (t.retroOf ? ' (retro)' : '') }].concat(cols.map(function (c) { return cellFor(t, c); }));
  }

  var sheet = [[{ v: 'Transaction', bold: true }].concat(cols.map(function (c) {
    return { v: c.label, bold: true };
  }))];

  if (state.grouped) {
    var seen = [];
    ordered.forEach(function (t) { if (seen.indexOf(t.employeeNo) === -1) seen.push(t.employeeNo); });
    seen.forEach(function (empNo) {
      var empRows = ordered.filter(function (t) { return t.employeeNo === empNo; });
      var label = empRows[0].employeeName + ' (' + empNo + ')';
      sheet.push([{ v: label, bold: true }]);
      empRows.forEach(function (t) { sheet.push(txRow(t)); });
      sheet.push(totalRow('Subtotal ' + label, sumAmounts(empRows)));
    });
  } else {
    ordered.forEach(function (t) { sheet.push(txRow(t)); });
  }
  sheet.push(totalRow('Grand total', grandTotal()));

  var fileName = 'transactions-' + state.runId + '.xlsx';
  var blob = window.buildXlsx(runById(state.runId).label, sheet);
  var url = URL.createObjectURL(blob);
  var a = el('a', { href: url, download: fileName, class: 'sr-only' });
  document.body.appendChild(a);
  a.click();
  window.setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);

  state.message = 'Exported ' + ordered.length + ' transactions to ' + fileName + '.';
  render();
}

/* ------------------------------------------------- loading + filter changes */

var loadingTimer = null;
var searchTimer = null;

/* NFR-2: clear loading feedback. Fixed 800 ms, as in the last sprint. */
function applyFilterChange() {
  state.selection = [];
  state.message = '';
  state.page = 1;
  state.loading = true;
  render();
  if (loadingTimer) window.clearTimeout(loadingTimer);
  loadingTimer = window.setTimeout(function () {
    state.loading = false;
    render();
  }, 800);
}

function scheduleSearch() {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(function () {
    state.filters.search = state.searchInput.trim();
    applyFilterChange();
  }, 300);
}

function cancelSearch() {
  if (searchTimer) { window.clearTimeout(searchTimer); searchTimer = null; }
}

function clearAllFilters() {
  cancelSearch();
  state.filters = emptyFilters();
  state.searchInput = '';
}

function resetFilters() {
  clearAllFilters();
  state.periodScope = 'all';
}

/* -------------------------------------------------------------------- boot */

loadSession();
if (state.signedIn) loadUserSettings();
render();
