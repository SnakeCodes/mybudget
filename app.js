const STORAGE_KEY = 'mybudget-items-v1';

const state = {
  startingBalance: 0,
  items: [],
  view: 'table',
};

const els = {
  startingBalance: document.querySelector('#startingBalance'),
  monthlyIncome: document.querySelector('#monthlyIncome'),
  monthlyExpenses: document.querySelector('#monthlyExpenses'),
  projectedBalance: document.querySelector('#projectedBalance'),
  headerBalance: document.querySelector('#headerBalance'),
  netTotal: document.querySelector('#netTotal'),
  incomeTotal: document.querySelector('#incomeTotal'),
  expenseTotal: document.querySelector('#expenseTotal'),
  itemsTableBody: document.querySelector('#itemsTableBody'),
  budgetChart: document.querySelector('#budgetChart'),
  tableView: document.querySelector('#tableView'),
  graphView: document.querySelector('#graphView'),
  incomeForm: document.querySelector('#incomeForm'),
  expenseForm: document.querySelector('#expenseForm'),
  modeButtons: document.querySelectorAll('.mode-toggle'),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) {
      state.items = parsed.items;
    }
    if (typeof parsed.startingBalance === 'number') {
      state.startingBalance = parsed.startingBalance;
    }
  } catch (error) {
    console.warn('Could not read saved budget data:', error);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      items: state.items,
      startingBalance: state.startingBalance,
    })
  );
}

function currency(value) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function getMonthlyTotals() {
  return state.items.reduce(
    (totals, item) => {
      const amount = Number(item.amount) || 0;
      if (item.type === 'income') {
        if (item.kind === 'regular') {
          totals.income += amount;
        } else {
          totals.oneOffIncome += amount;
        }
      } else if (item.kind === 'regular') {
        totals.expenses += amount;
      } else {
        totals.oneOffExpenses += amount;
      }
      return totals;
    },
    { income: 0, expenses: 0, oneOffIncome: 0, oneOffExpenses: 0 }
  );
}

function getMetrics() {
  const totals = getMonthlyTotals();
  const currentBalance = state.startingBalance + totals.oneOffIncome - totals.oneOffExpenses + totals.income - totals.expenses;
  const monthlyNet = totals.income - totals.expenses;
  const projectedBalance = currentBalance + monthlyNet * 12;

  return {
    currentBalance,
    monthlyIncome: totals.income,
    monthlyExpenses: totals.expenses,
    projectedBalance,
    incomeTotal: totals.income + totals.oneOffIncome,
    expenseTotal: totals.expenses + totals.oneOffExpenses,
    netTotal: currentBalance,
  };
}

function renderSummary() {
  const metrics = getMetrics();

  els.startingBalance.value = String(state.startingBalance);
  els.monthlyIncome.textContent = currency(metrics.monthlyIncome);
  els.monthlyExpenses.textContent = currency(metrics.monthlyExpenses);
  els.projectedBalance.textContent = currency(metrics.projectedBalance);
  els.headerBalance.textContent = currency(metrics.currentBalance);
  els.netTotal.textContent = currency(metrics.netTotal);
  els.incomeTotal.textContent = currency(metrics.incomeTotal);
  els.expenseTotal.textContent = currency(metrics.expenseTotal);
}

function renderTable() {
  if (!state.items.length) {
    els.itemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">No budget items yet. Add your first income or expense.</td>
      </tr>
    `;
    return;
  }

  els.itemsTableBody.innerHTML = state.items
    .map((item) => {
      const amountClass = item.type === 'income' ? 'amount-income' : 'amount-expense';
      const amountText = `${item.type === 'income' ? '+' : '-'}${currency(Number(item.amount))}`;
      const dateText = item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) : '—';

      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.type === 'income' ? 'Income' : 'Expense'}</td>
          <td>${item.kind === 'regular' ? 'Regular' : 'One-off'}</td>
          <td class="${amountClass}">${amountText}</td>
          <td>${dateText}</td>
          <td><button class="delete-btn" type="button" data-id="${item.id}">Delete</button></td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      const itemId = event.currentTarget.getAttribute('data-id');
      state.items = state.items.filter((item) => item.id !== itemId);
      saveState();
      render();
    });
  });
}

function buildChartPath(values) {
  const width = 620;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(1, maxValue - minValue);

  return values
    .map((value, index) => {
      const x = padding.left + (index / (values.length - 1)) * (width - padding.left - padding.right);
      const y = height - padding.bottom - ((value - minValue) / range) * (height - padding.top - padding.bottom);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function renderGraph() {
  const months = 12;
  const metrics = getMetrics();
  const monthlyNet = metrics.monthlyIncome - metrics.monthlyExpenses;
  const values = Array.from({ length: months + 1 }, (_, index) => metrics.currentBalance + monthlyNet * index);
  const width = 620;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = Math.max(1, maxValue - minValue);

  const labels = Array.from({ length: 13 }, (_, index) => {
    const x = padding.left + (index / 12) * (width - padding.left - padding.right);
    const label = index === 0 ? 'Now' : `+${index}m`;
    return `<text class="axis-label" x="${x}" y="${height - 12}" text-anchor="middle">${label}</text>`;
  }).join('');

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * (height - padding.top - padding.bottom);
    const value = maxValue - ratio * range;
    return `
      <line class="grid-line" x1="${padding.left}" x2="${width - padding.right}" y1="${y}" y2="${y}" />
      <text class="axis-label" x="8" y="${y + 4}">${currency(value)}</text>
    `;
  }).join('');

  const points = values
    .map((value, index) => {
      const x = padding.left + (index / (values.length - 1)) * (width - padding.left - padding.right);
      const y = height - padding.bottom - ((value - minValue) / range) * (height - padding.top - padding.bottom);
      return { x, y, value };
    });

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const dots = points
    .map((point) => `<circle class="balance-dot" cx="${point.x}" cy="${point.y}" r="4" />`)
    .join('');

  els.budgetChart.innerHTML = `
    <line class="axis-line" x1="${padding.left}" x2="${width - padding.right}" y1="${height - padding.bottom}" y2="${height - padding.bottom}" />
    <line class="axis-line" x1="${padding.left}" x2="${padding.left}" y1="${padding.top}" y2="${height - padding.bottom}" />
    ${gridLines}
    <path class="balance-line" d="${line}" />
    ${dots}
    ${labels}
  `;
}

function renderView() {
  const showTable = state.view === 'table';
  els.tableView.classList.toggle('active', showTable);
  els.graphView.classList.toggle('active', !showTable);

  els.modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === state.view);
  });
}

function addItem(type, form) {
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const amount = Number(formData.get('amount'));
  const kind = formData.get('kind');
  const dateValue = String(formData.get('date') || '').trim();

  if (!name || Number.isNaN(amount) || amount <= 0) {
    return;
  }

  const item = {
    id: crypto.randomUUID(),
    name,
    amount,
    type,
    kind,
    date: dateValue,
  };

  state.items.push(item);
  saveState();
  form.reset();
  render();
}

function render() {
  renderSummary();
  renderTable();
  renderGraph();
  renderView();
}

function initialize() {
  loadState();
  els.startingBalance.addEventListener('input', (event) => {
    const value = Number(event.target.value || 0);
    state.startingBalance = Number.isFinite(value) ? value : 0;
    saveState();
    renderSummary();
    renderGraph();
  });

  els.incomeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addItem('income', event.currentTarget);
  });

  els.expenseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addItem('expense', event.currentTarget);
  });

  els.modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderView();
    });
  });

  render();
}

initialize();
