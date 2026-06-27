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

document.addEventListener('DOMContentLoaded', function() {
  const inputVal = document.getElementById('edges-input');
  const submitBtn = document.getElementById('btn-submit');
  const clearBtn = document.getElementById('btn-clear');
  const errText = document.getElementById('error-message');
  
  const resultsDiv = document.getElementById('results-section');
  const treeStat = document.getElementById('stat-trees');
  const cycleStat = document.getElementById('stat-cycles');
  const largestStat = document.getElementById('stat-largest');
  
  const hierarchyContainer = document.getElementById('hierarchies-list');
  const invalidContainer = document.getElementById('invalid-list');
  const duplicateContainer = document.getElementById('duplicate-list');
  const rawCode = document.getElementById('json-raw');

  loadPreset('challenge');

  document.querySelectorAll('.preset-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      loadPreset(btn.dataset.preset);
    });
  });

  function loadPreset(name) {
    if (presets[name]) {
      inputVal.value = JSON.stringify(presets[name], null, 2);
      errText.textContent = "";
    }
  }

  clearBtn.addEventListener('click', function() {
    inputVal.value = "";
    errText.textContent = "";
  });

  function getEdges() {
    const rawText = inputVal.value.trim();
    if (!rawText) return [];

    if (rawText.startsWith('[') && rawText.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }

    return rawText.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  }

  submitBtn.addEventListener('click', function() {
    const list = getEdges();
    if (list.length === 0) {
      errText.textContent = "Please input some edges first.";
      return;
    }

    errText.textContent = "";

    fetch('/bfhl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: list })
    })
    .then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok) {
          throw new Error(data.error || "Server error occurred.");
        }
        return data;
      });
    })
    .then(function(resData) {
      showData(resData);
    })
    .catch(function(err) {
      errText.textContent = err.message || "Failed to contact API.";
    });
  });

  function showData(res) {
    rawCode.textContent = JSON.stringify(res, null, 2);
    resultsDiv.classList.remove('hidden');

    treeStat.textContent = res.summary.total_trees;
    cycleStat.textContent = res.summary.total_cycles;
    largestStat.textContent = res.summary.largest_tree_root || "None";

    hierarchyContainer.innerHTML = "";
    if (res.hierarchies && res.hierarchies.length > 0) {
      res.hierarchies.forEach(function(h) {
        const item = document.createElement('div');
        item.className = "hierarchy-item";

        const label = h.has_cycle ? "Cycle" : "Tree, Depth: " + h.depth;
        item.innerHTML = `
          <div class="hierarchy-header">
            <span>Root: <strong>${h.root}</strong></span>
            <span>Type: <em>${label}</em></span>
          </div>
          <div class="tree-view"></div>
        `;

        const view = item.querySelector('.tree-view');
        if (h.has_cycle) {
          view.innerHTML = "<p style='color: #b45309; margin: 0;'>Cycle detected (tree empty)</p>";
        } else {
          const rootUl = document.createElement('ul');
          rootUl.appendChild(renderNode(h.root, h.tree[h.root]));
          view.appendChild(rootUl);
        }

        hierarchyContainer.appendChild(item);
      });
    } else {
      hierarchyContainer.innerHTML = "<p>No hierarchies generated.</p>";
    }

    invalidContainer.innerHTML = "";
    if (res.invalid_entries && res.invalid_entries.length > 0) {
      res.invalid_entries.forEach(function(val) {
        const li = document.createElement('li');
        li.textContent = val;
        invalidContainer.appendChild(li);
      });
    } else {
      invalidContainer.innerHTML = "<li>None</li>";
    }

    duplicateContainer.innerHTML = "";
    if (res.duplicate_edges && res.duplicate_edges.length > 0) {
      res.duplicate_edges.forEach(function(val) {
        const li = document.createElement('li');
        li.textContent = val;
        duplicateContainer.appendChild(li);
      });
    } else {
      duplicateContainer.innerHTML = "<li>None</li>";
    }
  }

  function renderNode(name, nodeObj) {
    const li = document.createElement('li');
    li.textContent = name;

    const children = Object.keys(nodeObj || {});
    if (children.length > 0) {
      const ul = document.createElement('ul');
      children.forEach(function(child) {
        ul.appendChild(renderNode(child, nodeObj[child]));
      });
      li.appendChild(ul);
    }
    return li;
  }
});
