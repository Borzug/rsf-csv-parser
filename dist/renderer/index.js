"use strict";
(() => {
  // src/csvParser.ts
  var COLUMN_ALIASES = {
    stageNum: ["ss"],
    stageName: ["stage name", "stage_name", "stagename"],
    username: ["user name", "username", "user_name", "login", "nick"],
    realName: ["real name", "real_name", "realname", "full name", "driver name"],
    car: ["car name", "car", "vehicle", "car_name"],
    group: ["group", "class", "category"],
    time1: ["time1"],
    time2: ["time2"],
    time3: ["time3"],
    penalty: ["penalty"],
    servicePenalty: ["service penalty", "service_penalty", "servicepenalty"],
    superRally: ["super rally", "super_rally", "superrally", "sr"],
    comment: ["comment", "comments", "note", "notes"]
  };
  function decodeHtmlEntities(str) {
    if (!str || !str.includes("&#")) return str;
    let result = str.replace(
      /&#(\d+);/g,
      (_, code) => String.fromCodePoint(parseInt(code, 10))
    );
    result = result.replace(
      /&#(\d+)(?=[&#]|$)/g,
      (_, code) => String.fromCodePoint(parseInt(code, 10))
    );
    result = result.replace(
      /&#(\d+)/g,
      (_, code) => String.fromCodePoint(parseInt(code, 10))
    );
    return result;
  }
  function detectDelimiter(line) {
    const counts = { ",": 0, ";": 0, "	": 0, "|": 0 };
    for (const ch of line) if (ch in counts) counts[ch]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  function splitRow(row, delimiter) {
    const result = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (!inQuote && (ch === '"' || ch === "'")) {
        inQuote = true;
        quoteChar = ch;
      } else if (inQuote && ch === quoteChar) {
        if (row[i + 1] === quoteChar) {
          current += ch;
          i++;
        } else inQuote = false;
      } else if (!inQuote && ch === delimiter) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
  function parseSecondsOrNull(raw) {
    if (!raw || raw.trim() === "" || raw.trim() === "-") return null;
    const n = parseFloat(raw.trim().replace(",", "."));
    return isNaN(n) ? null : n;
  }
  function parseSecondsOrZero(raw) {
    return parseSecondsOrNull(raw) ?? 0;
  }
  function parseBoolFlag(raw) {
    if (!raw) return false;
    const s = raw.trim();
    return s === "1" || s.toLowerCase() === "true" || s.toLowerCase() === "yes";
  }
  function buildColumnMap(headers) {
    const normalized = headers.map((h) => h.toLowerCase().trim());
    const map = {};
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      for (const alias of aliases) {
        const idx = normalized.indexOf(alias);
        if (idx !== -1 && !(field in map)) {
          map[field] = idx;
          break;
        }
      }
    }
    return map;
  }
  function parseCsvText(raw) {
    let text = raw;
    if (text.charCodeAt(0) === 65279) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) throw new Error("\u0424\u0430\u0439\u043B \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u043E \u0441\u0442\u0440\u043E\u043A");
    const delim = detectDelimiter(lines[0]);
    const colMap = buildColumnMap(splitRow(lines[0], delim));
    const get = (row, field) => {
      const idx = colMap[field];
      return idx !== void 0 && idx < row.length ? row[idx] : void 0;
    };
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const row = splitRow(lines[i], delim);
      if (row.every((c) => c === "")) continue;
      const stageNum = parseInt(get(row, "stageNum") ?? "", 10);
      if (isNaN(stageNum)) continue;
      records.push({
        stageNum,
        stageName: decodeHtmlEntities(get(row, "stageName") ?? `SS${stageNum}`),
        username: decodeHtmlEntities(get(row, "username") ?? `driver_${i}`),
        realName: decodeHtmlEntities(get(row, "realName") ?? ""),
        car: decodeHtmlEntities(get(row, "car") ?? ""),
        comment: decodeHtmlEntities(get(row, "comment") ?? ""),
        group: get(row, "group") ?? "",
        time1: parseSecondsOrNull(get(row, "time1")),
        time2: parseSecondsOrNull(get(row, "time2")),
        time3: parseSecondsOrNull(get(row, "time3")),
        penalty: parseSecondsOrZero(get(row, "penalty")),
        servicePenalty: parseSecondsOrZero(get(row, "servicePenalty")),
        superRally: parseBoolFlag(get(row, "superRally"))
      });
    }
    if (records.length === 0) throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u0444\u0430\u0439\u043B\u0435");
    return buildRallyData(records);
  }
  function buildRallyData(records) {
    const stageMap = /* @__PURE__ */ new Map();
    for (const r of records) {
      if (!stageMap.has(r.stageNum)) stageMap.set(r.stageNum, r.stageName);
    }
    const stages = [...stageMap.entries()].sort((a, b) => a[0] - b[0]).map(([num, name]) => ({ num, name }));
    const driverMap = /* @__PURE__ */ new Map();
    for (const r of records) {
      if (!driverMap.has(r.username)) {
        const realPart = r.realName && r.realName !== r.username ? ` (${r.realName})` : "";
        const carPart = r.car ? ` | ${r.car}` : "";
        driverMap.set(r.username, {
          username: r.username,
          realName: r.realName,
          car: r.car,
          group: r.group,
          label: `${r.username}${realPart}${carPart}`
        });
      }
    }
    const drivers = [...driverMap.values()].sort(
      (a, b) => a.label.localeCompare(b.label, void 0, { sensitivity: "base" })
    );
    const groups = [...new Set(records.map((r) => r.group).filter(Boolean))].sort();
    return { records, stages, drivers, groups };
  }

  // src/renderer/utils.ts
  function formatTime(sec) {
    if (sec === null || isNaN(sec)) return "DNF";
    const a = Math.abs(sec);
    const h = Math.floor(a / 3600);
    const m = Math.floor(a % 3600 / 60);
    const s = Math.floor(a % 60);
    const d = Math.round(a % 1 * 10);
    const sign = sec < 0 ? "-" : "";
    const ss = `${String(s).padStart(2, "0")}.${d}`;
    return h > 0 ? `${sign}${h}:${String(m).padStart(2, "0")}:${ss}` : `${sign}${m}:${ss}`;
  }
  function formatTimeSigned(sec) {
    if (sec === null) return "\u2014";
    return (sec >= 0 ? "+" : "") + formatTime(sec);
  }
  function formatYAxisTick(sec) {
    if (sec === 0) return "0";
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = Math.floor(sec % 60);
    const parts = [];
    if (h) parts.push(`${h}\u0447`);
    if (m) parts.push(`${m}\u043C`);
    if (s) parts.push(`${s}\u0441`);
    return parts.length ? parts.join(" ") : "0";
  }
  function computeYAxisStep(maxSec) {
    if (maxSec <= 0) return 60;
    const target = maxSec / 7;
    const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
    return steps.find((v) => v >= target) ?? 28800;
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function nullableCompare(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  }

  // src/renderer/colors.ts
  var PALETTE = [
    "#e74c3c",
    "#3498db",
    "#2ecc71",
    "#f39c12",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
    "#e91e63",
    "#00bcd4",
    "#8bc34a",
    "#ff5722",
    "#e0d44e",
    "#ff9800",
    "#673ab7",
    "#03a9f4",
    "#4caf50",
    "#ff6d00",
    "#00e5ff",
    "#d500f9",
    "#00bfa5",
    "#ffab40",
    "#76ff03",
    "#b71c1c",
    "#0d47a1",
    "#1b5e20",
    "#880e4f",
    "#e65100",
    "#33691e",
    "#006064",
    "#311b92"
  ];
  function driverColor(index) {
    if (index < PALETTE.length) return PALETTE[index];
    const hue = index * 137.508 % 360;
    const sat = 60 + index % 3 * 10;
    return `hsl(${Math.round(hue)}, ${sat}%, 52%)`;
  }

  // src/renderer/chart/datasets.ts
  var POINT_RADIUS_NORMAL = 2;
  var POINT_RADIUS_FINAL = 3;
  var POINT_RADIUS_COMMENT = 6;
  var POINT_HOVER_RADIUS = 7;
  var BORDER_WIDTH = 1.8;
  var DASH_ON = 6;
  var DASH_OFF = 4;
  function buildDatasets(data2, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, activeDriverKeys, activeGroups, activeCars) {
    return data2.drivers.map((drv, gi) => {
      const color = driverColor(gi);
      const pts = buildDriverPoints(drv, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, color);
      const dnfCommentPtIdx = pts.dnfCommentPtIdx;
      const grpOk = !data2.groups.length || activeGroups.has(drv.group);
      const carOk = !activeCars.size || activeCars.has(drv.car);
      const dn = drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username;
      return {
        label: drv.label,
        driverKey: drv.username,
        _displayName: dn,
        _car: drv.car,
        data: pts.y,
        borderColor: color,
        backgroundColor: color + "22",
        borderWidth: BORDER_WIDTH,
        pointStyle: pts.pointStyles,
        pointRadius: pts.pointRadii,
        pointBackgroundColor: pts.pointColors,
        pointHoverRadius: POINT_HOVER_RADIUS,
        tension: 0,
        spanGaps: false,
        hidden: !activeDriverKeys.has(drv.username) || !grpOk || !carOk,
        segment: {
          borderDash: (ctx) => pts.hasSR[ctx.p1DataIndex] || ctx.p1DataIndex === dnfCommentPtIdx ? [DASH_ON, DASH_OFF] : void 0
        },
        _cumPen: pts.cumPen,
        _cumSP: pts.cumSP,
        _cumSR: pts.cumSR,
        _hasSR: pts.hasSR,
        _cmts: pts.cmts,
        _stageLabels: pts.stageLabels
      };
    });
  }
  function buildDriverPoints(drv, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, color) {
    const y = [0];
    const pointStyles = ["circle"];
    const pointRadii = [0];
    const pointColors = ["transparent"];
    const cumPen = [0];
    const cumSP = [0];
    const cumSR = [0];
    const hasSR = [false];
    const cmts = [""];
    const stageLabels = ["\u0421\u0442\u0430\u0440\u0442"];
    let cum = 0;
    let isDnf = false;
    let lastValidPtIdx = 0;
    let dnfCommentPtIdx = null;
    const lastDnfCmtStageNum = (() => {
      for (let i = stages.length - 1; i >= 0; i--) {
        const rec = recordMap.get(drv.username)?.get(stages[i].num);
        if (rec?.time1 === null && rec?.comment?.trim()) return stages[i].num;
      }
      return null;
    })();
    for (const st of stages) {
      const rec = recordMap.get(drv.username)?.get(st.num) ?? null;
      const pen = cumPenMap.get(drv.username)?.get(st.num) ?? 0;
      const sp = cumSPMap.get(drv.username)?.get(st.num) ?? 0;
      const srBase = cumSRMap.get(drv.username)?.get(st.num) ?? 0;
      const srThis = rec?.superRally ? 1 : 0;
      const thisSR = srThis > 0;
      const hasCmt = !!rec?.comment?.trim();
      const slFull = `SS${st.num} ${st.name}`;
      if (st.num === lastDnfCmtStageNum && rec?.time1 === null && rec?.comment?.trim()) {
        const ptIdx = y.length;
        dnfCommentPtIdx = ptIdx;
        y.push(cum, null, null);
        pointStyles.push("rectRot", "circle", "circle");
        pointRadii.push(POINT_RADIUS_COMMENT, 0, 0);
        pointColors.push("#fff", color, color);
        cumPen.push(pen, pen, pen);
        cumSP.push(sp, sp, sp);
        cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
        hasSR.push(thisSR, thisSR, thisSR);
        cmts.push(rec.comment, "", "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        isDnf = true;
        continue;
      }
      if (isDnf || !rec || rec.time1 === null) {
        y.push(null, null, null);
        pointStyles.push("circle", "circle", "circle");
        pointRadii.push(0, 0, 0);
        pointColors.push(color, color, color);
        cumPen.push(pen, pen, pen);
        cumSP.push(sp, sp, sp);
        cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
        hasSR.push(thisSR, thisSR, thisSR);
        cmts.push("", "", rec?.comment ?? "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        isDnf = true;
        continue;
      }
      const t1 = rec.time1 ?? 0;
      const t2 = rec.time2 ?? 0;
      const t3 = rec.time3 ?? 0;
      y.push(cum + t1, cum + t1 + t2, cum + t1 + t2 + t3);
      pointStyles.push("circle", "circle", hasCmt ? "rectRot" : "circle");
      pointRadii.push(POINT_RADIUS_NORMAL, POINT_RADIUS_NORMAL, hasCmt ? POINT_RADIUS_COMMENT : POINT_RADIUS_FINAL);
      pointColors.push(color, color, hasCmt ? "#fff" : color);
      cumPen.push(pen, pen, pen);
      cumSP.push(sp, sp, sp);
      cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
      hasSR.push(thisSR, thisSR, thisSR);
      cmts.push("", "", rec.comment ?? "");
      stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
      cum += t1 + t2 + t3;
      lastValidPtIdx = y.length - 1;
    }
    return {
      y,
      pointStyles,
      pointRadii,
      pointColors,
      cumPen,
      cumSP,
      cumSR,
      hasSR,
      cmts,
      stageLabels,
      dnfCommentPtIdx,
      lastValidPtIdx
    };
  }

  // src/renderer/chart/pluginDnfLine.ts
  var DIM_ALPHA = 0.06;
  var DNF_DASH_ON = 6;
  var DNF_DASH_OFF = 4;
  var DNF_LINE_W = 1.8;
  function buildDnfLinePlugin(getHoveredKey, getPinnedIdx, getHoveredIdx) {
    function resolveActiveIdx(chart) {
      const key = getHoveredKey();
      if (key !== null)
        return chart.data.datasets.findIndex((d) => d.driverKey === key);
      const pinned = getPinnedIdx();
      if (pinned !== null) return pinned;
      return getHoveredIdx();
    }
    return {
      id: "dnfLine",
      afterDatasetsDraw(chart) {
        const pinnedIdx = getPinnedIdx();
        const activeIdx = resolveActiveIdx(chart);
        const { ctx } = chart;
        chart.data.datasets.forEach((ds, di) => {
          if (ds.hidden) return;
          if (di === pinnedIdx) return;
          const dnfPtIdx = ds._dnfCommentPtIdx;
          const lastPtIdx = ds._lastValidPtIdx;
          if (dnfPtIdx == null || lastPtIdx == null) return;
          const meta = chart.getDatasetMeta(di);
          const fromPt = meta.data[lastPtIdx];
          const toPt = meta.data[dnfPtIdx];
          if (!fromPt || !toPt) return;
          const isDimmed = activeIdx !== null && di !== activeIdx;
          ctx.save();
          if (isDimmed) ctx.globalAlpha = DIM_ALPHA;
          ctx.beginPath();
          ctx.setLineDash([DNF_DASH_ON, DNF_DASH_OFF]);
          ctx.strokeStyle = ds.borderColor;
          ctx.lineWidth = DNF_LINE_W;
          ctx.moveTo(fromPt.x, fromPt.y);
          ctx.lineTo(toPt.x, toPt.y);
          ctx.stroke();
          ctx.restore();
        });
      }
    };
  }

  // src/renderer/chart/pluginHoverDim.ts
  function buildHoverDimPlugin(getHoveredKey, getPinnedIdx, getHoveredIdx) {
    function resolveActiveIdx(ch) {
      const key = getHoveredKey();
      if (key !== null)
        return ch.data.datasets.findIndex((d) => d.driverKey === key);
      const pinned = getPinnedIdx();
      if (pinned !== null) return pinned;
      return getHoveredIdx();
    }
    return {
      id: "hoverDim",
      beforeDatasetDraw(ch, args) {
        if (ch.data.datasets[args.index]?.hidden) return;
        const activeIdx = resolveActiveIdx(ch);
        if (activeIdx === null || args.index === activeIdx) return;
        ch.ctx.save();
        ch.ctx.globalAlpha = 0.06;
      },
      afterDatasetDraw(ch, args) {
        if (ch.data.datasets[args.index]?.hidden) return;
        const activeIdx = resolveActiveIdx(ch);
        if (activeIdx === null || args.index === activeIdx) return;
        ch.ctx.restore();
      }
    };
  }

  // src/renderer/chart/pluginPinnedComments.ts
  var FONT_FAMILY = "'Fira Code', monospace";
  var PAD_X = 10;
  var PAD_Y = 7;
  var LINE_H = 17;
  var FONT_SZ = 12;
  var STAGE_FONT_SZ = 10;
  var MAX_BOX_W = 280;
  var BOX_GAP = 6;
  function buildPinnedCommentsPlugin(getPinnedIdx) {
    return {
      id: "pinnedComments",
      afterDraw(ch) {
        const pinnedIdx = getPinnedIdx();
        if (pinnedIdx === null) return;
        const ds = ch.data.datasets[pinnedIdx];
        if (!ds || ds.hidden) return;
        const cmts = ds._cmts;
        const slbls = ds._stageLabels;
        const meta = ch.getDatasetMeta(pinnedIdx);
        const { ctx, chartArea } = ch;
        ctx.save();
        const boxes = collectCommentBoxes(ctx, ds, meta, cmts, slbls, chartArea);
        resolveCollisions(boxes, chartArea);
        renderBoxes(ctx, boxes);
        ctx.restore();
      }
    };
  }
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }
  function measureBoxWidth(ctx, cmtLines, stageLabel) {
    const innerW = MAX_BOX_W - PAD_X * 2;
    ctx.font = `${STAGE_FONT_SZ}px ${FONT_FAMILY}`;
    const stageW = stageLabel ? ctx.measureText(stageLabel).width : 0;
    ctx.font = `${FONT_SZ}px ${FONT_FAMILY}`;
    const maxLineW = Math.max(stageW, ...cmtLines.map((l) => ctx.measureText(l).width));
    return Math.min(maxLineW + PAD_X * 2, MAX_BOX_W + PAD_X * 2, innerW + PAD_X * 2);
  }
  function buildAnchorGroups(ctx, ds, meta, cmts, slbls) {
    const innerW = MAX_BOX_W - PAD_X * 2;
    const dnfPtIdx = ds._dnfCommentPtIdx;
    const lastValidIdx = ds._lastValidPtIdx;
    const groups = /* @__PURE__ */ new Map();
    meta.data.forEach((pt, i) => {
      const cmt = cmts[i];
      if (!cmt) return;
      const isDnfCmt = i === dnfPtIdx;
      const anchorPt = isDnfCmt ? meta.data[lastValidIdx] : pt;
      const anchorKey = isDnfCmt ? lastValidIdx : i;
      const stageLabel = (slbls[i] ?? "").split(" ").slice(0, 2).join(" ");
      ctx.font = `${FONT_SZ}px ${FONT_FAMILY}`;
      const cmtLines = wrapText(ctx, cmt, innerW);
      const bw = measureBoxWidth(ctx, cmtLines, stageLabel);
      const stageLines = stageLabel ? 1 : 0;
      const bh = LINE_H * (stageLines + cmtLines.length) + PAD_Y * 2;
      if (!groups.has(anchorKey)) {
        groups.set(anchorKey, { pt: anchorPt, entries: [] });
      }
      groups.get(anchorKey).entries.push({ bw, bh, cmtLines, stageLabel });
    });
    return groups;
  }
  function positionGroupBoxes(group, chartArea) {
    const { pt, entries } = group;
    const boxes = [];
    let bottomEdge = pt.y - 8;
    for (const entry of entries) {
      let bx = pt.x + 10;
      let by = bottomEdge - entry.bh;
      if (bx + entry.bw > chartArea.right) bx = pt.x - entry.bw - 10;
      if (bx < chartArea.left) bx = chartArea.left + 2;
      if (by < chartArea.top) by = chartArea.top + 2;
      if (by + entry.bh > chartArea.bottom) by = chartArea.bottom - entry.bh - 2;
      boxes.push({
        x: bx,
        y: by,
        w: entry.bw,
        h: entry.bh,
        cmtLines: entry.cmtLines,
        stage: entry.stageLabel
      });
      bottomEdge = by - BOX_GAP;
    }
    return boxes;
  }
  function collectCommentBoxes(ctx, ds, meta, cmts, slbls, chartArea) {
    const groups = buildAnchorGroups(ctx, ds, meta, cmts, slbls);
    const boxes = [];
    groups.forEach((group) => {
      boxes.push(...positionGroupBoxes(group, chartArea));
    });
    return boxes;
  }
  function resolveCollisions(boxes, chartArea) {
    boxes.sort((a, b) => a.y - b.y);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlapsX = b.x < a.x + a.w && b.x + b.w > a.x;
        const overlapsY = b.y < a.y + a.h + 2;
        if (overlapsX && overlapsY) {
          b.y = a.y + a.h + 4;
          if (b.y + b.h > chartArea.bottom) b.y = a.y - b.h - 4;
        }
      }
    }
  }
  function renderBoxes(ctx, boxes) {
    boxes.forEach((box) => {
      ctx.fillStyle = "rgba(8,8,8,0.95)";
      ctx.strokeStyle = "#4a4a4a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      let textY = box.y + PAD_Y;
      if (box.stage) {
        ctx.fillStyle = "#888";
        ctx.font = `${STAGE_FONT_SZ}px ${FONT_FAMILY}`;
        ctx.fillText(box.stage, box.x + PAD_X, textY);
        textY += LINE_H;
      }
      ctx.fillStyle = "#ccc";
      ctx.font = `${FONT_SZ}px ${FONT_FAMILY}`;
      for (const line of box.cmtLines) {
        ctx.fillText(line, box.x + PAD_X, textY);
        textY += LINE_H;
      }
    });
  }

  // src/renderer/chart/pluginStageNames.ts
  var FONT_FAMILY2 = "'Fira Code', monospace";
  var FONT_SIZE_SS = 11;
  var FONT_SIZE_NM = 10;
  var HOVER_BG_EVEN = "#262626";
  var HOVER_BG_ODD = "#222222";
  var HOVER_BORDER = "#c0392b";
  function buildStageNamesPlugin(stages, rot45, rot90, getHoveredIdx) {
    return {
      id: "stageNames",
      afterDraw(ch) {
        if (!stages.length) return;
        const { ctx, chartArea, scales } = ch;
        const xs = scales.x;
        const bot = chartArea.bottom;
        const hoveredIdx = getHoveredIdx();
        ctx.save();
        for (let i = 0; i < stages.length; i++) {
          drawStageBand(ctx, stages[i], i, xs, bot, rot45, rot90, hoveredIdx === i);
        }
        ctx.restore();
      }
    };
  }
  function drawStageBand(ctx, stage, i, xs, bot, rot45, rot90, hovered) {
    const xL = xs.getPixelForTick(i * 3);
    const xR = xs.getPixelForTick(i * 3 + 3);
    if (xL >= xR) return;
    const bandH = rot90 ? 108 : rot45 ? 88 : 40;
    if (hovered) {
      ctx.fillStyle = i % 2 === 0 ? HOVER_BG_EVEN : HOVER_BG_ODD;
    } else {
      ctx.fillStyle = i % 2 === 0 ? "#1c1c1c" : "#181818";
    }
    ctx.fillRect(xL, bot + 2, xR - xL, bandH);
    if (hovered) {
      ctx.strokeStyle = HOVER_BORDER;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xL, bot + 2);
      ctx.lineTo(xR, bot + 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xL, bot + 2);
    ctx.lineTo(xL, bot + 2 + bandH);
    ctx.stroke();
    if (!rot45 && !rot90) {
      drawHorizontalLabel(ctx, stage, xL, xR, bot, hovered);
    } else if (rot45) {
      drawRotatedLabel(ctx, stage, xL, bot, Math.PI / 4, hovered);
    } else {
      drawRotatedLabel(ctx, stage, xL, bot, Math.PI / 2, hovered);
    }
  }
  function drawHorizontalLabel(ctx, stage, xL, xR, bot, hovered) {
    const xMid = (xL + xR) / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = hovered ? "#e74c3c" : "#c0392b";
    ctx.font = `bold ${FONT_SIZE_SS}px ${FONT_FAMILY2}`;
    ctx.fillText(`SS${stage.num}`, xMid, bot + 6);
    const maxChars = Math.max(4, Math.floor((xR - xL - 4) / 7));
    const name = stage.name.length > maxChars ? stage.name.slice(0, maxChars - 1) + "\u2026" : stage.name;
    ctx.fillStyle = hovered ? "#888" : "#666";
    ctx.font = `${FONT_SIZE_NM}px ${FONT_FAMILY2}`;
    ctx.fillText(name, xMid, bot + 21);
  }
  function drawRotatedLabel(ctx, stage, xL, bot, angle, hovered) {
    const MAX_CHARS = angle === Math.PI / 4 ? 22 : 28;
    ctx.save();
    ctx.translate(xL + 2, bot + 4);
    ctx.rotate(angle);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = hovered ? "#e74c3c" : "#c0392b";
    ctx.font = `bold ${FONT_SIZE_NM}px ${FONT_FAMILY2}`;
    const ssLabel = `SS${stage.num} `;
    ctx.fillText(ssLabel, 0, 0);
    const ssW = ctx.measureText(ssLabel).width;
    const name = stage.name.length > MAX_CHARS ? stage.name.slice(0, MAX_CHARS - 1) + "\u2026" : stage.name;
    ctx.fillStyle = hovered ? "#888" : "#666";
    ctx.font = `${FONT_SIZE_NM}px ${FONT_FAMILY2}`;
    ctx.fillText(name, ssW, 0);
    ctx.restore();
  }

  // src/renderer/chart/tooltip.ts
  var TOOLTIP_MARGIN_PX = 16;
  var TOOLTIP_OFFSET_Y = 12;
  function buildTooltipHandler(stages, getChart, getPinnedIdx) {
    return function handler(context) {
      const el = document.getElementById("chart-tooltip");
      const tooltip = context.tooltip;
      if (tooltip.opacity === 0) {
        el.style.display = "none";
        return;
      }
      const dp = tooltip.dataPoints?.[0];
      if (!dp) {
        el.style.display = "none";
        return;
      }
      const pinnedIdx = getPinnedIdx();
      if (pinnedIdx !== null && dp.datasetIndex !== pinnedIdx) {
        el.style.display = "none";
        return;
      }
      const xIdx = dp.dataIndex;
      const y0 = dp.raw;
      const chart = getChart();
      const matches = collectMatchingDatasets(chart, xIdx, y0, pinnedIdx);
      const stageInfo = resolveStageFromIndex(xIdx, stages);
      el.innerHTML = buildTooltipHtml(matches, xIdx, stageInfo);
      el.style.display = "block";
      positionTooltip(el, context, TOOLTIP_MARGIN_PX, TOOLTIP_OFFSET_Y);
    };
  }
  function collectMatchingDatasets(chart, xIdx, y0, pinnedIdx) {
    const matches = [];
    if (!chart || y0 === null) return matches;
    chart.data.datasets.forEach((ds, di) => {
      if (ds.hidden) return;
      if (pinnedIdx !== null && di !== pinnedIdx) return;
      const yv = ds.data[xIdx];
      const isDnf = xIdx === ds._dnfCommentPtIdx;
      if (yv !== null && Math.abs(yv - y0) < 1) matches.push({ ds, y: yv, isDnf });
    });
    return matches;
  }
  function buildTooltipHtml(matches, xIdx, stageInfo) {
    return matches.map(({ ds, y, isDnf }, mi) => {
      const divider = mi > 0 ? '<div class="tt-divider"></div>' : "";
      const name = escapeHtml(ds._displayName || ds.driverKey);
      const car = escapeHtml(ds._car ?? "");
      const pen = ds._cumPen[xIdx] ?? 0;
      const sp = ds._cumSP[xIdx] ?? 0;
      const sr = ds._cumSR[xIdx] ?? 0;
      const cmt = ds._cmts[xIdx] ?? "";
      let html = `${divider}<div class="tt-block">`;
      if (stageInfo) html += `<span class="tt-stage">${escapeHtml(stageInfo.label)}</span>`;
      html += `<span class="tt-name">${name}</span>`;
      if (car) html += `<span class="tt-car">\u{1F697} ${car}</span>`;
      html += `<span class="tt-sep"></span>`;
      html += isDnf ? `<span class="tt-red">DNF</span>` : y !== null ? `<span class="tt-row">\u23F1 ${formatTime(y)}</span>` : `<span class="tt-red">DNF</span>`;
      if (pen > 0) html += `<span class="tt-red">\u0428\u0442\u0440\u0430\u0444: +${formatTime(pen)}</span>`;
      if (sp > 0) html += `<span class="tt-red">Service Penalty: +${formatTime(sp)}</span>`;
      if (sr > 0) html += `<span class="tt-red">Super Rally: ${sr}\xD7</span>`;
      if (cmt) html += `<span class="tt-sep"></span><span class="tt-cmt">\u{1F4AC} ${escapeHtml(cmt)}</span>`;
      html += "</div>";
      return html;
    }).join("");
  }
  function resolveStageFromIndex(idx, stages) {
    if (idx === 0) return null;
    const si = Math.floor((idx - 1) / 3);
    const split = (idx - 1) % 3 + 1;
    const stage = stages[si];
    if (!stage) return null;
    const suffix = split === 1 ? " \xB7 SP1" : split === 2 ? " \xB7 SP2" : "";
    return { label: `SS${stage.num} ${stage.name}${suffix}` };
  }
  function positionTooltip(el, context, marginPx, offsetY) {
    const rect = context.chart.canvas.getBoundingClientRect();
    let tx = rect.left + context.tooltip.caretX + marginPx;
    let ty = rect.top + context.tooltip.caretY - offsetY;
    el.style.left = `${tx}px`;
    el.style.top = `${ty}px`;
    requestAnimationFrame(() => {
      const tr = el.getBoundingClientRect();
      if (tr.right > window.innerWidth - 10) tx = rect.left + context.tooltip.caretX - tr.width - marginPx;
      if (tr.bottom > window.innerHeight - 10) ty = rect.top + context.tooltip.caretY - tr.height;
      el.style.left = `${tx}px`;
      el.style.top = `${ty}px`;
    });
  }

  // src/renderer/chart/controller.ts
  var HOVER_DIST_PX = 40;
  var ROTATE_45_AT = 9;
  var ROTATE_90_AT = 20;
  var BOT_PAD_NORMAL = 46;
  var BOT_PAD_45 = 90;
  var BOT_PAD_90 = 110;
  function createChartController() {
    let chart = null;
    let canvas = null;
    let hoveredDsIdx = null;
    let hoveredDsKey = null;
    let pinnedDsIdx = null;
    let hoveredBandIdx = null;
    let activeStages = [];
    let currentBotPad = BOT_PAD_NORMAL;
    let clickHandler = null;
    let mousemoveHandler = null;
    let mouseleaveHandler = null;
    let onPinChange = null;
    function removeCanvasListeners() {
      if (!canvas) return;
      if (clickHandler) canvas.removeEventListener("click", clickHandler);
      if (mousemoveHandler) canvas.removeEventListener("mousemove", mousemoveHandler);
      if (mouseleaveHandler) canvas.removeEventListener("mouseleave", mouseleaveHandler);
      clickHandler = mousemoveHandler = mouseleaveHandler = null;
    }
    return {
      getChart: () => chart,
      getPinnedIndex: () => pinnedDsIdx,
      getPinnedDriverKey: () => {
        if (pinnedDsIdx === null || !chart) return null;
        return chart.data.datasets[pinnedDsIdx]?.driverKey ?? null;
      },
      getActiveStages: () => activeStages,
      setHoveredKey(key) {
        hoveredDsKey = key;
        chart?.update("none");
      },
      setOnPinChange(cb) {
        onPinChange = cb;
      },
      destroy() {
        removeCanvasListeners();
        if (chart) {
          chart.destroy();
          chart = null;
        }
        hoveredDsIdx = null;
        pinnedDsIdx = null;
        hoveredBandIdx = null;
      },
      pinDriver(idx) {
        pinnedDsIdx = idx;
        chart?.update("none");
      },
      updateDatasetVisibility(data2, activeDriverKeys, activeGroups, activeCars) {
        if (!chart || !data2) return;
        chart.data.datasets.forEach((ds) => {
          const drv = data2.drivers.find((d) => d.username === ds.driverKey);
          const grpOk = !data2.groups.length || !drv || activeGroups.has(drv.group);
          const carOk = !activeCars.size || !drv || activeCars.has(drv.car);
          ds.hidden = !activeDriverKeys.has(ds.driverKey) || !grpOk || !carOk;
        });
        chart.update("none");
      },
      build(data2, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, activeDriverKeys, activeGroups, activeCars) {
        activeStages = stages;
        const useRot45 = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
        const useRot90 = stages.length > ROTATE_90_AT;
        currentBotPad = useRot90 ? BOT_PAD_90 : useRot45 ? BOT_PAD_45 : BOT_PAD_NORMAL;
        const nPts = 1 + stages.length * 3;
        const labels = new Array(nPts).fill("");
        const maxCum = computeMaxCumulative(data2, stages, recordMap);
        const yStep = computeYAxisStep(maxCum);
        const datasets = buildDatasets(
          data2,
          stages,
          recordMap,
          cumPenMap,
          cumSPMap,
          cumSRMap,
          activeDriverKeys,
          activeGroups,
          activeCars
        );
        canvas = document.getElementById("race-chart");
        removeCanvasListeners();
        if (chart) {
          chart.destroy();
          chart = null;
          hoveredDsIdx = null;
          pinnedDsIdx = null;
        }
        const Chart = window.Chart;
        chart = new Chart(canvas, {
          type: "line",
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            normalized: true,
            interaction: { mode: "nearest", axis: "xy", intersect: false },
            layout: { padding: { bottom: currentBotPad } },
            onHover: (event, elements) => {
              if (pinnedDsIdx !== null) {
                hoveredDsIdx = null;
                return;
              }
              let newIdx = null;
              if (elements.length && event.native) {
                const el = elements[0];
                const meta = chart.getDatasetMeta(el.datasetIndex);
                const pt = meta.data[el.index];
                if (pt && Math.hypot(pt.x - (event.x ?? 0), pt.y - (event.y ?? 0)) <= HOVER_DIST_PX)
                  newIdx = el.datasetIndex;
              }
              if (newIdx !== hoveredDsIdx) {
                hoveredDsIdx = newIdx;
                chart.update("none");
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: false,
                external: buildTooltipHandler(
                  stages,
                  () => chart,
                  () => pinnedDsIdx
                )
              }
            },
            scales: buildScales(yStep)
          },
          plugins: [
            buildHoverDimPlugin(
              () => hoveredDsKey,
              () => pinnedDsIdx,
              () => hoveredDsIdx
            ),
            buildStageNamesPlugin(stages, useRot45, useRot90, () => hoveredBandIdx),
            buildDnfLinePlugin(() => hoveredDsKey, () => pinnedDsIdx, () => hoveredDsIdx),
            buildPinnedCommentsPlugin(() => pinnedDsIdx)
          ]
        });
        clickHandler = (e) => handleCanvasClick(
          e,
          chart,
          canvas,
          stages,
          currentBotPad,
          pinnedDsIdx,
          (idx) => {
            pinnedDsIdx = idx;
            chart.update("none");
            const key = chart.data.datasets[idx]?.driverKey ?? null;
            onPinChange?.(key);
          },
          () => {
            pinnedDsIdx = null;
            chart.update("none");
            onPinChange?.(null);
          }
        );
        mousemoveHandler = (e) => {
          const newBandIdx = resolveHoveredBandIdx(e, chart, canvas, stages, currentBotPad);
          canvas.style.cursor = newBandIdx !== null ? "pointer" : "";
          if (newBandIdx !== hoveredBandIdx) {
            hoveredBandIdx = newBandIdx;
            chart.update("none");
          }
        };
        mouseleaveHandler = () => {
          document.getElementById("chart-tooltip").style.display = "none";
          if (hoveredDsIdx !== null) {
            hoveredDsIdx = null;
            chart?.update("none");
          }
          if (hoveredBandIdx !== null) {
            hoveredBandIdx = null;
            canvas.style.cursor = "";
            chart?.update("none");
          }
        };
        canvas.addEventListener("click", clickHandler);
        canvas.addEventListener("mousemove", mousemoveHandler);
        canvas.addEventListener("mouseleave", mouseleaveHandler);
      }
    };
  }
  function resolveHoveredBandIdx(e, chart, canvas, stages, botPad) {
    if (!chart) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ca = chart.chartArea;
    if (my <= ca.bottom + 1 || my >= ca.bottom + 1 + botPad) return null;
    const xs = chart.scales.x;
    for (let i = 0; i < stages.length; i++) {
      const xL = xs.getPixelForTick(i * 3);
      const xR = xs.getPixelForTick(i * 3 + 3);
      if (mx >= xL && mx <= xR) return i;
    }
    return null;
  }
  function computeMaxCumulative(data2, stages, recordMap) {
    let max = 0;
    for (const drv of data2.drivers) {
      let cum = 0;
      for (const st of stages) {
        const r = recordMap.get(drv.username)?.get(st.num);
        if (!r || r.time1 === null) break;
        cum += (r.time1 ?? 0) + (r.time2 ?? 0) + (r.time3 ?? 0);
      }
      if (cum > max) max = cum;
    }
    return max;
  }
  function buildScales(yStep) {
    return {
      x: {
        type: "category",
        ticks: { display: false },
        grid: {
          drawTicks: false,
          color: (ctx) => ctx.index > 0 && ctx.index % 3 === 0 ? "#2a2a2a" : "#1a1a1a",
          lineWidth: (ctx) => ctx.index > 0 && ctx.index % 3 === 0 ? 1.5 : 0.5
        },
        border: { color: "#3a3a3a" }
      },
      y: {
        type: "linear",
        min: 0,
        ticks: {
          color: "#555",
          font: { size: 11, family: "'Fira Code', monospace" },
          stepSize: yStep,
          callback: (v) => formatYAxisTick(v)
        },
        grid: { color: "#1c1c1c", lineWidth: 1 },
        border: { color: "#3a3a3a" },
        title: {
          display: true,
          text: "\u0412\u0440\u0435\u043C\u044F",
          color: "#3c3c3c",
          font: { size: 11, family: "'Fira Code', monospace" }
        }
      }
    };
  }
  function handleCanvasClick(e, chart, canvas, stages, botPad, pinnedIdx, setPin, clearPin) {
    if (!chart) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ca = chart.chartArea;
    if (my > ca.bottom + 1 && my < ca.bottom + 1 + botPad) {
      const xs = chart.scales.x;
      for (let i = 0; i < stages.length; i++) {
        const xL = xs.getPixelForTick(i * 3);
        const xR = xs.getPixelForTick(i * 3 + 3);
        if (mx >= xL && mx <= xR) {
          window.__onStageBandClick?.(stages[i].num);
          return;
        }
      }
      return;
    }
    if (my < ca.top || my > ca.bottom) return;
    const elems = chart.getElementsAtEventForMode(e, "nearest", { intersect: false }, false);
    if (!elems.length) {
      if (pinnedIdx !== null) clearPin();
      return;
    }
    const el = elems[0];
    const meta = chart.getDatasetMeta(el.datasetIndex);
    const pt = meta.data[el.index];
    if (!pt || Math.hypot(pt.x - mx, pt.y - my) > HOVER_DIST_PX) {
      if (pinnedIdx !== null) clearPin();
      return;
    }
    pinnedIdx === el.datasetIndex ? clearPin() : setPin(el.datasetIndex);
  }

  // src/renderer/dom.ts
  function qs(sel, ctx = document) {
    return ctx.querySelector(sel);
  }
  function qsa(sel, ctx = document) {
    return Array.from(ctx.querySelectorAll(sel));
  }
  function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== void 0) el.textContent = text;
    return el;
  }
  function createTd(className, text) {
    return createElement("td", className, text);
  }

  // src/renderer/chart/legendPanel.ts
  function updateLegendPanel(data2, chart, activeStages, recordMap, activeDriverKeys, activeGroups, activeCars, isExpanded, pinnedDriverKey = null, callbacks) {
    const panel = document.getElementById("legend-panel");
    const itemsEl = document.getElementById("legend-items");
    const expandBtn = document.getElementById("legend-expand-btn");
    panel.style.display = "";
    const visibleWithTime = buildSortedVisibleDrivers(data2, chart, activeStages, recordMap);
    renderLegendItems(itemsEl, visibleWithTime, data2, pinnedDriverKey, callbacks);
    panel.classList.toggle("expanded", isExpanded);
    expandBtn.textContent = isExpanded ? "\u203A" : "\u2039";
    const inner = document.getElementById("legend-inner");
    requestAnimationFrame(() => {
      const overflows = inner.scrollHeight > inner.clientHeight + 2;
      expandBtn.style.display = overflows || isExpanded ? "" : "none";
    });
  }
  function buildSortedVisibleDrivers(data2, chart, activeStages, recordMap) {
    const visibleDrvs = data2.drivers.filter((drv) => {
      const ds = chart?.data.datasets.find((d) => d.driverKey === drv.username);
      return ds && !ds.hidden;
    });
    const withTime = visibleDrvs.map((drv) => {
      let cum = 0;
      for (const st of activeStages) {
        const r = recordMap.get(drv.username)?.get(st.num);
        if (!r || r.time1 === null) {
          cum = null;
          break;
        }
        cum += (r.time1 ?? 0) + (r.time2 ?? 0) + (r.time3 ?? 0);
      }
      return { drv, cum };
    });
    withTime.sort((a, b) => {
      if (a.cum === null && b.cum === null) return 0;
      if (a.cum === null) return -1;
      if (b.cum === null) return 1;
      return b.cum - a.cum;
    });
    return withTime;
  }
  function renderLegendItems(container, items, data2, pinnedDriverKey, callbacks) {
    container.innerHTML = "";
    items.forEach(({ drv }) => {
      const gi = data2.drivers.indexOf(drv);
      const color = driverColor(gi);
      const item = createElement("div", "legend-item");
      item.dataset["driverKey"] = drv.username;
      item.style.cursor = "pointer";
      if (drv.username === pinnedDriverKey) item.classList.add("pinned-highlight");
      const dot = createElement("span", "legend-dot");
      dot.style.background = color;
      const name = createElement(
        "span",
        "legend-name",
        drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username
      );
      item.appendChild(dot);
      item.appendChild(name);
      if (callbacks) {
        item.addEventListener("mouseenter", () => {
          callbacks.onDriverHover(drv.username);
          item.classList.add("legend-item-hover");
        });
        item.addEventListener("mouseleave", () => {
          callbacks.onDriverHover(null);
          item.classList.remove("legend-item-hover");
        });
        item.addEventListener("click", () => {
          callbacks.onDriverClick(drv.username);
        });
      }
      container.appendChild(item);
    });
  }

  // src/renderer/chart/lookups.ts
  function buildRallyLookups(data2) {
    const recordMap = /* @__PURE__ */ new Map();
    const cumPenMap = /* @__PURE__ */ new Map();
    const cumSPMap = /* @__PURE__ */ new Map();
    const cumSRMap = /* @__PURE__ */ new Map();
    for (const r of data2.records) {
      if (!recordMap.has(r.username)) recordMap.set(r.username, /* @__PURE__ */ new Map());
      recordMap.get(r.username).set(r.stageNum, r);
    }
    const sorted = [...data2.stages].sort((a, b) => a.num - b.num);
    for (const drv of data2.drivers) {
      const pm = /* @__PURE__ */ new Map();
      const sm = /* @__PURE__ */ new Map();
      const rm = /* @__PURE__ */ new Map();
      let cp = 0, cs = 0, cr = 0;
      for (const st of sorted) {
        pm.set(st.num, cp);
        sm.set(st.num, cs);
        rm.set(st.num, cr);
        const r = recordMap.get(drv.username)?.get(st.num);
        if (r) {
          cp += r.penalty ?? 0;
          cs += r.servicePenalty ?? 0;
          if (r.superRally) cr++;
        }
      }
      cumPenMap.set(drv.username, pm);
      cumSPMap.set(drv.username, sm);
      cumSRMap.set(drv.username, rm);
    }
    return { recordMap, cumPenMap, cumSPMap, cumSRMap };
  }

  // src/renderer/chart/pinnedBar.ts
  function updatePinnedBar(data2, chart, pinnedIdx) {
    const bar = document.getElementById("pinned-bar");
    if (pinnedIdx === null || !chart || !data2) {
      bar.style.display = "none";
      return;
    }
    const ds = chart.data.datasets[pinnedIdx];
    const drv = data2.drivers.find((d) => d.username === ds?.driverKey);
    if (!ds || !drv) {
      bar.style.display = "none";
      return;
    }
    const gi = data2.drivers.indexOf(drv);
    document.getElementById("pinned-dot").style.background = driverColor(gi);
    document.getElementById("pinned-name").textContent = drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username;
    bar.style.display = "flex";
  }

  // src/renderer/comments/index.ts
  var STYLES_ID = "comments-module-styles";
  var CARD_WIDTH = 220;
  var DRIVER_COL_W = 190;
  function renderCommentsView(data2) {
    injectStyles();
    renderSidebarSearch();
    const container = document.getElementById("view-comments");
    const drivers = buildCommentsData(data2);
    container.innerHTML = "";
    if (drivers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cmt-empty";
      empty.textContent = "\u041D\u0435\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432 \u0432 \u044D\u0442\u043E\u0439 \u0433\u043E\u043D\u043A\u0435";
      container.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "cmt-list";
    list.id = "cmt-list";
    for (const driver of drivers) {
      list.appendChild(buildDriverRow(driver));
    }
    container.appendChild(list);
  }
  function renderSidebarSearch() {
    const target = document.getElementById("filter-comments-search");
    if (!target) return;
    if (document.getElementById("cmt-search-wrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "cmt-search-wrap";
    wrap.className = "cmt-search-wrap";
    const label = document.createElement("div");
    label.className = "filter-group-title";
    label.textContent = "\u041F\u043E\u0438\u0441\u043A \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430";
    const input = document.createElement("input");
    input.id = "cmt-search-input";
    input.type = "text";
    input.className = "cmt-search-input";
    input.placeholder = "\u0418\u043C\u044F \u0438\u043B\u0438 \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u2026";
    input.addEventListener("input", () => scrollToDriverMatch(input.value.trim()));
    wrap.appendChild(label);
    wrap.appendChild(input);
    target.appendChild(wrap);
  }
  function scrollToDriverMatch(query) {
    const list = document.getElementById("cmt-list");
    const container = document.getElementById("view-comments");
    if (!list || !container) return;
    const rows = list.querySelectorAll(".cmt-row");
    rows.forEach((r) => r.classList.remove("cmt-row--highlighted"));
    if (!query) return;
    const q = query.toLowerCase();
    for (const row of rows) {
      const username = row.dataset["username"] ?? "";
      const realName = row.dataset["realname"] ?? "";
      if (username.toLowerCase().includes(q) || realName.toLowerCase().includes(q)) {
        row.classList.add("cmt-row--highlighted");
        row.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  }
  function buildCommentsData(data2) {
    const leaderTimes = buildLeaderTimes(data2.records);
    const totalTimes = buildTotalTimes(data2.records);
    const result = [];
    for (const driver of data2.drivers) {
      const entries = data2.records.filter((r) => r.username === driver.username && r.comment.trim()).sort((a, b) => a.stageNum - b.stageNum).map((r) => ({
        stageNum: r.stageNum,
        stageName: r.stageName,
        time3: r.time3,
        gapToLeader: r.time3 !== null && leaderTimes.has(r.stageNum) ? r.time3 - leaderTimes.get(r.stageNum) : null,
        penalty: r.penalty,
        servicePenalty: r.servicePenalty,
        superRally: r.superRally,
        comment: r.comment.trim()
      }));
      if (entries.length > 0) {
        result.push({
          username: driver.username,
          realName: driver.realName,
          car: driver.car,
          group: driver.group,
          totalTime: totalTimes.get(driver.username) ?? Infinity,
          entries
        });
      }
    }
    result.sort((a, b) => a.totalTime - b.totalTime);
    return result;
  }
  function buildLeaderTimes(records) {
    const map = /* @__PURE__ */ new Map();
    for (const r of records) {
      if (r.time3 === null) continue;
      const cur = map.get(r.stageNum);
      if (cur === void 0 || r.time3 < cur) map.set(r.stageNum, r.time3);
    }
    return map;
  }
  function buildTotalTimes(records) {
    const map = /* @__PURE__ */ new Map();
    for (const r of records) {
      if (r.time3 === null) continue;
      map.set(r.username, (map.get(r.username) ?? 0) + r.time3 + r.penalty + r.servicePenalty);
    }
    return map;
  }
  function buildDriverRow(driver) {
    const row = document.createElement("div");
    row.className = "cmt-row";
    row.dataset["username"] = driver.username;
    row.dataset["realname"] = driver.realName ?? "";
    row.appendChild(buildDriverCol(driver));
    row.appendChild(buildCardsCol(driver.entries));
    return row;
  }
  function buildDriverCol(driver) {
    const col = document.createElement("div");
    col.className = "cmt-driver";
    const username = document.createElement("div");
    username.className = "cmt-drv-username";
    username.textContent = driver.username;
    col.appendChild(username);
    if (driver.realName && driver.realName !== driver.username) {
      const realName = document.createElement("div");
      realName.className = "cmt-drv-realname";
      realName.textContent = driver.realName;
      col.appendChild(realName);
    }
    if (driver.car) {
      const car = document.createElement("div");
      car.className = "cmt-drv-car";
      car.textContent = driver.car;
      col.appendChild(car);
    }
    const count = document.createElement("div");
    count.className = "cmt-drv-count";
    count.textContent = `${driver.entries.length} ${pluralizeComments(driver.entries.length)}`;
    col.appendChild(count);
    return col;
  }
  function buildCardsCol(entries) {
    const col = document.createElement("div");
    col.className = "cmt-cards";
    for (const entry of entries) {
      col.appendChild(buildCommentCard(entry));
    }
    return col;
  }
  function buildCommentCard(entry) {
    const card = document.createElement("div");
    card.className = "cmt-card";
    card.appendChild(buildCardHeader(entry));
    card.appendChild(buildCardMeta(entry));
    if (entry.superRally || entry.penalty > 0 || entry.servicePenalty > 0) {
      card.appendChild(buildCardBadges(entry));
    }
    const text = document.createElement("div");
    text.className = "cmt-card-text";
    text.textContent = entry.comment;
    card.appendChild(text);
    return card;
  }
  function buildCardHeader(entry) {
    const header = document.createElement("div");
    header.className = "cmt-card-header";
    const badge = document.createElement("span");
    badge.className = "cmt-badge";
    badge.textContent = `SS${entry.stageNum}`;
    const stageName = document.createElement("span");
    stageName.className = "cmt-stage-name";
    stageName.textContent = entry.stageName;
    stageName.title = entry.stageName;
    header.appendChild(badge);
    header.appendChild(stageName);
    return header;
  }
  function buildCardMeta(entry) {
    const meta = document.createElement("div");
    meta.className = "cmt-card-meta";
    if (entry.time3 !== null) {
      const time = document.createElement("span");
      time.className = "cmt-time";
      time.textContent = formatTime2(entry.time3);
      meta.appendChild(time);
    }
    if (entry.gapToLeader === 0) {
      const gap = document.createElement("span");
      gap.className = "cmt-gap cmt-gap--leader";
      gap.textContent = "\u{1F947} \u043B\u0438\u0434\u0435\u0440";
      meta.appendChild(gap);
    } else if (entry.gapToLeader !== null && entry.gapToLeader > 0) {
      const gap = document.createElement("span");
      gap.className = "cmt-gap";
      gap.textContent = `\u041E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435: +${formatTime2(entry.gapToLeader)}`;
      meta.appendChild(gap);
    }
    return meta;
  }
  function buildCardBadges(entry) {
    const badges = document.createElement("div");
    badges.className = "cmt-card-badges";
    if (entry.superRally) {
      const sr = document.createElement("span");
      sr.className = "cmt-badge-sr";
      sr.textContent = "Super Rally";
      badges.appendChild(sr);
    }
    if (entry.penalty > 0) {
      const pen = document.createElement("span");
      pen.className = "cmt-badge-penalty";
      pen.textContent = `+${formatTime2(entry.penalty)} \u0448\u0442\u0440\u0430\u0444`;
      badges.appendChild(pen);
    }
    if (entry.servicePenalty > 0) {
      const sp = document.createElement("span");
      sp.className = "cmt-badge-penalty";
      sp.textContent = `+${formatTime2(entry.servicePenalty)} \u0441\u0435\u0440\u0432\u0438\u0441`;
      badges.appendChild(sp);
    }
    return badges;
  }
  function formatTime2(seconds) {
    const abs = Math.abs(seconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor(abs % 3600 / 60);
    const s = abs % 60;
    const dec = Math.round(s % 1 * 10);
    const ss = Math.floor(s).toString().padStart(2, "0");
    const sign = seconds < 0 ? "-" : "";
    if (h > 0) return `${sign}${h}:${m.toString().padStart(2, "0")}:${ss}.${dec}`;
    return `${sign}${m}:${ss}.${dec}`;
  }
  function pluralizeComments(n) {
    if (n % 10 === 1 && n % 100 !== 11) return "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F";
    return "\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432";
  }
  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = `
        #view-comments {
            flex: 1;
            overflow-y: auto;
            padding: 12px 20px 24px;
        }
        .cmt-empty {
            color: var(--color-text-tertiary);
            text-align: center;
            margin-top: 80px;
            font-family: var(--font-mono);
            font-size: 13px;
        }
        .cmt-list { display: flex; flex-direction: column; }
        .cmt-row {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 18px 0;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            transition: background 0.15s;
        }
        .cmt-row:last-child { border-bottom: none; }
        .cmt-row--highlighted { background: rgba(204,34,34,0.06); border-radius: 6px; }
        .cmt-driver {
            width: ${DRIVER_COL_W}px;
            min-width: ${DRIVER_COL_W}px;
            padding-top: 2px;
        }
        .cmt-drv-username {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-realname {
            font-size: 11px;
            color: var(--color-text-tertiary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-car {
            font-size: 11px;
            color: var(--color-text-secondary);
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-count {
            display: inline-block;
            margin-top: 8px;
            font-family: var(--font-mono);
            font-size: 10px;
            color: #888;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--color-border-tertiary);
            border-radius: 4px;
            padding: 1px 6px;
        }
        .cmt-cards { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
        .cmt-card {
            width: ${CARD_WIDTH}px;
            min-width: ${CARD_WIDTH}px;
            background: var(--color-background-secondary);
            border: 1px solid var(--color-border-tertiary);
            border-radius: 8px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: border-color 0.15s;
        }
        .cmt-card:hover { border-color: var(--color-border-secondary); }
        .cmt-card-header { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .cmt-badge {
            background: #cc2222;
            color: #fff;
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .cmt-stage-name {
            font-size: 11px;
            color: var(--color-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-card-meta { display: flex; flex-direction: column; gap: 3px; }
        .cmt-time {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text-primary);
        }
        .cmt-gap {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--color-text-tertiary);
        }
        .cmt-gap--leader { color: #44aa66; font-size: 10px; font-weight: 500; }
        .cmt-card-badges { display: flex; flex-wrap: wrap; gap: 4px; }
        .cmt-badge-sr {
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            color: #cc2222;
            background: rgba(204,34,34,0.12);
            border: 1px solid rgba(204,34,34,0.25);
            padding: 1px 6px;
            border-radius: 3px;
        }
        .cmt-badge-penalty {
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            color: #cc2222;
            background: rgba(204,34,34,0.07);
            border: 1px solid rgba(204,34,34,0.18);
            padding: 1px 6px;
            border-radius: 3px;
        }
        .cmt-card-text {
            font-size: 13px;
            line-height: 1.55;
            color: var(--color-text-primary);
            word-break: break-word;
            border-top: 1px solid var(--color-border-tertiary);
            padding-top: 6px;
            margin-top: 2px;
        }
        .cmt-search-wrap {
            padding: 8px 0 12px;
            border-bottom: 1px solid var(--color-border-tertiary);
            margin-bottom: 4px;
        }
        .cmt-search-input {
            width: 100%;
            margin-top: 6px;
            padding: 5px 8px;
            font-family: var(--font-mono);
            font-size: 12px;
            background: var(--color-background-secondary);
            border: 1px solid var(--color-border-secondary);
            border-radius: 4px;
            color: var(--color-text-primary);
            box-sizing: border-box;
            outline: none;
        }
        .cmt-search-input:focus { border-color: #cc2222; }
    `;
    document.head.appendChild(style);
  }

  // src/renderer/filters/filterState.ts
  function setAllCheckboxes(body, value) {
    qsa('input[type="checkbox"]', body).forEach((cb) => {
      cb.checked = value;
    });
  }
  function syncVisibleCheckboxes(body, value) {
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      if (item.style.display !== "none") {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = value;
      }
    });
  }
  function setCounterText(id, current, total) {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${current}/${total})`;
  }
  function setToggleActive(selector, active) {
    document.querySelector(selector)?.classList.toggle("btn-fa-active", active);
  }
  function refreshVisibleDriverKeys(body, state) {
    state.visibleDriverKeys = /* @__PURE__ */ new Set();
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      if (item.style.display !== "none")
        state.visibleDriverKeys.add(item.dataset["driverKey"]);
    });
  }

  // src/renderer/filters/filterCounters.ts
  function updateFilterCounters(data2, state) {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;
    setCounterText("counter-stages", activeStageNums.size, data2.stages.length);
    const activeVisible = data2.drivers.filter(
      (d) => visibleDriverKeys.has(d.username) && activeDriverKeys.has(d.username)
    ).length;
    setCounterText("counter-drivers", activeVisible, visibleDriverKeys.size);
    if (data2.groups.length)
      setCounterText("counter-groups", activeGroups.size, data2.groups.length);
    const allCars = [...new Set(data2.drivers.map((d) => d.car).filter(Boolean))];
    if (allCars.length)
      setCounterText("counter-cars", activeCars.size, allCars.length);
  }
  function updateToggleButtonStates(data2, state) {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;
    const allSS = activeStageNums.size === data2.stages.length && data2.stages.length > 0;
    setToggleActive("#filter-stages .btn-fa:nth-child(1)", allSS);
    setToggleActive("#filter-stages .btn-fa:nth-child(2)", activeStageNums.size === 0);
    const vis = [...visibleDriverKeys];
    const selVis = vis.filter((k) => activeDriverKeys.has(k)).length;
    setToggleActive("#filter-drivers-wrap .btn-fa:nth-child(1)", selVis === vis.length && vis.length > 0);
    setToggleActive("#filter-drivers-wrap .btn-fa:nth-child(2)", selVis === 0);
    const allGrp = activeGroups.size === data2.groups.length && data2.groups.length > 0;
    setToggleActive("#filter-groups .btn-fa:nth-child(1)", allGrp);
    setToggleActive("#filter-groups .btn-fa:nth-child(2)", activeGroups.size === 0);
    const allCars = [...new Set(data2.drivers.map((d) => d.car).filter(Boolean))];
    setToggleActive("#filter-cars .btn-fa:nth-child(1)", activeCars.size === allCars.length && allCars.length > 0);
    setToggleActive("#filter-cars .btn-fa:nth-child(2)", activeCars.size === 0);
  }
  function syncStageCheckboxes(activeStageNums) {
    const body = document.querySelector("#filter-stages .filter-body");
    if (!body) return;
    body.querySelectorAll(".filter-item[data-stage-num]").forEach((item) => {
      const num = parseInt(item.dataset["stageNum"]);
      const cb = item.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = activeStageNums.has(num);
    });
  }

  // src/renderer/filters/driverSearch.ts
  var DEBOUNCE_MS = 200;
  var MIN_CHARS = 2;
  var _searchTimer = null;
  function applyDriverSearch(q, body, data2, state) {
    const s = q.trim().toLowerCase();
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      const grp = item.dataset["group"] ?? "";
      const car = item.dataset["car"] ?? "";
      const grpOk = !data2.groups.length || state.activeGroups.has(grp);
      const carOk = !state.activeCars.size || state.activeCars.has(car);
      if (!grpOk || !carOk) {
        item.style.display = "none";
        return;
      }
      if (s.length < MIN_CHARS) {
        item.style.display = "";
        return;
      }
      item.style.display = (item.textContent ?? "").toLowerCase().includes(s) ? "" : "none";
    });
    refreshVisibleDriverKeys(body, state);
  }
  function reapplyDriverSearch(body) {
    const sv = document.getElementById("driver-search-input")?.value ?? "";
    if (sv.length < MIN_CHARS) return;
    const q = sv.toLowerCase();
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      if (item.style.display !== "none" && !(item.textContent ?? "").toLowerCase().includes(q))
        item.style.display = "none";
    });
  }
  function buildSearchBox(body, onSearch) {
    const sw = document.createElement("div");
    sw.className = "filter-search-wrap";
    const si = document.createElement("input");
    si.className = "filter-search";
    si.type = "text";
    si.id = "driver-search-input";
    si.placeholder = "\u041F\u043E\u0438\u0441\u043A\u2026";
    const sc = document.createElement("button");
    sc.className = "filter-search-clear hidden";
    sc.textContent = "\xD7";
    sw.appendChild(si);
    sw.appendChild(sc);
    body.appendChild(sw);
    si.addEventListener("input", () => {
      sc.classList.toggle("hidden", si.value.length === 0);
      if (_searchTimer !== null) clearTimeout(_searchTimer);
      _searchTimer = setTimeout(
        () => onSearch(si.value),
        DEBOUNCE_MS
      );
    });
    sc.addEventListener("click", () => {
      si.value = "";
      sc.classList.add("hidden");
      onSearch("");
    });
  }

  // src/renderer/filters/filterGroup.ts
  function buildCollapsibleFilterGroup(title, counterId) {
    const group = createElement("div", "filter-group collapsed");
    const hdr = createElement("div", "filter-header");
    const left = createElement("div", "filter-header-left");
    left.innerHTML = `<span class="collapse-icon">\u25B6</span><span class="filter-title">${title}</span><span class="filter-counter" id="${counterId}"></span>`;
    const right = createElement("div", "filter-header-right");
    const btnAll = createElement("button", "btn-fa", "\u0412\u0441\u0435");
    const btnNone = createElement("button", "btn-fa", "\u041D\u0438\u043A\u043E\u0433\u043E");
    right.appendChild(btnAll);
    right.appendChild(btnNone);
    hdr.appendChild(left);
    hdr.appendChild(right);
    const body = createElement("div", "filter-body");
    left.addEventListener("click", () => group.classList.toggle("collapsed"));
    btnAll.addEventListener("click", (e) => e.stopPropagation());
    btnNone.addEventListener("click", (e) => e.stopPropagation());
    group.appendChild(hdr);
    group.appendChild(body);
    return { group, body, btnAll, btnNone };
  }

  // src/renderer/filters/filterBuilders.ts
  function buildStageFilterUI(stages, state, callbacks) {
    const cont = document.getElementById("filter-stages");
    cont.innerHTML = "";
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup("\u0421\u043F\u0435\u0446\u0443\u0447\u0430\u0441\u0442\u043A\u0438", "counter-stages");
    btnAll.addEventListener("click", () => {
      stages.forEach((s) => state.activeStageNums.add(s.num));
      setAllCheckboxes(body, true);
      callbacks.onStagesChanged();
    });
    btnNone.addEventListener("click", () => {
      state.activeStageNums.clear();
      setAllCheckboxes(body, false);
      callbacks.onStagesChanged();
    });
    for (const s of stages) {
      const lbl = createElement("label", "filter-item");
      lbl.dataset["stageNum"] = String(s.num);
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.activeStageNums.add(s.num) : state.activeStageNums.delete(s.num);
        callbacks.onStagesChanged();
      });
      lbl.appendChild(cb);
      lbl.appendChild(createElement("span", "filter-ss", `SS${s.num}`));
      lbl.appendChild(createElement("span", "filter-name", s.name));
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildDriverFilterUI(drivers, data2, state, callbacks) {
    const wrap = document.getElementById("filter-drivers-wrap");
    wrap.innerHTML = "";
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup("\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438", "counter-drivers");
    btnAll.addEventListener("click", () => {
      drivers.filter((d) => state.visibleDriverKeys.has(d.username)).forEach((d) => state.activeDriverKeys.add(d.username));
      syncVisibleCheckboxes(body, true);
      callbacks.onDriversChanged();
    });
    btnNone.addEventListener("click", () => {
      drivers.filter((d) => state.visibleDriverKeys.has(d.username)).forEach((d) => state.activeDriverKeys.delete(d.username));
      syncVisibleCheckboxes(body, false);
      callbacks.onDriversChanged();
    });
    buildSearchBox(body, (q) => {
      applyDriverSearch(q, body, data2, state);
      callbacks.onDriversChanged();
    });
    for (const drv of drivers) {
      const lbl = createElement("label", "filter-item");
      lbl.dataset["driverKey"] = drv.username;
      lbl.dataset["group"] = drv.group;
      lbl.dataset["car"] = drv.car;
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.activeDriverKeys.add(drv.username) : state.activeDriverKeys.delete(drv.username);
        callbacks.onDriversChanged();
      });
      const content = createElement("div", "filter-driver-content");
      const nameSpan = createElement(
        "span",
        "filter-driver-name",
        drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username
      );
      content.appendChild(nameSpan);
      if (drv.car) content.appendChild(createElement("span", "filter-driver-car", drv.car));
      lbl.addEventListener("mouseenter", () => {
        lbl.classList.add("hover-highlighted");
        callbacks.onDriverHover(drv.username);
      });
      lbl.addEventListener("mouseleave", () => {
        lbl.classList.remove("hover-highlighted");
        callbacks.onDriverHover(null);
      });
      lbl.appendChild(cb);
      lbl.appendChild(content);
      body.appendChild(lbl);
    }
    wrap.appendChild(group);
  }
  function buildGroupFilterUI(groups, data2, state, callbacks, onRefilterDrivers) {
    const cont = document.getElementById("filter-groups");
    cont.innerHTML = "";
    if (!groups.length) {
      cont.style.display = "none";
      return;
    }
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup("\u0413\u0440\u0443\u043F\u043F\u0430 / \u041A\u043B\u0430\u0441\u0441", "counter-groups");
    btnAll.addEventListener("click", () => {
      groups.forEach((g) => state.activeGroups.add(g));
      setAllCheckboxes(body, true);
      onRefilterDrivers();
      callbacks.onGroupsChanged();
    });
    btnNone.addEventListener("click", () => {
      state.activeGroups.clear();
      setAllCheckboxes(body, false);
      onRefilterDrivers();
      callbacks.onGroupsChanged();
    });
    for (const grp of groups) {
      const lbl = createElement("label", "filter-item");
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.activeGroups.add(grp) : state.activeGroups.delete(grp);
        onRefilterDrivers();
        callbacks.onGroupsChanged();
      });
      lbl.appendChild(cb);
      lbl.appendChild(createElement("span", "filter-group-label", grp));
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildCarFilterUI(drivers, state, callbacks, onRefilterDrivers) {
    const cont = document.getElementById("filter-cars");
    cont.innerHTML = "";
    const cars = [...new Set(drivers.map((d) => d.car).filter(Boolean))].sort();
    if (!cars.length) {
      cont.style.display = "none";
      return;
    }
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup("\u0410\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044C", "counter-cars");
    btnAll.addEventListener("click", () => {
      cars.forEach((c) => state.activeCars.add(c));
      setAllCheckboxes(body, true);
      onRefilterDrivers();
      callbacks.onCarsChanged();
    });
    btnNone.addEventListener("click", () => {
      state.activeCars.clear();
      setAllCheckboxes(body, false);
      onRefilterDrivers();
      callbacks.onCarsChanged();
    });
    for (const car of cars) {
      const lbl = createElement("label", "filter-item");
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.activeCars.add(car) : state.activeCars.delete(car);
        onRefilterDrivers();
        callbacks.onCarsChanged();
      });
      lbl.appendChild(cb);
      lbl.appendChild(createElement("span", "filter-car-label", car));
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function applyGroupOrCarFilterToDriverList(data2, state) {
    const body = document.querySelector("#filter-drivers-wrap .filter-body");
    if (!body) return;
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      const grp = item.dataset["group"] ?? "";
      const car = item.dataset["car"] ?? "";
      const grpOk = !data2.groups.length || state.activeGroups.has(grp);
      const carOk = !state.activeCars.size || state.activeCars.has(car);
      item.style.display = grpOk && carOk ? "" : "none";
    });
    reapplyDriverSearch(body);
    refreshVisibleDriverKeys(body, state);
  }
  function updateDriverItemsByStageAndFilter(data2, state, recordMap) {
    const body = document.querySelector("#filter-drivers-wrap .filter-body");
    if (!body) return;
    const allSelected = state.activeStageNums.size === data2.stages.length;
    qsa(".filter-item[data-driver-key]", body).forEach((item) => {
      const key = item.dataset["driverKey"];
      const grp = item.dataset["group"] ?? "";
      const car = item.dataset["car"] ?? "";
      const grpOk = !data2.groups.length || state.activeGroups.has(grp);
      const carOk = !state.activeCars.size || state.activeCars.has(car);
      const stageOk = allSelected || [...state.activeStageNums].some((sn) => recordMap.get(key)?.has(sn));
      item.style.display = grpOk && carOk && stageOk ? "" : "none";
    });
    reapplyDriverSearch(body);
    refreshVisibleDriverKeys(body, state);
  }

  // src/renderer/filters/chartFilters.ts
  function buildChartFilterPanel(data2, state, callbacks) {
    buildStageFilterUI(data2.stages, state, callbacks);
    buildDriverFilterUI(data2.drivers, data2, state, callbacks);
    buildGroupFilterUI(
      data2.groups,
      data2,
      state,
      callbacks,
      () => applyGroupOrCarFilterToDriverList(data2, state)
    );
    buildCarFilterUI(
      data2.drivers,
      state,
      callbacks,
      () => applyGroupOrCarFilterToDriverList(data2, state)
    );
  }

  // src/renderer/results/compute.ts
  function computeAllDriverStats(data2, recordMap) {
    const stages = [...data2.stages].sort((a, b) => a.num - b.num);
    return data2.drivers.map((drv) => {
      const snaps = [];
      let total = 0;
      let sr = 0;
      let totalPen = 0;
      for (const st of stages) {
        const r = recordMap.get(drv.username)?.get(st.num);
        const t3 = r?.time3 ?? null;
        const hasSR = r?.superRally ?? false;
        const pen = (r?.penalty ?? 0) + (r?.servicePenalty ?? 0);
        snaps.push({ time3: t3, hasSR, penalty: r?.penalty ?? 0, servicePenalty: r?.servicePenalty ?? 0 });
        if (t3 === null) total = null;
        else if (total !== null) total += t3;
        if (hasSR) sr++;
        totalPen += pen;
      }
      const dn = drv.realName && drv.realName !== drv.username ? `${drv.username} | ${drv.realName}` : drv.username;
      return {
        username: drv.username,
        realName: drv.realName,
        car: drv.car,
        group: drv.group,
        displayName: dn,
        totalTime: total,
        totalPenalty: totalPen,
        srCount: sr,
        snaps
      };
    });
  }
  function recalculateStatsForStages(stats, stageNums, allStageNums, recordMap) {
    if (stageNums.size === allStageNums.length) return stats;
    const filteredStages = allStageNums.filter((n) => stageNums.has(n)).sort((a, b) => a - b);
    let total = 0;
    let sr = 0;
    let totalPen = 0;
    const snaps = [];
    for (const sn of filteredStages) {
      const r = recordMap.get(stats.username)?.get(sn);
      const t3 = r?.time3 ?? null;
      const hasSR = r?.superRally ?? false;
      const pen = (r?.penalty ?? 0) + (r?.servicePenalty ?? 0);
      snaps.push({ time3: t3, hasSR, penalty: r?.penalty ?? 0, servicePenalty: r?.servicePenalty ?? 0 });
      if (t3 === null) total = null;
      else if (total !== null) total += t3;
      if (hasSR) sr++;
      totalPen += pen;
    }
    return { ...stats, totalTime: total, totalPenalty: totalPen, srCount: sr, snaps };
  }
  function computeDriverResults(stats) {
    const n = stats[0]?.snaps.length ?? 0;
    const sorted = [...stats].sort((a, b) => nullableCompare(a.totalTime, b.totalTime));
    return sorted.map((cur, i) => {
      const leader = sorted[0];
      const prev = i > 0 ? sorted[i - 1] : null;
      const totalGap = cur.totalTime !== null && leader.totalTime !== null ? cur.totalTime - leader.totalTime : null;
      const glArr = [];
      const ppArr = [];
      const clArr = [];
      const cpArr = [];
      for (let s = 0; s < n; s++) {
        const ct = cur.snaps[s].time3;
        const lt = leader.snaps[s].time3;
        if (ct !== null && lt !== null) {
          glArr.push(ct - lt);
          if (!cur.snaps[s].hasSR && !leader.snaps[s].hasSR) clArr.push(ct - lt);
        }
        if (prev) {
          const pt = prev.snaps[s].time3;
          if (ct !== null && pt !== null) {
            ppArr.push(ct - pt);
            if (!cur.snaps[s].hasSR && !prev.snaps[s].hasSR) cpArr.push(ct - pt);
          }
        }
      }
      return {
        stats: cur,
        position: i + 1,
        totalGap,
        avgGapFromLeader: glArr.length ? avg(glArr) : null,
        avgGapFromPrev: ppArr.length ? avg(ppArr) : null,
        cleanGapFromLeader: clArr.length ? avg(clArr) : null,
        cleanGapFromPrev: cpArr.length ? avg(cpArr) : null,
        cleanCountLeader: clArr.length,
        cleanCountPrev: cpArr.length,
        totalStageCount: n
      };
    });
  }
  function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // src/renderer/results/filterPanel.ts
  function buildResultsFilterPanel(data2, state, onChange, onApply) {
    const cont = document.getElementById("sidebar-results-filters");
    cont.innerHTML = "";
    buildResultsStageFilter(data2, state, onChange, cont);
    buildResultsDriverFilter(data2, state, onChange, cont);
    if (data2.groups.length) buildResultsGroupFilter(data2, state, onChange, cont);
    updateResultsFilterCounters(data2, state);
    wireApplyButton(onApply);
  }
  function updateResultsFilterCounters(data2, state) {
    setCounter("counter-res-stages", state.stageFilter.size, data2.stages.length);
    if (data2.groups.length) setCounter("counter-res-groups", state.groupFilter.size, data2.groups.length);
    const active = state.driverFilter.size > 0 ? state.driverFilter.size : data2.drivers.length;
    setCounter("counter-res-drivers", active, data2.drivers.length);
  }
  function syncResultsDriverCheckboxes(data2, state) {
    const body = document.querySelector('#sidebar-results-filters .filter-body[data-filter="drivers"]');
    if (!body) return;
    const applied = state.driverFilter;
    state.activeDriverKeys.clear();
    qsa(".filter-item", body).forEach((item) => {
      const cb = item.querySelector("input[type=checkbox]");
      const nmEl = item.querySelector(".filter-driver-name");
      if (!cb || !nmEl) return;
      const text = nmEl.textContent ?? "";
      const drv = data2.drivers.find(
        (d) => (d.realName && d.realName !== d.username ? `${d.username} (${d.realName})` : d.username) === text
      );
      if (drv) {
        const checked = applied.size === 0 || applied.has(drv.username);
        cb.checked = checked;
        if (checked) state.activeDriverKeys.add(drv.username);
      }
    });
  }
  function buildResultsStageFilter(data2, state, onChange, cont) {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
      "\u042D\u0442\u0430\u043F\u044B",
      "counter-res-stages"
    );
    btnAll.addEventListener("click", () => {
      data2.stages.forEach((s) => state.stageFilter.add(s.num));
      setAllCb(body, true);
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    btnNone.addEventListener("click", () => {
      state.stageFilter.clear();
      setAllCb(body, false);
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    for (const st of data2.stages) {
      const lbl = createElement("label", "filter-item");
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset["stageNum"] = String(st.num);
      cb.addEventListener("change", () => {
        cb.checked ? state.stageFilter.add(st.num) : state.stageFilter.delete(st.num);
        updateResultsFilterCounters(data2, state);
        onChange();
      });
      const ss = createElement("span", "filter-ss", `SS${st.num}`);
      const nm = createElement("span", "filter-name", st.name);
      lbl.appendChild(cb);
      lbl.appendChild(ss);
      lbl.appendChild(nm);
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildResultsDriverFilter(data2, state, onChange, cont) {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
      "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438",
      "counter-res-drivers"
    );
    body.dataset["filter"] = "drivers";
    if (state.activeDriverKeys.size === 0)
      data2.drivers.forEach((d) => state.activeDriverKeys.add(d.username));
    function syncDriverFilter() {
      state.driverFilter = state.activeDriverKeys.size === data2.drivers.length ? /* @__PURE__ */ new Set() : new Set(state.activeDriverKeys);
    }
    btnAll.addEventListener("click", () => {
      data2.drivers.forEach((d) => state.activeDriverKeys.add(d.username));
      setAllCb(body, true);
      syncDriverFilter();
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    btnNone.addEventListener("click", () => {
      state.activeDriverKeys.clear();
      setAllCb(body, false);
      syncDriverFilter();
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    for (const drv of data2.drivers) {
      const lbl = createElement("label", "filter-item");
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.activeDriverKeys.add(drv.username) : state.activeDriverKeys.delete(drv.username);
        syncDriverFilter();
        updateResultsFilterCounters(data2, state);
        onChange();
      });
      const content = createElement("div", "filter-driver-content");
      const nm = createElement(
        "span",
        "filter-driver-name",
        drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username
      );
      content.appendChild(nm);
      if (drv.car) {
        const cs = createElement("span", "filter-driver-car", drv.car);
        content.appendChild(cs);
      }
      lbl.appendChild(cb);
      lbl.appendChild(content);
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildResultsGroupFilter(data2, state, onChange, cont) {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
      "\u041A\u043B\u0430\u0441\u0441",
      "counter-res-groups"
    );
    btnAll.addEventListener("click", () => {
      data2.groups.forEach((g) => state.groupFilter.add(g));
      setAllCb(body, true);
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    btnNone.addEventListener("click", () => {
      state.groupFilter.clear();
      setAllCb(body, false);
      updateResultsFilterCounters(data2, state);
      onChange();
    });
    for (const grp of data2.groups) {
      const lbl = createElement("label", "filter-item");
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.addEventListener("change", () => {
        cb.checked ? state.groupFilter.add(grp) : state.groupFilter.delete(grp);
        updateResultsFilterCounters(data2, state);
        onChange();
      });
      const span = createElement("span", "filter-group-label", grp);
      lbl.appendChild(cb);
      lbl.appendChild(span);
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function wireApplyButton(onApply) {
    const btn = document.getElementById("btn-apply-filter");
    if (!btn) return;
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener("click", () => {
      const selected = new Set(
        qsa("#results-tbody tr.row-selected").map((r) => r.dataset["username"]).filter(Boolean)
      );
      onApply(selected);
    });
  }
  function setAllCb(body, value) {
    qsa("input[type=checkbox]", body).forEach((cb) => {
      cb.checked = value;
    });
  }
  function setCounter(id, current, total) {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${current}/${total})`;
  }

  // src/renderer/results/tableRenderer.ts
  var COLUMNS = [
    { key: "pos", label: "#", title: "" },
    { key: "name", label: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A", title: "", special: "search" },
    { key: "group", label: "\u041A\u043B\u0430\u0441\u0441", title: "" },
    { key: "car", label: "\u0410\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044C", title: "" },
    { key: "totalTime", label: "\u041E\u0431\u0449\u0435\u0435 \u0432\u0440\u0435\u043C\u044F", title: "" },
    { key: "totalPenalty", label: "\u0428\u0442\u0440\u0430\u0444\u044B", title: "" },
    {
      key: "avgGapLeader",
      label: "\u0421\u0440. \u043E\u0442\u0441\u0442. \u043B\u0438\u0434\u0435\u0440",
      title: "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR"
    },
    {
      key: "avgGapPrev",
      label: "\u0421\u0440. \u043E\u0442\u0441\u0442. \u043F\u0440\u0435\u0434.",
      title: "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR"
    },
    {
      key: "cleanLeader",
      label: "\u0427\u0438\u0441\u0442. \u043E\u0442\u0441\u0442. \u043B\u0438\u0434\u0435\u0440",
      title: "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u0447\u0438\u0441\u0442\u043E\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430\n\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432"
    },
    {
      key: "cleanPrev",
      label: "\u0427\u0438\u0441\u0442. \u043E\u0442\u0441\u0442. \u043F\u0440\u0435\u0434.",
      title: "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u0447\u0438\u0441\u0442\u043E\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E\n\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432"
    },
    { key: "totalGap", label: "\u041E\u0431\u0449\u0435\u0435 \u043E\u0442\u0441\u0442.", title: "" },
    { key: "sr", label: "SR", title: "" }
  ];
  function buildResultsTableHeader(thead, onSearchClick) {
    thead.innerHTML = "";
    const tr = document.createElement("tr");
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      if (col.title) th.title = col.title;
      if (col.special === "search") {
        th.className = "th-participant";
        th.innerHTML = col.label;
        th.addEventListener("click", () => onSearchClick(th));
      } else {
        th.textContent = col.label;
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
  }
  function renderResultsRows(tbody, results, selectedRows, onRowClick) {
    tbody.innerHTML = "";
    for (const r of results) {
      const row = buildResultRow(r, selectedRows);
      row.addEventListener("click", () => onRowClick(r.stats.username, row));
      tbody.appendChild(row);
    }
  }
  function buildResultRow(r, selectedRows) {
    const row = document.createElement("tr");
    row.dataset["username"] = r.stats.username;
    if (selectedRows.has(r.stats.username)) row.classList.add("row-selected");
    row.appendChild(buildPositionCell(r.position));
    row.appendChild(buildNameCell(r.stats));
    row.appendChild(buildGroupCell(r.stats.group));
    row.appendChild(createTd("td-time", r.stats.car));
    row.appendChild(createTd(
      "td-time",
      r.stats.totalTime !== null ? formatTime(r.stats.totalTime) : "DNF"
    ));
    row.appendChild(buildPenaltyCell(r.stats.totalPenalty));
    row.appendChild(buildGapWithTooltip(
      r.position === 1 ? "\u2014" : formatTimeSigned(r.avgGapFromLeader),
      "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR",
      r.avgGapFromLeader
    ));
    row.appendChild(buildGapWithTooltip(
      r.position === 1 ? "\u2014" : formatTimeSigned(r.avgGapFromPrev),
      "\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043E\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR",
      r.avgGapFromPrev
    ));
    row.appendChild(buildCleanGapCell(
      r.position === 1 ? null : r.cleanGapFromLeader,
      r.cleanCountLeader,
      r.totalStageCount
    ));
    row.appendChild(buildCleanGapCell(
      r.position === 1 ? null : r.cleanGapFromPrev,
      r.cleanCountPrev,
      r.totalStageCount
    ));
    row.appendChild(createTd(
      "td-total-gap",
      r.position === 1 ? "\u2014" : r.totalGap !== null ? formatTimeSigned(r.totalGap) : "\u2014"
    ));
    row.appendChild(buildSRCell(r.stats.srCount));
    return row;
  }
  function buildPositionCell(pos) {
    const td = createTd("td-pos", String(pos));
    if (pos === 1) td.classList.add("pos-gold");
    else if (pos === 2) td.classList.add("pos-silver");
    else if (pos === 3) td.classList.add("pos-bronze");
    return td;
  }
  function buildNameCell(stats) {
    const td = createTd("td-name");
    const user = createElement("span", "td-name-user", stats.username);
    td.appendChild(user);
    if (stats.realName && stats.realName !== stats.username) {
      const real = createElement("span", "td-name-real", ` | ${stats.realName}`);
      td.appendChild(real);
    }
    return td;
  }
  function buildGroupCell(group) {
    const td = createTd();
    if (group) {
      const badge = createElement("span", "badge-group", group);
      td.appendChild(badge);
    }
    return td;
  }
  function buildPenaltyCell(penalty) {
    return createTd(
      penalty > 0 ? "td-gap-pos" : "td-gap-zero",
      penalty > 0 ? `+${formatTime(penalty)}` : "\u2014"
    );
  }
  function buildGapWithTooltip(text, tip, val) {
    const td = createTd();
    const inner = createElement("span", "td-clean", text);
    inner.dataset["tooltip"] = tip;
    if (val !== null) inner.style.color = gapColor(val);
    td.appendChild(inner);
    return td;
  }
  function buildCleanGapCell(val, cleanCount, totalCount) {
    const td = createTd();
    if (val === null && cleanCount === 0) {
      td.textContent = "\u2014";
      return td;
    }
    const inner = createElement(
      "span",
      "td-clean",
      val !== null ? formatTimeSigned(val) : "\u2014"
    );
    inner.dataset["tooltip"] = `\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u043E \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0438 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F ${cleanCount}/${totalCount} \u044D\u0442\u0430\u043F\u043E\u0432
\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432`;
    if (val !== null) inner.style.color = gapColor(val);
    td.appendChild(inner);
    return td;
  }
  function buildSRCell(srCount) {
    const td = createTd();
    if (srCount > 0) {
      td.textContent = String(srCount);
      td.className = "td-sr";
    } else {
      td.textContent = "0";
      td.className = "td-gap-zero";
    }
    return td;
  }
  function gapColor(val) {
    if (val > 0) return "var(--red-hi)";
    if (val < 0) return "var(--green)";
    return "#888";
  }

  // src/renderer/results/index.ts
  var _data = null;
  var _recordMap = /* @__PURE__ */ new Map();
  var _allStats = [];
  var _selectedRows = /* @__PURE__ */ new Set();
  var _searchActive = false;
  var _filterState = {
    stageFilter: /* @__PURE__ */ new Set(),
    groupFilter: /* @__PURE__ */ new Set(),
    driverFilter: /* @__PURE__ */ new Set(),
    activeDriverKeys: /* @__PURE__ */ new Set()
  };
  function initResultsModule(data2, recordMap, allStats) {
    _data = data2;
    _recordMap = recordMap;
    _allStats = allStats;
    _selectedRows = /* @__PURE__ */ new Set();
    _filterState = {
      stageFilter: new Set(data2.stages.map((s) => s.num)),
      groupFilter: new Set(data2.groups),
      driverFilter: /* @__PURE__ */ new Set(),
      activeDriverKeys: new Set(data2.drivers.map((d) => d.username))
    };
    updateApplyBar();
  }
  function buildResultsFilters(onChange) {
    if (!_data) return;
    buildResultsFilterPanel(
      _data,
      _filterState,
      () => {
        renderResultsTable();
        onChange();
      },
      (selected) => applyRowSelectionAsFilter(selected)
    );
  }
  function renderResultsTable() {
    if (!_data) return;
    const stats = getFilteredStats();
    const results = computeDriverResults(stats);
    const thead = document.getElementById("results-thead");
    buildResultsTableHeader(thead, activateParticipantSearch);
    const tbody = document.getElementById("results-tbody");
    renderResultsRows(tbody, results, _selectedRows, toggleRowSelection);
  }
  function getFilteredStats() {
    if (!_data) return [];
    const allStageNums = _data.stages.map((s) => s.num);
    let stats = _allStats;
    if (_data.groups.length && _filterState.groupFilter.size > 0)
      stats = stats.filter((s) => _filterState.groupFilter.has(s.group));
    if (_filterState.driverFilter.size > 0)
      stats = stats.filter((s) => _filterState.driverFilter.has(s.username));
    return stats.map(
      (s) => recalculateStatsForStages(s, _filterState.stageFilter, allStageNums, _recordMap)
    );
  }
  function toggleRowSelection(username, row) {
    if (_selectedRows.has(username)) {
      _selectedRows.delete(username);
      row.classList.remove("row-selected");
    } else {
      _selectedRows.add(username);
      row.classList.add("row-selected");
    }
    updateApplyBar();
  }
  function updateApplyBar() {
    const bar = document.getElementById("apply-filter-bar");
    const countEl = document.getElementById("apply-filter-count");
    if (!bar) return;
    if (_selectedRows.size > 0) {
      bar.classList.add("visible");
      if (countEl) countEl.textContent = `\u0412\u044B\u0431\u0440\u0430\u043D\u043E \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432: ${_selectedRows.size}`;
    } else {
      bar.classList.remove("visible");
    }
  }
  function applyRowSelectionAsFilter(selected) {
    if (!_data) return;
    _filterState.driverFilter = selected.size > 0 ? new Set(selected) : /* @__PURE__ */ new Set();
    _selectedRows = /* @__PURE__ */ new Set();
    updateApplyBar();
    syncResultsDriverCheckboxes(_data, _filterState);
    updateResultsFilterCounters(_data, _filterState);
    renderResultsTable();
  }
  function activateParticipantSearch(th) {
    if (_searchActive) return;
    _searchActive = true;
    const origLabel = th.textContent || "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A";
    th.textContent = "";
    const inp = document.createElement("input");
    inp.className = "th-search-input";
    inp.placeholder = "\u041F\u043E\u0438\u0441\u043A \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430\u2026";
    inp.type = "text";
    th.appendChild(inp);
    inp.focus();
    let debounce = null;
    inp.addEventListener("input", () => {
      if (debounce !== null) clearTimeout(debounce);
      debounce = setTimeout(() => scrollToMatchingParticipant(inp.value), 150);
    });
    inp.addEventListener("blur", () => {
      _searchActive = false;
      th.textContent = origLabel;
      th.className = "th-participant";
      clearParticipantHighlight();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape") inp.blur();
    });
  }
  function scrollToMatchingParticipant(query) {
    clearParticipantHighlight();
    if (!query.trim()) return;
    const ql = query.trim().toLowerCase();
    const rows = document.querySelectorAll("#results-tbody tr");
    for (const row of rows) {
      const name = (row.querySelector(".td-name-user")?.textContent ?? "").toLowerCase() + (row.querySelector(".td-name-real")?.textContent ?? "").toLowerCase();
      if (name.includes(ql)) {
        row.classList.add("row-search-highlight");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }
  function clearParticipantHighlight() {
    document.querySelectorAll(".row-search-highlight").forEach((r) => r.classList.remove("row-search-highlight"));
  }

  // src/renderer/index.ts
  var data = null;
  var eventName = "";
  var legendExpanded = false;
  var prevStageFilter = null;
  var lookups = buildRallyLookups({ records: [], stages: [], drivers: [], groups: [] });
  var chartState = {
    activeStageNums: /* @__PURE__ */ new Set(),
    activeDriverKeys: /* @__PURE__ */ new Set(),
    activeGroups: /* @__PURE__ */ new Set(),
    activeCars: /* @__PURE__ */ new Set(),
    visibleDriverKeys: /* @__PURE__ */ new Set()
  };
  var chartCtrl = createChartController();
  window.addEventListener("DOMContentLoaded", () => {
    qs("#btn-choose-file").addEventListener("click", () => {
      qs("#file-input").click();
    });
    qs("#file-input").addEventListener("change", onFileInputChange);
    qs("#inp-event-name").addEventListener("input", (e) => {
      eventName = e.target.value.trim();
      const el = document.getElementById("header-event-name");
      if (el) el.textContent = eventName || "Rally Race Chart";
    });
    qs("#btn-back").addEventListener("click", showWelcome);
    qs("#pinned-close").addEventListener("click", unpinDriver);
    qs("#tab-chart").addEventListener("click", () => switchTab("chart"));
    qs("#tab-results").addEventListener("click", () => switchTab("results"));
    qs("#tab-comments").addEventListener("click", () => switchTab("comments"));
    qs("#legend-expand-btn").addEventListener("click", toggleLegendExpand);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && chartCtrl.getPinnedIndex() !== null) unpinDriver();
    });
    document.addEventListener("mousemove", onCellTooltipMove);
    window.__onStageBandClick = handleStageBandClick;
  });
  async function onFileInputChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const btn = qs("#btn-choose-file");
    const info = qs("#file-info");
    btn.disabled = true;
    info.textContent = "\u0427\u0442\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u0430\u2026";
    info.className = "file-info loading";
    chartCtrl.destroy();
    try {
      const text = await readFileAsText(file);
      data = parseCsvText(text);
      lookups = buildRallyLookups(data);
      const allStats = computeAllDriverStats(data, lookups.recordMap);
      initResultsModule(data, lookups.recordMap, allStats);
      eventName = qs("#inp-event-name").value.trim();
      info.textContent = `\u2713 \u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E: ${data.stages.length} \u0443\u0447\u0430\u0441\u0442\u043A\u043E\u0432, ${data.drivers.length} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432`;
      info.className = "file-info ok";
      showChart();
    } catch (err) {
      info.textContent = `\u2717 \u041E\u0448\u0438\u0431\u043A\u0430: ${err instanceof Error ? err.message : String(err)}`;
      info.className = "file-info error";
    } finally {
      btn.disabled = false;
      e.target.value = "";
    }
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B"));
      reader.readAsText(file, "utf-8");
    });
  }
  function showWelcome() {
    document.getElementById("screen-welcome").style.display = "flex";
    document.getElementById("screen-chart").style.display = "none";
    document.getElementById("chart-tooltip").style.display = "none";
    chartCtrl.destroy();
    document.getElementById("header-stats").textContent = "";
    document.getElementById("pinned-bar").style.display = "none";
    const legendItems = document.getElementById("legend-items");
    if (legendItems) legendItems.innerHTML = "";
    document.getElementById("legend-panel").style.display = "none";
    prevStageFilter = null;
  }
  function showChart() {
    if (!data) return;
    chartState.activeStageNums = new Set(data.stages.map((s) => s.num));
    chartState.activeDriverKeys = new Set(data.drivers.map((d) => d.username));
    chartState.activeGroups = new Set(data.groups);
    chartState.activeCars = new Set(data.drivers.map((d) => d.car).filter(Boolean));
    chartState.visibleDriverKeys = new Set(data.drivers.map((d) => d.username));
    prevStageFilter = null;
    legendExpanded = false;
    document.getElementById("screen-welcome").style.display = "none";
    document.getElementById("screen-chart").style.display = "flex";
    document.getElementById("header-event-name").textContent = eventName || "Rally Race Chart";
    buildChartFilterPanel(data, chartState, makeFilterCallbacks());
    buildResultsFilters(() => {
    });
    switchTab("chart");
    updateHeaderStats();
  }
  function updateHeaderStats() {
    if (!data) return;
    const lastStage = data.stages.reduce((m, s) => s.num > m ? s.num : m, 0);
    const finished = data.drivers.filter(
      (d) => lookups.recordMap.get(d.username)?.get(lastStage)?.time3 != null
    ).length;
    document.getElementById("header-stats").textContent = `| \u{1F464} ${finished}/${data.drivers.length}  |  SS ${data.stages.length}`;
  }
  function switchTab(tab) {
    qs("#tab-chart").classList.toggle("active", tab === "chart");
    qs("#tab-results").classList.toggle("active", tab === "results");
    qs("#tab-comments").classList.toggle("active", tab === "comments");
    document.getElementById("view-chart").style.display = tab === "chart" ? "flex" : "none";
    document.getElementById("view-results").style.display = tab === "results" ? "flex" : "none";
    document.getElementById("view-comments").style.display = tab === "comments" ? "flex" : "none";
    document.getElementById("sidebar-chart-filters").style.display = tab === "chart" ? "" : "none";
    document.getElementById("sidebar-results-filters").style.display = tab === "results" ? "" : "none";
    document.getElementById("sidebar-comments-filters").style.display = tab === "comments" ? "" : "none";
    document.getElementById("legend-panel").style.display = tab === "chart" ? "" : "none";
    if (tab === "chart" && !chartCtrl.getChart()) rebuildChart();
    if (tab === "chart" && chartCtrl.getChart()) refreshLegend();
    if (tab === "results") renderResultsTable();
    if (tab === "comments") renderCommentsView(data);
  }
  function makeFilterCallbacks() {
    return {
      onStagesChanged: () => {
        updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
        rebuildChart();
        afterFilterChange();
      },
      onDriversChanged: () => {
        syncDatasetVisibility();
        afterFilterChange();
      },
      onGroupsChanged: () => {
        syncDatasetVisibility();
        afterFilterChange();
      },
      onCarsChanged: () => {
        syncDatasetVisibility();
        afterFilterChange();
      },
      onDriverHover: (key) => {
        chartCtrl.setHoveredKey(key);
      }
    };
  }
  function syncDatasetVisibility() {
    chartCtrl.updateDatasetVisibility(
      data,
      chartState.activeDriverKeys,
      chartState.activeGroups,
      chartState.activeCars
    );
  }
  function afterFilterChange() {
    if (!data) return;
    updateFilterCounters(data, chartState);
    updateToggleButtonStates(data, chartState);
    refreshLegend();
  }
  function unpinDriver() {
    chartCtrl.pinDriver(null);
    updatePinnedBar(data, chartCtrl.getChart(), null);
    highlightLegendItem(null);
    refreshLegend();
  }
  function handleStageBandClick(stageNum) {
    const isSingleAndSame = chartState.activeStageNums.size === 1 && chartState.activeStageNums.has(stageNum) && prevStageFilter !== null;
    if (isSingleAndSame) {
      chartState.activeStageNums = prevStageFilter;
      prevStageFilter = null;
    } else {
      prevStageFilter = new Set(chartState.activeStageNums);
      chartState.activeStageNums = /* @__PURE__ */ new Set([stageNum]);
    }
    syncStageCheckboxes(chartState.activeStageNums);
    updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
    rebuildChart();
    afterFilterChange();
  }
  function rebuildChart() {
    if (!data) return;
    const stages = data.stages.filter((s) => chartState.activeStageNums.has(s.num)).sort((a, b) => a.num - b.num);
    chartCtrl.build(
      data,
      stages,
      lookups.recordMap,
      lookups.cumPenMap,
      lookups.cumSPMap,
      lookups.cumSRMap,
      chartState.activeDriverKeys,
      chartState.activeGroups,
      chartState.activeCars
    );
    chartCtrl.setOnPinChange((key) => {
      updatePinnedBar(data, chartCtrl.getChart(), chartCtrl.getPinnedIndex());
      highlightLegendItem(key);
      refreshLegend();
    });
    document.getElementById("pinned-bar").style.display = "none";
    afterFilterChange();
  }
  function toggleLegendExpand() {
    legendExpanded = !legendExpanded;
    refreshLegend();
  }
  function refreshLegend() {
    if (!data || !chartCtrl.getChart()) return;
    const callbacks = {
      onDriverHover: (key) => chartCtrl.setHoveredKey(key),
      onDriverClick: (key) => {
        const chart = chartCtrl.getChart();
        if (!chart) return;
        const dsIdx = chart.data.datasets.findIndex((ds) => ds.driverKey === key);
        if (dsIdx === -1) return;
        const currentPinned = chartCtrl.getPinnedIndex();
        if (currentPinned === dsIdx) {
          chartCtrl.pinDriver(null);
          updatePinnedBar(data, chart, null);
          highlightLegendItem(null);
          refreshLegend();
        } else {
          chartCtrl.pinDriver(dsIdx);
          updatePinnedBar(data, chart, dsIdx);
          highlightLegendItem(key);
          refreshLegend();
        }
      }
    };
    updateLegendPanel(
      data,
      chartCtrl.getChart(),
      chartCtrl.getActiveStages(),
      lookups.recordMap,
      chartState.activeDriverKeys,
      chartState.activeGroups,
      chartState.activeCars,
      legendExpanded,
      chartCtrl.getPinnedDriverKey(),
      callbacks
    );
  }
  function highlightLegendItem(driverKey) {
    const inner = document.getElementById("legend-inner");
    if (!inner) return;
    inner.querySelectorAll(".legend-item.pinned-highlight").forEach((el) => el.classList.remove("pinned-highlight"));
    if (!driverKey) return;
    const items = inner.querySelectorAll(".legend-item");
    for (const item of items) {
      if (item.dataset["driverKey"] === driverKey) {
        item.classList.add("pinned-highlight");
        const itemRect = item.getBoundingClientRect();
        const innerRect = inner.getBoundingClientRect();
        const offset = itemRect.top - innerRect.top - innerRect.height / 2 + itemRect.height / 2;
        inner.scrollBy({ top: offset, behavior: "smooth" });
        break;
      }
    }
  }
  function onCellTooltipMove(e) {
    const tipEl = document.getElementById("cell-tooltip");
    const tip = e.target.dataset["tooltip"];
    if (!tip) {
      tipEl.style.display = "none";
      return;
    }
    tipEl.textContent = tip;
    tipEl.style.display = "block";
    let tx = e.clientX + 12;
    let ty = e.clientY - 30;
    const tr = tipEl.getBoundingClientRect();
    if (tx + tr.width > window.innerWidth - 8) tx = e.clientX - tr.width - 12;
    if (ty < 8) ty = e.clientY + 16;
    tipEl.style.left = `${tx}px`;
    tipEl.style.top = `${ty}px`;
  }
})();
