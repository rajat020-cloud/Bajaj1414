const presets = {
  challenge: [
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->"
  ],
  diamond: [
    "A->B", "A->C", "B->D", "C->D", "D->E"
  ],
  cycle: [
    "M->N", "N->O", "O->M"
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  const inputArea = document.getElementById('edges-input');
  const fmtBtn = document.getElementById('btn-format');
  const clearBtn = document.getElementById('btn-clear');
  const submitBtn = document.getElementById('btn-submit');
  const spinner = document.getElementById('submit-spinner');
  const errBox = document.getElementById('error-banner');
  const errMsg = document.getElementById('error-message');
  
  const emptyView = document.getElementById('visual-empty');
  const resultsView = document.getElementById('visual-results');
  
  const treeStat = document.getElementById('stat-trees');
  const cycleStat = document.getElementById('stat-cycles');
  const largestStat = document.getElementById('stat-largest-root');
  
  const outputContainer = document.getElementById('hierarchies-container');
  const invalidCount = document.getElementById('count-invalid');
  const invalidList = document.getElementById('invalid-entries-list');
  const duplicateCount = document.getElementById('count-duplicates');
  const duplicateList = document.getElementById('duplicate-edges-list');
  
  const codePre = document.getElementById('json-output');
  const copyBtn = document.getElementById('btn-copy-json');
  const creds = document.getElementById('header-credentials');

  loadPreset('challenge');

  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
      });
      document.getElementById(`tab-${target}`).classList.remove('hidden');
    });
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPreset(btn.dataset.preset);
    });
  });

  function loadPreset(name) {
    if (presets[name]) {
      inputArea.value = JSON.stringify(presets[name], null, 2);
      hideErr();
    }
  }

  fmtBtn.addEventListener('click', () => {
    try {
      const data = extractInput();
      inputArea.value = JSON.stringify(data, null, 2);
      hideErr();
    } catch (e) {
      showErr("Invalid format");
    }
  });

  clearBtn.addEventListener('click', () => {
    inputArea.value = '';
    inputArea.focus();
    hideErr();
  });

  function extractInput() {
    const text = inputArea.value.trim();
    if (!text) return [];

    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        const out = JSON.parse(text);
        if (Array.isArray(out)) return out;
      } catch (e) {}
    }

    return text.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
  }

  submitBtn.addEventListener('click', async () => {
    const list = extractInput();
    if (list.length === 0) {
      showErr("Input edges first");
      return;
    }

    hideErr();
    submitBtn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const req = await fetch('/bfhl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: list })
      });

      const res = await req.json();

      if (!req.ok) {
        throw new Error(res.error || "Request failed");
      }

      drawResults(res);
    } catch (err) {
      showErr(err.message || "Failed to call API");
    } finally {
      submitBtn.disabled = false;
      spinner.classList.add('hidden');
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codePre.textContent).then(() => {
      const old = copyBtn.innerHTML;
      copyBtn.innerHTML = "Copied!";
      setTimeout(() => { copyBtn.innerHTML = old; }, 2000);
    });
  });

  function showErr(text) {
    errMsg.textContent = text;
    errBox.classList.remove('hidden');
  }

  function hideErr() {
    errBox.classList.add('hidden');
  }

  function drawResults(res) {
    if (res.user_id) {
      creds.innerHTML = `
        <span class="user-id-badge"><i class="fa-solid fa-user"></i> ${res.user_id}</span>
        <span class="roll-badge"><i class="fa-solid fa-id-card"></i> ${res.college_roll_number}</span>
      `;
    }

    codePre.textContent = JSON.stringify(res, null, 2);
    emptyView.classList.add('hidden');
    resultsView.classList.remove('hidden');

    treeStat.textContent = res.summary.total_trees;
    cycleStat.textContent = res.summary.total_cycles;
    
    if (res.summary.largest_tree_root) {
      const found = res.hierarchies.find(h => h.root === res.summary.largest_tree_root && !h.has_cycle);
      largestStat.innerHTML = `${res.summary.largest_tree_root} <span style="font-size:12px;color:#94a3b8;">(Depth: ${found ? found.depth : 0})</span>`;
    } else {
      largestStat.textContent = '-';
    }

    outputContainer.innerHTML = '';
    
    if (res.hierarchies && res.hierarchies.length > 0) {
      res.hierarchies.forEach(h => {
        const div = document.createElement('div');
        div.className = 'hierarchy-card';

        const isCycle = h.has_cycle;
        const tagText = isCycle ? 'Cycle' : `Tree (Depth: ${h.depth})`;
        const tagClass = isCycle ? 'badge-cycle' : 'badge-tree';

        div.innerHTML = `
          <div class="hierarchy-card-header">
            <span class="root-label">Root: <strong>${h.root}</strong></span>
            <span class="badge-tag ${tagClass}">${tagText}</span>
          </div>
          <div class="hierarchy-body"></div>
        `;

        const body = div.querySelector('.hierarchy-body');

        if (isCycle) {
          body.innerHTML = `<div class="cycle-info-block"><i class="fa-solid fa-circle-exclamation"></i> Contains cycles. Cannot render tree.</div>`;
        } else {
          const vis = document.createElement('div');
          vis.className = 'tree-visualizer';
          vis.appendChild(renderNode(h.root, h.tree[h.root], true));
          body.appendChild(vis);
        }

        outputContainer.appendChild(div);
      });
    }

    invalidList.innerHTML = '';
    invalidCount.textContent = res.invalid_entries.length;
    if (res.invalid_entries.length === 0) {
      invalidList.innerHTML = '<p class="empty-log">None</p>';
    } else {
      res.invalid_entries.forEach(item => {
        const span = document.createElement('span');
        span.className = 'pill-badge badge-invalid';
        span.textContent = item;
        invalidList.appendChild(span);
      });
    }

    duplicateList.innerHTML = '';
    duplicateCount.textContent = res.duplicate_edges.length;
    if (res.duplicate_edges.length === 0) {
      duplicateList.innerHTML = '<p class="empty-log">None</p>';
    } else {
      res.duplicate_edges.forEach(item => {
        const span = document.createElement('span');
        span.className = 'pill-badge badge-duplicate';
        span.textContent = item;
        duplicateList.appendChild(span);
      });
    }
  }

  function renderNode(name, data, isRoot = false) {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node-wrapper';

    const span = document.createElement('span');
    span.className = `tree-node ${isRoot ? 'tree-node-root' : ''}`;
    span.textContent = name;
    wrap.appendChild(span);

    const keys = Object.keys(data || {});
    if (keys.length > 0) {
      const container = document.createElement('div');
      container.className = 'tree-children';
      keys.forEach(k => {
        container.appendChild(renderNode(k, data[k], false));
      });
      wrap.appendChild(container);
    }

    return wrap;
  }
});
