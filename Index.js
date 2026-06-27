const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/bfhl', (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: "Data must be an array of strings"
      });
    }

    const payload = {
      user_id: "rajat_27062026",
      email_id: "rajat.college@college.edu",
      college_roll_number: "21CS1001",
      hierarchies: [],
      invalid_entries: [],
      duplicate_edges: [],
      summary: {
        total_trees: 0,
        total_cycles: 0,
        largest_tree_root: ""
      }
    };

    const parsedEdges = [];
    const uniquePairs = new Set();
    const parentOf = new Map();
    const duplicates = new Set();

    for (const item of data) {
      if (typeof item !== 'string') {
        payload.invalid_entries.push(String(item));
        continue;
      }

      const val = item.trim();
      const parts = val.match(/^([A-Z])->([A-Z])$/);
      
      if (!parts) {
        payload.invalid_entries.push(val);
        continue;
      }

      const p = parts[1];
      const c = parts[2];

      if (p === c) {
        payload.invalid_entries.push(val);
        continue;
      }

      const pairKey = `${p}->${c}`;

      if (uniquePairs.has(pairKey)) {
        if (!duplicates.has(pairKey)) {
          duplicates.add(pairKey);
          payload.duplicate_edges.push(pairKey);
        }
        continue;
      }

      if (parentOf.has(c)) {
        continue;
      }

      uniquePairs.add(pairKey);
      parentOf.set(c, p);
      parsedEdges.push({ from: p, to: c });
    }

    const nodes = new Set();
    const graphMap = new Map();
    const outList = new Map();

    for (const edge of parsedEdges) {
      nodes.add(edge.from);
      nodes.add(edge.to);

      if (!graphMap.has(edge.from)) graphMap.set(edge.from, []);
      if (!graphMap.has(edge.to)) graphMap.set(edge.to, []);
      graphMap.get(edge.from).push(edge.to);
      graphMap.get(edge.to).push(edge.from);

      if (!outList.has(edge.from)) outList.set(edge.from, []);
      outList.get(edge.from).push(edge.to);
    }

    const seenNodes = new Set();
    const components = [];

    const traverse = (node, group) => {
      seenNodes.add(node);
      group.push(node);
      const neighbors = graphMap.get(node) || [];
      for (const next of neighbors) {
        if (!seenNodes.has(next)) {
          traverse(next, group);
        }
      }
    };

    for (const edge of parsedEdges) {
      if (!seenNodes.has(edge.from)) {
        const group = [];
        traverse(edge.from, group);
        components.push(group);
      }
    }

    let topDepth = -1;
    let bigRoot = "";

    for (const comp of components) {
      const roots = comp.filter(n => !parentOf.has(n));

      if (roots.length === 0) {
        comp.sort();
        const cycleRoot = comp[0];
        payload.hierarchies.push({
          root: cycleRoot,
          tree: {},
          has_cycle: true
        });
        payload.summary.total_cycles++;
      } else {
        const treeRoot = roots[0];

        const build = (curr) => {
          const obj = {};
          const subs = outList.get(curr) || [];
          subs.sort();
          for (const s of subs) {
            obj[s] = build(s);
          }
          return obj;
        };

        const depth = (curr) => {
          const subs = outList.get(curr) || [];
          if (subs.length === 0) return 1;
          let maxVal = 0;
          for (const s of subs) {
            maxVal = Math.max(maxVal, depth(s));
          }
          return 1 + maxVal;
        };

        const dVal = depth(treeRoot);
        payload.hierarchies.push({
          root: treeRoot,
          tree: { [treeRoot]: build(treeRoot) },
          depth: dVal
        });

        payload.summary.total_trees++;

        if (dVal > topDepth) {
          topDepth = dVal;
          bigRoot = treeRoot;
        } else if (dVal === topDepth) {
          if (!bigRoot || treeRoot < bigRoot) {
            bigRoot = treeRoot;
          }
        }
      }
    }

    payload.summary.largest_tree_root = bigRoot;
    return res.status(200).json(payload);

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Server Error"
    });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

module.exports = app;
