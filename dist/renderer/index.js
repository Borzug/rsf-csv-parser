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

  // src/i18n/translations.ts
  var ru = {
    welcomeTitle: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 \u0440\u0430\u043B\u043B\u0438",
    welcomeDesc: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 CSV-\u0444\u0430\u0439\u043B \u0441 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C\u0438 \u0433\u043E\u043D\u043A\u0438.",
    eventNameLabel: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F",
    eventNameOptional: "(\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
    selectFileButton: "\u{1F4C2} \u0412\u044B\u0431\u0440\u0430\u0442\u044C CSV-\u0444\u0430\u0439\u043B",
    fileReading: "\u0427\u0442\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u0430\u2026",
    fileLoaded: (stages, drivers) => `\u2713 \u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E: ${stages} \u0443\u0447\u0430\u0441\u0442\u043A\u043E\u0432, ${drivers} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432`,
    fileError: "\u2717 \u041E\u0448\u0438\u0431\u043A\u0430",
    fileReadError: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B",
    defaultTitle: "Rally Race Chart",
    filtersLabel: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B",
    backButton: "\u2190 \u041D\u0430\u0437\u0430\u0434",
    headerStats: (finished, total, stages) => `\u0444\u0438\u043D\u0438\u0448\u0438\u0440\u043E\u0432\u0430\u043B\u0438 ${finished} \u0438\u0437 ${total} \xB7 \u0421\u0423: ${stages}`,
    tabChart: "\u{1F4C8} \u0413\u0440\u0430\u0444\u0438\u043A",
    tabResults: "\u{1F3C6} \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B",
    tabComments: "\u{1F4AC} \u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438",
    chartLegendSuccess: "\u0423\u0441\u043F\u0435\u0448\u043D\u044B\u0439 \u043F\u0440\u043E\u0435\u0437\u0434",
    chartLegendSuperRally: "Super Rally",
    chartLegendComment: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439",
    axisTimeTitle: "\u0412\u0440\u0435\u043C\u044F",
    axisTimeUnits: { h: "\u0447", m: "\u043C", s: "\u0441" },
    yModeAbs: "\u0412\u0440\u0435\u043C\u044F",
    yModeLeader: "\u041E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430",
    yModePinned: "\u041E\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E",
    yModePinnedDisabled: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430 \u043D\u0430 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u0438\u043B\u0438 \u0432 \u043B\u0435\u0433\u0435\u043D\u0434\u0435",
    tooltipGapLeader: "\u041A \u043B\u0438\u0434\u0435\u0440\u0443",
    tooltipGapPinned: "\u041A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443",
    dropHint: "\u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u0432 \u043E\u043A\u043D\u043E",
    dropOverlay: "\u041E\u0442\u043F\u0443\u0441\u0442\u0438\u0442\u0435 CSV-\u0444\u0430\u0439\u043B",
    welcomeHelp: "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u043E\u043D\u043B\u0430\u0439\u043D-\u0440\u0430\u043B\u043B\u0438, \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0441 rallysimfans.hu (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, 105003_table.csv).",
    resumeButton: (name) => `\u2190 \u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043A \u0430\u043D\u0430\u043B\u0438\u0437\u0443: ${name}`,
    rallyTitle: (id) => `\u0420\u0430\u043B\u043B\u0438 #${id}`,
    rallyLinkTitle: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0440\u0430\u043B\u043B\u0438 \u043D\u0430 rallysimfans.hu",
    pinnedHint: "Ctrl/Shift + \u043A\u043B\u0438\u043A \u2014 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044E",
    pinnedHintTouch: "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0438\u043C\u044F \u0432 \u043B\u0435\u0433\u0435\u043D\u0434\u0435, \u0447\u0442\u043E\u0431\u044B \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044E",
    chartAriaLabel: "\u0413\u0440\u0430\u0444\u0438\u043A \u0445\u043E\u0434\u0430 \u0433\u043E\u043D\u043A\u0438: \u043D\u0430\u043A\u043E\u043F\u043B\u0435\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u043F\u043E \u0441\u043F\u043B\u0438\u0442\u0430\u043C",
    closeLabel: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
    pinnedChipRemove: "\u0423\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F",
    presetTop: (n) => `\u0422\u043E\u043F-${n}`,
    presetTopTitle: (n) => `\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u044B\u0435 ${n} \u043C\u0435\u0441\u0442 \u0441\u0440\u0435\u0434\u0438 \u0432\u0438\u0434\u0438\u043C\u044B\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432`,
    presetFinished: "\u0424\u0438\u043D\u0438\u0448",
    presetFinishedTitle: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u0438\u043D\u0438\u0448\u0438\u0440\u043E\u0432\u0430\u0432\u0448\u0438\u0445",
    selectedCount: (n) => `\u0412\u044B\u0431\u0440\u0430\u043D\u043E \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432: ${n}`,
    pinnedCloseTitle: "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 (Esc)",
    legendExpandTitle: "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C",
    filterChartStages: "\u0421\u043F\u0435\u0446\u0443\u0447\u0430\u0441\u0442\u043A\u0438",
    filterParticipants: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438",
    filterGroupClass: "\u0413\u0440\u0443\u043F\u043F\u0430 / \u041A\u043B\u0430\u0441\u0441",
    filterCar: "\u0410\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044C",
    filterResultsStages: "\u042D\u0442\u0430\u043F\u044B",
    filterResultsClass: "\u041A\u043B\u0430\u0441\u0441",
    filterAll: "\u0412\u0441\u0435",
    filterNone: "\u041D\u0438\u0447\u0435\u0433\u043E",
    filterSearch: "\u041F\u043E\u0438\u0441\u043A\u2026",
    colPosition: "#",
    colParticipant: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A",
    colClass: "\u041A\u043B\u0430\u0441\u0441",
    colCar: "\u0410\u0432\u0442\u043E\u043C\u043E\u0431\u0438\u043B\u044C",
    colTotalTime: "\u041E\u0431\u0449\u0435\u0435 \u0432\u0440\u0435\u043C\u044F",
    colPenalties: "\u0428\u0442\u0440\u0430\u0444\u044B",
    colAvgGapLeader: "\u0422\u0435\u043C\u043F/\u0421\u0423: \u043B\u0438\u0434\u0435\u0440",
    colAvgGapPrev: "\u0422\u0435\u043C\u043F/\u0421\u0423: \u043F\u0440\u0435\u0434.",
    colCleanGapLeader: "\u0427\u0438\u0441\u0442. \u0442\u0435\u043C\u043F: \u043B\u0438\u0434\u0435\u0440",
    colCleanGapPrev: "\u0427\u0438\u0441\u0442. \u0442\u0435\u043C\u043F: \u043F\u0440\u0435\u0434.",
    colTotalGap: "\u041E\u0431\u0449\u0435\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435",
    colSuperRally: "SR",
    colAvgGapLeaderTitle: "\u041E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u043F\u0443 \u043E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR",
    colAvgGapPrevTitle: "\u041E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u043F\u0443 \u043E\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u0441 \u0443\u0447\u0451\u0442\u043E\u043C SR",
    colCleanGapLeaderTitle: "\u0427\u0438\u0441\u0442\u043E\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u043F\u0443 \u043E\u0442 \u043B\u0438\u0434\u0435\u0440\u0430 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A\n\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432",
    colCleanGapPrevTitle: "\u0427\u0438\u0441\u0442\u043E\u0435 \u043E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u043F\u0443 \u043E\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A\n\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432",
    cleanGapCellTooltip: (used, total) => `\u041E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435 \u043F\u043E \u0442\u0435\u043C\u043F\u0443 \u0437\u0430 \u0443\u0447\u0430\u0441\u0442\u043E\u043A
\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u043E \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0438 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F ${used}/${total} \u044D\u0442\u0430\u043F\u043E\u0432
\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u0447\u0430\u0441\u0442\u043A\u0438 \u0431\u0435\u0437 SR \u0434\u043B\u044F \u043E\u0431\u043E\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432`,
    applyFilterButton: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430\u043C",
    tooltipPenalty: "\u0428\u0442\u0440\u0430\u0444",
    tooltipServicePenalty: "Service Penalty",
    tooltipSuperRally: "Super Rally",
    commentsEmpty: "\u041D\u0435\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432 \u0432 \u044D\u0442\u043E\u0439 \u0433\u043E\u043D\u043A\u0435",
    commentsSearchLabel: "\u041F\u043E\u0438\u0441\u043A \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430",
    commentsSearchPlaceholder: "\u0418\u043C\u044F \u0438\u043B\u0438 \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u2026",
    commentsLeader: "\u{1F947} \u043B\u0438\u0434\u0435\u0440",
    commentsGap: (time) => `\u041E\u0442\u0441\u0442\u0430\u0432\u0430\u043D\u0438\u0435: +${time}`,
    commentsPenalty: (time) => `+${time} \u0448\u0442\u0440\u0430\u0444`,
    commentsServicePenalty: (time) => `+${time} \u0441\u0435\u0440\u0432\u0438\u0441`,
    commentsCount: (n) => {
      if (n % 10 === 1 && n % 100 !== 11) return `${n} \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439`;
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F`;
      return `${n} \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432`;
    }
  };
  var en = {
    welcomeTitle: "Load Rally Data",
    welcomeDesc: "Select a CSV file with race results.",
    eventNameLabel: "Event Name",
    eventNameOptional: "(optional)",
    selectFileButton: "\u{1F4C2} Select CSV File",
    fileReading: "Reading file\u2026",
    fileLoaded: (stages, drivers) => `\u2713 Loaded: ${stages} stages, ${drivers} participants`,
    fileError: "\u2717 Error",
    fileReadError: "Failed to read file",
    defaultTitle: "Rally Race Chart",
    filtersLabel: "Filters",
    backButton: "\u2190 Back",
    headerStats: (finished, total, stages) => `${finished} of ${total} finished \xB7 ${stages} stage${stages !== 1 ? "s" : ""}`,
    tabChart: "\u{1F4C8} Chart",
    tabResults: "\u{1F3C6} Results",
    tabComments: "\u{1F4AC} Comments",
    chartLegendSuccess: "Completed stage",
    chartLegendSuperRally: "Super Rally",
    chartLegendComment: "Comment",
    axisTimeTitle: "Time",
    axisTimeUnits: { h: "h", m: "m", s: "s" },
    yModeAbs: "Time",
    yModeLeader: "Gap to leader",
    yModePinned: "Gap to selected",
    yModePinnedDisabled: "Select a driver on the chart or in the legend",
    tooltipGapLeader: "To leader",
    tooltipGapPinned: "To selected",
    dropHint: "or drop the file into the window",
    dropOverlay: "Drop the CSV file",
    welcomeHelp: "Online rally results table exported from rallysimfans.hu (e.g. 105003_table.csv).",
    resumeButton: (name) => `\u2190 Back to analysis: ${name}`,
    rallyTitle: (id) => `Rally #${id}`,
    rallyLinkTitle: "Open the rally on rallysimfans.hu",
    pinnedHint: "Ctrl/Shift + click to add to comparison",
    pinnedHintTouch: "Tap a name in the legend to add it to the comparison",
    chartAriaLabel: "Race progress chart: cumulative time of each driver by split",
    closeLabel: "Close",
    pinnedChipRemove: "Remove from comparison",
    presetTop: (n) => `Top ${n}`,
    presetTopTitle: (n) => `Keep the top ${n} of the visible drivers`,
    presetFinished: "Finished",
    presetFinishedTitle: "Keep only drivers who finished",
    selectedCount: (n) => `Selected: ${n}`,
    pinnedCloseTitle: "Unpin (Esc)",
    legendExpandTitle: "Expand",
    filterChartStages: "Stages",
    filterParticipants: "Participants",
    filterGroupClass: "Group / Class",
    filterCar: "Car",
    filterResultsStages: "Stages",
    filterResultsClass: "Class",
    filterAll: "All",
    filterNone: "None",
    filterSearch: "Search\u2026",
    colPosition: "#",
    colParticipant: "Participant",
    colClass: "Class",
    colCar: "Car",
    colTotalTime: "Total Time",
    colPenalties: "Penalties",
    colAvgGapLeader: "Pace/SS: leader",
    colAvgGapPrev: "Pace/SS: prev",
    colCleanGapLeader: "Clean pace: leader",
    colCleanGapPrev: "Clean pace: prev",
    colTotalGap: "Total Gap",
    colSuperRally: "SR",
    colAvgGapLeaderTitle: "Pace difference to leader per stage (SR included)",
    colAvgGapPrevTitle: "Pace difference to previous position per stage (SR included)",
    colCleanGapLeaderTitle: "Clean pace difference to leader\nOnly stages without SR for both drivers",
    colCleanGapPrevTitle: "Clean pace difference to previous\nOnly stages without SR for both drivers",
    cleanGapCellTooltip: (used, total) => `Pace difference per stage
Calculated from ${used}/${total} stages
Only stages without SR for both drivers`,
    applyFilterButton: "Apply Participant Filter",
    tooltipPenalty: "Penalty",
    tooltipServicePenalty: "Service Penalty",
    tooltipSuperRally: "Super Rally",
    commentsEmpty: "No comments in this race",
    commentsSearchLabel: "Search participant",
    commentsSearchPlaceholder: "Name or username\u2026",
    commentsLeader: "\u{1F947} leader",
    commentsGap: (time) => `Gap: +${time}`,
    commentsPenalty: (time) => `+${time} penalty`,
    commentsServicePenalty: (time) => `+${time} service`,
    commentsCount: (n) => `${n} comment${n !== 1 ? "s" : ""}`
  };
  var hu = {
    welcomeTitle: "Rally adatok bet\xF6lt\xE9se",
    welcomeDesc: "V\xE1lassz egy CSV f\xE1jlt a versenyeredm\xE9nyekkel.",
    eventNameLabel: "Esem\xE9ny neve",
    eventNameOptional: "(opcion\xE1lis)",
    selectFileButton: "\u{1F4C2} CSV f\xE1jl kiv\xE1laszt\xE1sa",
    fileReading: "F\xE1jl olvas\xE1sa\u2026",
    fileLoaded: (stages, drivers) => `\u2713 Bet\xF6ltve: ${stages} szakasz, ${drivers} r\xE9sztvev\u0151`,
    fileError: "\u2717 Hiba",
    fileReadError: "A f\xE1jl olvas\xE1sa sikertelen",
    defaultTitle: "Rally Race Chart",
    filtersLabel: "Sz\u0171r\u0151k",
    backButton: "\u2190 Vissza",
    headerStats: (finished, total, stages) => `${total} indul\xF3b\xF3l ${finished} c\xE9lba \xE9rt \xB7 ${stages} szakasz`,
    tabChart: "\u{1F4C8} Grafikon",
    tabResults: "\u{1F3C6} Eredm\xE9nyek",
    tabComments: "\u{1F4AC} Megjegyz\xE9sek",
    chartLegendSuccess: "Teljes\xEDtett szakasz",
    chartLegendSuperRally: "Super Rally",
    chartLegendComment: "Megjegyz\xE9s",
    axisTimeTitle: "Id\u0151",
    axisTimeUnits: { h: "\xF3", m: "p", s: "mp" },
    yModeAbs: "Id\u0151",
    yModeLeader: "H\xE1tr\xE1ny a vezet\u0151t\u0151l",
    yModePinned: "H\xE1tr\xE1ny a kijel\xF6ltt\u0151l",
    yModePinnedDisabled: "V\xE1lassz versenyz\u0151t a grafikonon vagy a jelmagyar\xE1zatban",
    tooltipGapLeader: "Vezet\u0151h\xF6z",
    tooltipGapPinned: "Kijel\xF6lth\xF6z",
    dropHint: "vagy h\xFAzd a f\xE1jlt az ablakba",
    dropOverlay: "Engedd el a CSV f\xE1jlt",
    welcomeHelp: "A rallysimfans.hu oldalr\xF3l export\xE1lt online rally eredm\xE9nyt\xE1bla (pl. 105003_table.csv).",
    resumeButton: (name) => `\u2190 Vissza az elemz\xE9shez: ${name}`,
    rallyTitle: (id) => `Rally #${id}`,
    rallyLinkTitle: "Rally megnyit\xE1sa a rallysimfans.hu oldalon",
    pinnedHint: "Ctrl/Shift + kattint\xE1s \u2014 hozz\xE1ad\xE1s az \xF6sszehasonl\xEDt\xE1shoz",
    pinnedHintTouch: "Koppints egy n\xE9vre a jelmagyar\xE1zatban az \xF6sszehasonl\xEDt\xE1shoz",
    chartAriaLabel: "A verseny alakul\xE1sa: a versenyz\u0151k \xF6sszes\xEDtett ideje r\xE9szid\u0151nk\xE9nt",
    closeLabel: "Bez\xE1r\xE1s",
    pinnedChipRemove: "Elt\xE1vol\xEDt\xE1s az \xF6sszehasonl\xEDt\xE1sb\xF3l",
    presetTop: (n) => `Top ${n}`,
    presetTopTitle: (n) => `Csak a l\xE1that\xF3 versenyz\u0151k els\u0151 ${n} helyezettje`,
    presetFinished: "C\xE9lba \xE9rtek",
    presetFinishedTitle: "Csak a c\xE9lba \xE9rt versenyz\u0151k",
    selectedCount: (n) => `Kijel\xF6lve: ${n}`,
    pinnedCloseTitle: "R\xF6gz\xEDt\xE9s felold\xE1sa (Esc)",
    legendExpandTitle: "Kibont\xE1s",
    filterChartStages: "Szakaszok",
    filterParticipants: "R\xE9sztvev\u0151k",
    filterGroupClass: "Csoport / Oszt\xE1ly",
    filterCar: "Aut\xF3",
    filterResultsStages: "Szakaszok",
    filterResultsClass: "Oszt\xE1ly",
    filterAll: "Mind",
    filterNone: "Senki",
    filterSearch: "Keres\xE9s\u2026",
    colPosition: "#",
    colParticipant: "R\xE9sztvev\u0151",
    colClass: "Oszt\xE1ly",
    colCar: "Aut\xF3",
    colTotalTime: "\xD6sszes id\u0151",
    colPenalties: "B\xFCntet\xE9sek",
    colAvgGapLeader: "\xC1tl. h\xE1tr\xE1ny vez.",
    colAvgGapPrev: "\xC1tl. h\xE1tr\xE1ny el\u0151z\u0151",
    colCleanGapLeader: "Tiszta h\xE1tr\xE1ny vez.",
    colCleanGapPrev: "Tiszta h\xE1tr\xE1ny el\u0151z\u0151",
    colTotalGap: "\xD6sszes h\xE1tr\xE1ny",
    colSuperRally: "SR",
    colAvgGapLeaderTitle: "\xC1tlagos h\xE1tr\xE1ny a vez\xE9rt\u0151l szakaszonk\xE9nt (SR-rel)",
    colAvgGapPrevTitle: "\xC1tlagos h\xE1tr\xE1ny az el\u0151z\u0151 helyezett\u0151l szakaszonk\xE9nt (SR-rel)",
    colCleanGapLeaderTitle: "\xC1tlagos tiszta h\xE1tr\xE1ny a vez\xE9rt\u0151l\nCsak SR n\xE9lk\xFCli szakaszok mindk\xE9t versenyz\u0151n\xE9l",
    colCleanGapPrevTitle: "\xC1tlagos tiszta h\xE1tr\xE1ny az el\u0151z\u0151t\u0151l\nCsak SR n\xE9lk\xFCli szakaszok mindk\xE9t versenyz\u0151n\xE9l",
    cleanGapCellTooltip: (used, total) => `Sz\xE1m\xEDtva: ${used}/${total} szakasz alapj\xE1n
Csak SR n\xE9lk\xFCli szakaszok mindk\xE9t versenyz\u0151n\xE9l`,
    applyFilterButton: "R\xE9sztvev\u0151 sz\u0171r\u0151 alkalmaz\xE1sa",
    tooltipPenalty: "B\xFCntet\xE9s",
    tooltipServicePenalty: "Szerviz b\xFCntet\xE9s",
    tooltipSuperRally: "Super Rally",
    commentsEmpty: "Nincsenek megjegyz\xE9sek ebben a versenyen",
    commentsSearchLabel: "R\xE9sztvev\u0151 keres\xE9se",
    commentsSearchPlaceholder: "N\xE9v vagy felhaszn\xE1l\xF3n\xE9v\u2026",
    commentsLeader: "\u{1F947} vezet\u0151",
    commentsGap: (time) => `H\xE1tr\xE1ny: +${time}`,
    commentsPenalty: (time) => `+${time} b\xFCntet\xE9s`,
    commentsServicePenalty: (time) => `+${time} szerviz`,
    commentsCount: (n) => `${n} megjegyz\xE9s`
  };

  // src/i18n/i18n.ts
  var STORAGE_KEY = "rsf-language";
  var TRANSLATIONS = { ru, en, hu };
  var I18nService = class {
    constructor() {
      this.callbacks = [];
      const stored = localStorage.getItem(STORAGE_KEY);
      this.currentLanguage = stored && stored in TRANSLATIONS ? stored : this.detectLanguage();
    }
    detectLanguage() {
      const locale = navigator.language?.toLowerCase() ?? "";
      if (locale.startsWith("ru")) return "ru";
      if (locale.startsWith("hu")) return "hu";
      return "en";
    }
    t() {
      return TRANSLATIONS[this.currentLanguage];
    }
    getLanguage() {
      return this.currentLanguage;
    }
    setLanguage(lang) {
      if (lang === this.currentLanguage) return;
      this.currentLanguage = lang;
      localStorage.setItem(STORAGE_KEY, lang);
      this.callbacks.forEach((cb) => cb(lang));
    }
    onLanguageChange(cb) {
      this.callbacks.push(cb);
    }
  };
  var i18n = new I18nService();

  // src/lang-switcher.ts
  function initLangSwitcher(onChanged) {
    const switcher = document.getElementById("lang-switcher");
    if (!switcher) return;
    updateActiveLangButton(switcher, i18n.getLanguage());
    switcher.addEventListener("click", (e) => {
      const btn = e.target.closest(".lang-btn");
      if (!btn) return;
      const lang = btn.dataset["lang"];
      if (!lang) return;
      i18n.setLanguage(lang);
      updateActiveLangButton(switcher, lang);
      onChanged();
    });
  }
  function updateActiveLangButton(switcher, lang) {
    switcher.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset["lang"] === lang);
      btn.setAttribute("aria-pressed", String(btn.dataset["lang"] === lang));
    });
  }

  // src/renderer/utils.ts
  function formatTime(sec) {
    if (sec === null || isNaN(sec)) return "DNF";
    const tenths = Math.round(Math.abs(sec) * 10);
    const h = Math.floor(tenths / 36e3);
    const m = Math.floor(tenths % 36e3 / 600);
    const s = Math.floor(tenths % 600 / 10);
    const d = tenths % 10;
    const sign = sec < 0 && tenths > 0 ? "-" : "";
    const ss = `${String(s).padStart(2, "0")}.${d}`;
    return h > 0 ? `${sign}${h}:${String(m).padStart(2, "0")}:${ss}` : `${sign}${m}:${ss}`;
  }
  function formatTimeSigned(sec) {
    if (sec === null) return "\u2014";
    return (sec >= 0 ? "+" : "") + formatTime(sec);
  }
  function formatYAxisTick(sec, units) {
    if (sec === 0) return "0";
    const a = Math.abs(sec);
    const h = Math.floor(a / 3600);
    const m = Math.floor(a % 3600 / 60);
    const s = Math.floor(a % 60);
    const parts = [];
    if (h) parts.push(`${h}${units.h}`);
    if (m) parts.push(`${m}${units.m}`);
    if (s) parts.push(`${s}${units.s}`);
    return parts.length ? (sec < 0 ? "-" : "") + parts.join(" ") : "0";
  }
  function computeYAxisStep(maxSec) {
    if (maxSec <= 0) return 60;
    const target = maxSec / 7;
    const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
    return steps.find((v) => v >= target) ?? 28800;
  }
  function isCoarsePointer() {
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
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
    "#ef5350",
    "#42a5f5",
    "#66bb6a",
    "#ec407a",
    "#ffa726",
    "#9ccc65",
    "#26c6da",
    "#9575cd"
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
        pointRadius: 0,
        pointBackgroundColor: color,
        pointHoverRadius: 0,
        _ptHoverRadius: POINT_HOVER_RADIUS,
        _ptStyle: pts.pointStyles,
        _ptRadius: pts.pointRadii,
        _ptColor: pts.pointColors,
        tension: 0,
        spanGaps: false,
        hidden: !activeDriverKeys.has(drv.username) || !grpOk || !carOk,
        // Функция стиля отрезков вызывается на каждый отрезок при каждом update(),
        // поэтому подключаем её только линиям, где пунктир действительно есть
        segment: pts.hasSR.some(Boolean) || dnfCommentPtIdx !== null ? {
          borderDash: (ctx) => pts.hasSR[ctx.p1DataIndex] || ctx.p1DataIndex === dnfCommentPtIdx ? [DASH_ON, DASH_OFF] : void 0
        } : void 0,
        _cumPen: pts.cumPen,
        _cumSP: pts.cumSP,
        _cumSR: pts.cumSR,
        _hasSR: pts.hasSR,
        _cmts: pts.cmts,
        _stageLabels: pts.stageLabels
      };
    });
  }
  function markDnf(hasCmt, rec, lastValidPtIdx, dnfCommentPtIdx, setDnfIdx, pointStyles, pointRadii, pointColors, cmts, color) {
    if (!hasCmt || dnfCommentPtIdx !== null || lastValidPtIdx === 0) return;
    pointStyles[lastValidPtIdx] = "rectRot";
    pointRadii[lastValidPtIdx] = POINT_RADIUS_COMMENT;
    pointColors[lastValidPtIdx] = "#fff";
    cmts[lastValidPtIdx] = rec.comment;
    setDnfIdx(lastValidPtIdx);
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
    for (const st of stages) {
      const rec = recordMap.get(drv.username)?.get(st.num) ?? null;
      const pen = cumPenMap.get(drv.username)?.get(st.num) ?? 0;
      const sp = cumSPMap.get(drv.username)?.get(st.num) ?? 0;
      const srBase = cumSRMap.get(drv.username)?.get(st.num) ?? 0;
      const srThis = rec?.superRally ? 1 : 0;
      const thisSR = srThis > 0;
      const hasCmt = !!rec?.comment?.trim();
      const slFull = `SS${st.num} ${st.name}`;
      const pushMeta = (count) => {
        for (let k = 0; k < count; k++) {
          cumPen.push(pen);
          cumSP.push(sp);
          cumSR.push(srBase + srThis);
          hasSR.push(thisSR);
        }
      };
      if (isDnf) {
        y.push(null, null, null);
        pointStyles.push("circle", "circle", "circle");
        pointRadii.push(0, 0, 0);
        pointColors.push(color, color, color);
        pushMeta(3);
        cmts.push("", "", "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        continue;
      }
      if (!rec || rec.time1 === null) {
        markDnf(
          hasCmt,
          rec,
          lastValidPtIdx,
          dnfCommentPtIdx,
          (idx) => {
            dnfCommentPtIdx = idx;
          },
          pointStyles,
          pointRadii,
          pointColors,
          cmts,
          color
        );
        y.push(null, null, null);
        pointStyles.push("circle", "circle", "circle");
        pointRadii.push(0, 0, 0);
        pointColors.push(color, color, color);
        pushMeta(3);
        cmts.push("", "", "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        isDnf = true;
        continue;
      }
      const t1 = rec.time1;
      if (rec.time2 === null) {
        y.push(cum + t1, null, null);
        pointStyles.push("circle", "circle", "circle");
        pointRadii.push(POINT_RADIUS_NORMAL, 0, 0);
        pointColors.push(color, color, color);
        pushMeta(3);
        cmts.push("", "", "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        lastValidPtIdx = y.length - 3;
        markDnf(
          hasCmt,
          rec,
          lastValidPtIdx,
          dnfCommentPtIdx,
          (idx) => {
            dnfCommentPtIdx = idx;
          },
          pointStyles,
          pointRadii,
          pointColors,
          cmts,
          color
        );
        isDnf = true;
        continue;
      }
      const t2 = rec.time2;
      if (rec.time3 === null) {
        y.push(cum + t1, cum + t2, null);
        pointStyles.push("circle", "circle", "circle");
        pointRadii.push(POINT_RADIUS_NORMAL, POINT_RADIUS_NORMAL, 0);
        pointColors.push(color, color, color);
        pushMeta(3);
        cmts.push("", "", "");
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        lastValidPtIdx = y.length - 2;
        markDnf(
          hasCmt,
          rec,
          lastValidPtIdx,
          dnfCommentPtIdx,
          (idx) => {
            dnfCommentPtIdx = idx;
          },
          pointStyles,
          pointRadii,
          pointColors,
          cmts,
          color
        );
        isDnf = true;
        continue;
      }
      const t3 = rec.time3;
      y.push(cum + t1, cum + t2, cum + t3);
      pointStyles.push("circle", "circle", hasCmt ? "rectRot" : "circle");
      pointRadii.push(POINT_RADIUS_NORMAL, POINT_RADIUS_NORMAL, hasCmt ? POINT_RADIUS_COMMENT : POINT_RADIUS_FINAL);
      pointColors.push(color, color, hasCmt ? "#fff" : color);
      pushMeta(3);
      cmts.push("", "", rec.comment ?? "");
      stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
      cum = cum + t3;
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

  // src/renderer/chart/pluginHoverDim.ts
  function resolveActiveIdxs(ch, getHoveredKey, getPinnedIdxs, getHoveredIdx) {
    const key = getHoveredKey();
    if (key !== null)
      return /* @__PURE__ */ new Set([ch.data.datasets.findIndex((d) => d.driverKey === key)]);
    const pinned = getPinnedIdxs();
    if (pinned.length) return new Set(pinned);
    const hovered = getHoveredIdx();
    return hovered !== null ? /* @__PURE__ */ new Set([hovered]) : null;
  }
  function buildHoverDimPlugin(getHoveredKey, getPinnedIdxs, getHoveredIdx, getDimAlpha) {
    let active = null;
    return {
      id: "hoverDim",
      beforeDatasetsDraw(ch) {
        active = resolveActiveIdxs(ch, getHoveredKey, getPinnedIdxs, getHoveredIdx);
      },
      beforeDatasetDraw(ch, args) {
        if (ch.data.datasets[args.index]?.hidden) return;
        if (active === null || active.has(args.index)) return;
        ch.ctx.save();
        ch.ctx.globalAlpha = getDimAlpha();
      },
      afterDatasetDraw(ch, args) {
        if (ch.data.datasets[args.index]?.hidden) return;
        if (active === null || active.has(args.index)) return;
        ch.ctx.restore();
      }
    };
  }

  // src/renderer/chart/pluginDnfLine.ts
  var DNF_DASH_ON = 6;
  var DNF_DASH_OFF = 4;
  var DNF_LINE_W = 1.8;
  function buildDnfLinePlugin(getHoveredKey, getPinnedIdxs, getHoveredIdx, getDimAlpha) {
    return {
      id: "dnfLine",
      afterDatasetsDraw(chart) {
        const pinnedIdxs = getPinnedIdxs();
        const active = resolveActiveIdxs(chart, getHoveredKey, getPinnedIdxs, getHoveredIdx);
        const { ctx } = chart;
        chart.data.datasets.forEach((ds, di) => {
          if (ds.hidden) return;
          if (pinnedIdxs.includes(di)) return;
          const dnfPtIdx = ds._dnfCommentPtIdx;
          const lastPtIdx = ds._lastValidPtIdx;
          if (dnfPtIdx == null || lastPtIdx == null) return;
          const meta = chart.getDatasetMeta(di);
          const fromPt = meta.data[lastPtIdx];
          const toPt = meta.data[dnfPtIdx];
          if (!fromPt || !toPt) return;
          const isDimmed = active !== null && !active.has(di);
          ctx.save();
          if (isDimmed) ctx.globalAlpha = getDimAlpha();
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

  // src/renderer/chart/pluginPinnedComments.ts
  var FONT_FAMILY = "'Fira Code', monospace";
  var PAD_X = 10;
  var PAD_Y = 7;
  var LINE_H = 17;
  var FONT_SZ = 12;
  var STAGE_FONT_SZ = 10;
  var MAX_BOX_W = 280;
  var BOX_GAP = 6;
  function buildPinnedCommentsPlugin(getPinnedIdxs) {
    return {
      id: "pinnedComments",
      afterDraw(ch) {
        const pinnedIdxs = getPinnedIdxs();
        if (!pinnedIdxs.length) return;
        const { ctx, chartArea } = ch;
        ctx.save();
        const boxes = [];
        for (const pinnedIdx of pinnedIdxs) {
          const ds = ch.data.datasets[pinnedIdx];
          if (!ds || ds.hidden) continue;
          const cmts = ds._cmts;
          const slbls = ds._stageLabels;
          const meta = ch.getDatasetMeta(pinnedIdx);
          boxes.push(...collectCommentBoxes(ctx, ds, meta, cmts, slbls, chartArea));
        }
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

  // src/renderer/chart/pluginPoints.ts
  function buildPointsPlugin() {
    return {
      id: "points",
      afterDatasetDraw(ch, args) {
        const ds = ch.data.datasets[args.index];
        if (!ds || ds.hidden) return;
        const radii = ds._ptRadius;
        const styles = ds._ptStyle;
        const colors = ds._ptColor;
        const { ctx, chartArea: area } = ch;
        const { drawPoint, getHoverColor } = window.Chart.helpers;
        ctx.save();
        const m = ds.borderWidth / 2;
        ctx.beginPath();
        ctx.rect(area.left - m, area.top - m, area.right - area.left + 2 * m, area.bottom - area.top + 2 * m);
        ctx.clip();
        const opts = { pointStyle: "circle", radius: 0, rotation: 0, borderWidth: ds.borderWidth };
        const pts = args.meta.data;
        const draw = (i, radius, fill, stroke, borderWidth) => {
          const pt = pts[i];
          if (!radius || !pt || pt.skip) return;
          if (pt.x < area.left - 0.5 || pt.x > area.right + 0.5 || pt.y < area.top - 0.5 || pt.y > area.bottom + 0.5) return;
          opts.pointStyle = styles[i];
          opts.radius = radius;
          opts.borderWidth = borderWidth;
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.lineWidth = borderWidth;
          drawPoint(ctx, opts, pt.x, pt.y);
        };
        for (let i = 0; i < pts.length; i++) draw(i, radii[i], colors[i], ds.borderColor, ds.borderWidth);
        for (const a of ch.getActiveElements()) {
          if (a.datasetIndex !== args.index) continue;
          draw(a.index, ds._ptHoverRadius, getHoverColor(colors[a.index]), getHoverColor(ds.borderColor), 1);
        }
        ctx.restore();
      }
    };
  }

  // src/renderer/chart/pluginStageNames.ts
  var FONT_FAMILY2 = "'Fira Code', monospace";
  var FONT_SIZE_SS = 11;
  var FONT_SIZE_NM = 10;
  var HOVER_BG_EVEN = "#262626";
  var HOVER_BG_ODD = "#222222";
  var HOVER_BORDER = "#c0392b";
  var ROTATE_45_AT = 9;
  var ROTATE_90_AT = 20;
  function buildStageNamesPlugin(getStages, getHoveredIdx) {
    return {
      id: "stageNames",
      afterDraw(ch) {
        const stages = getStages();
        if (!stages.length) return;
        const rot45 = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
        const rot90 = stages.length > ROTATE_90_AT;
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
      drawRotatedLabel(ctx, stage, xL, xR, bot, Math.PI / 4, hovered);
    } else {
      drawRotatedLabel(ctx, stage, xL, xR, bot, Math.PI / 2, hovered);
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
  function drawRotatedLabel(ctx, stage, xL, xR, bot, angle, hovered) {
    const MAX_CHARS = angle === Math.PI / 4 ? 22 : 28;
    const PAD = 4;
    const translateX = angle === Math.PI / 2 ? (xL + xR) / 2 + FONT_SIZE_NM / 2 : xL + PAD;
    ctx.save();
    ctx.translate(translateX, bot + PAD);
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
  function buildTooltipHandler(getStages, getChart, getPinnedIdxs, getYMode) {
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
      const pinnedIdxs = getPinnedIdxs();
      const yMode = getYMode();
      const onPinned = pinnedIdxs.includes(dp.datasetIndex);
      const fieldTips = yMode === "pinned";
      if (pinnedIdxs.length && !onPinned && !fieldTips) {
        el.style.display = "none";
        return;
      }
      const xIdx = dp.dataIndex;
      const y0 = dp.raw;
      const chart = getChart();
      const stageInfo = resolveStageFromIndex(xIdx, getStages());
      el.innerHTML = pinnedIdxs.length > 1 && onPinned ? buildCompareHtml(chart, pinnedIdxs, xIdx, stageInfo) : buildTooltipHtml(
        collectMatchingDatasets(chart, xIdx, y0, fieldTips ? [] : pinnedIdxs),
        xIdx,
        stageInfo,
        yMode
      );
      el.style.display = "block";
      positionTooltip(el, context, TOOLTIP_MARGIN_PX, TOOLTIP_OFFSET_Y);
    };
  }
  function collectMatchingDatasets(chart, xIdx, y0, pinnedIdxs) {
    const matches = [];
    if (!chart || y0 === null) return matches;
    chart.data.datasets.forEach((ds, di) => {
      if (ds.hidden) return;
      if (pinnedIdxs.length && !pinnedIdxs.includes(di)) return;
      const yv = ds.data[xIdx];
      const isDnf = xIdx === ds._dnfCommentPtIdx;
      if (yv !== null && Math.abs(yv - y0) < 1) matches.push({ ds, y: yv, isDnf });
    });
    return matches;
  }
  function buildCompareHtml(chart, pinnedIdxs, xIdx, stageInfo) {
    const rows = pinnedIdxs.map((di) => chart.data.datasets[di]).filter((ds) => ds && !ds.hidden).map((ds) => ({ ds, abs: ds._abs[xIdx] ?? null })).sort((a, b) => {
      if (a.abs === null) return 1;
      if (b.abs === null) return -1;
      return a.abs - b.abs;
    });
    const best = rows[0]?.abs ?? null;
    let html = '<div class="tt-block">';
    if (stageInfo) html += `<span class="tt-stage">${escapeHtml(stageInfo.label)}</span>`;
    html += '<table class="tt-compare">';
    rows.forEach(({ ds, abs }, i) => {
      const name = escapeHtml(ds._displayName || ds.driverKey);
      const delta = abs === null ? "" : i === 0 ? "" : formatTimeSigned(abs - best);
      html += `<tr><td><span class="tt-dot" style="background:${ds.borderColor}"></span>${name}</td><td class="tt-num">${abs === null ? '<span class="tt-red">DNF</span>' : formatTime(abs)}</td><td class="tt-num tt-delta">${delta}</td></tr>`;
    });
    html += "</table></div>";
    return html;
  }
  function buildTooltipHtml(matches, xIdx, stageInfo, yMode) {
    const t = i18n.t();
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
      const abs = ds._abs[xIdx] ?? null;
      html += isDnf || abs === null ? `<span class="tt-red">DNF</span>` : `<span class="tt-row">\u23F1 ${formatTime(abs)}</span>`;
      if (!isDnf && y !== null && yMode !== "abs")
        html += `<span class="tt-row">${yMode === "leader" ? t.tooltipGapLeader : t.tooltipGapPinned}: ${formatTimeSigned(y)}</span>`;
      if (pen > 0) html += `<span class="tt-red">${t.tooltipPenalty}: +${formatTime(pen)}</span>`;
      if (sp > 0) html += `<span class="tt-red">${t.tooltipServicePenalty}: +${formatTime(sp)}</span>`;
      if (sr > 0) html += `<span class="tt-red">${t.tooltipSuperRally}: ${sr}\xD7</span>`;
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
  var BOT_PAD_NORMAL = 46;
  var BOT_PAD_45 = 90;
  var BOT_PAD_90 = 110;
  var NARROW_CHART_PX = 520;
  var DIM_ALPHA = 0.06;
  var DIM_ALPHA_SOFT = 0.35;
  var BORDER_WIDTH2 = 1.8;
  var BORDER_WIDTH_PINNED = 2.8;
  function createChartController() {
    let chart = null;
    let canvas = null;
    let hoveredDsIdx = null;
    let hoveredDsKey = null;
    let pinnedKeys = [];
    let pinnedIdxs = [];
    let yMode = "abs";
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
    function syncPinnedIdxs() {
      if (!chart) {
        pinnedIdxs = [];
        return;
      }
      const dss = chart.data.datasets;
      pinnedKeys = pinnedKeys.filter((k) => dss.some((d) => d.driverKey === k));
      pinnedIdxs = pinnedKeys.map((k) => dss.findIndex((d) => d.driverKey === k));
    }
    function effectiveYMode() {
      return yMode === "pinned" && !pinnedIdxs.length ? "leader" : yMode;
    }
    function dimAlpha() {
      return hoveredDsKey === null && effectiveYMode() === "pinned" ? DIM_ALPHA_SOFT : DIM_ALPHA;
    }
    function applyYMode() {
      if (!chart) return;
      const dss = chart.data.datasets;
      const mode = effectiveYMode();
      const nPts = chart.data.labels.length;
      let ref = null;
      if (mode === "leader") {
        ref = new Array(nPts).fill(null);
        for (const ds of dss) {
          if (ds.hidden) continue;
          ds._abs.forEach((v, i) => {
            if (v !== null && (ref[i] === null || v < ref[i])) ref[i] = v;
          });
        }
      } else if (mode === "pinned") {
        ref = dss[pinnedIdxs[0]]._abs;
      }
      const fitToPinned = !!ref && pinnedIdxs.length > 1;
      let min = 0, max = 0;
      dss.forEach((ds, di) => {
        const abs = ds._abs;
        ds.data = ref ? abs.map((v, i) => v === null || ref[i] === null ? null : v - ref[i]) : abs.slice();
        ds.borderWidth = pinnedIdxs.includes(di) ? BORDER_WIDTH_PINNED : BORDER_WIDTH2;
        ds.order = pinnedIdxs.includes(di) ? -1 : 0;
        if (ds.hidden && ref) return;
        if (fitToPinned && !pinnedIdxs.includes(di)) return;
        for (const v of ds.data) {
          if (v === null) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
      const step = computeYAxisStep(Math.max(max - min, 1));
      for (const id of ["y", "y2"]) {
        const s = chart.options.scales[id];
        s.min = ref ? Math.floor(min / step) * step : 0;
        s.max = Math.max(Math.ceil(max / step) * step, step);
        s.reverse = !!ref;
        s.ticks.stepSize = step;
      }
    }
    function notifyPinChange() {
      syncPinnedIdxs();
      applyYMode();
      chart?.update("none");
      onPinChange?.([...pinnedKeys]);
    }
    function togglePin(key, additive) {
      const has = pinnedKeys.includes(key);
      if (additive) {
        pinnedKeys = has ? pinnedKeys.filter((k) => k !== key) : [...pinnedKeys, key];
      } else {
        pinnedKeys = has && pinnedKeys.length === 1 ? [] : [key];
      }
      hoveredDsIdx = null;
      notifyPinChange();
    }
    return {
      getChart: () => chart,
      getPinnedKeys: () => [...pinnedKeys],
      getYMode: () => yMode,
      getActiveStages: () => activeStages,
      refreshLabels() {
        if (!chart) return;
        const title = i18n.t().axisTimeTitle;
        chart.options.scales.y.title.text = title;
        chart.options.scales.y2.title.text = title;
        chart.update("none");
      },
      setHoveredKey(key) {
        if (key === hoveredDsKey) return;
        hoveredDsKey = key;
        chart?.render();
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
        pinnedKeys = [];
        pinnedIdxs = [];
        hoveredBandIdx = null;
      },
      togglePin,
      clearPins() {
        if (!pinnedKeys.length) return;
        pinnedKeys = [];
        notifyPinChange();
      },
      setYMode(mode) {
        yMode = mode;
        applyYMode();
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
        applyYMode();
        chart.update("none");
      },
      build(data2, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, activeDriverKeys, activeGroups, activeCars) {
        activeStages = stages;
        const useRot45 = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
        const useRot90 = stages.length > ROTATE_90_AT;
        currentBotPad = useRot90 ? BOT_PAD_90 : useRot45 ? BOT_PAD_45 : BOT_PAD_NORMAL;
        const nPts = 1 + stages.length * 3;
        const labels = new Array(nPts).fill("");
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
        datasets.forEach((ds) => {
          ds._abs = ds.data.slice();
        });
        if (chart) {
          chart.data.labels = labels;
          chart.data.datasets = datasets;
          chart.options.layout.padding.bottom = currentBotPad;
          chart.setActiveElements([]);
          hoveredDsIdx = null;
          hoveredBandIdx = null;
          document.getElementById("chart-tooltip").style.display = "none";
          syncPinnedIdxs();
          applyYMode();
          chart.update("none");
          return;
        }
        canvas = document.getElementById("race-chart");
        removeCanvasListeners();
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
            // На узком экране правая ось-дубликат отнимает место у линий
            onResize: (c, size) => {
              c.options.scales.y2.display = size.width >= NARROW_CHART_PX;
            },
            onHover: (event, elements) => {
              if (pinnedIdxs.length) {
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
                chart.render();
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: false,
                external: buildTooltipHandler(
                  () => activeStages,
                  () => chart,
                  () => pinnedIdxs,
                  effectiveYMode
                )
              }
            },
            scales: buildScales(() => effectiveYMode() !== "abs")
          },
          plugins: [
            buildPointsPlugin(),
            buildHoverDimPlugin(
              () => hoveredDsKey,
              () => pinnedIdxs,
              () => hoveredDsIdx,
              dimAlpha
            ),
            buildStageNamesPlugin(() => activeStages, () => hoveredBandIdx),
            buildDnfLinePlugin(() => hoveredDsKey, () => pinnedIdxs, () => hoveredDsIdx, dimAlpha),
            buildPinnedCommentsPlugin(() => pinnedIdxs)
          ]
        });
        syncPinnedIdxs();
        applyYMode();
        chart.options.scales.y2.display = chart.width >= NARROW_CHART_PX;
        chart.update("none");
        clickHandler = (e) => {
          const additive = e.ctrlKey || e.metaKey || e.shiftKey;
          const hit = handleCanvasClick(e, chart, canvas, activeStages, currentBotPad);
          if (hit === "ignore") return;
          if (hit === null) {
            if (!additive && pinnedKeys.length) {
              pinnedKeys = [];
              notifyPinChange();
            }
            return;
          }
          const key = chart.data.datasets[hit]?.driverKey;
          if (key) togglePin(key, additive);
        };
        mousemoveHandler = (e) => {
          const newBandIdx = resolveHoveredBandIdx(e, chart, canvas, activeStages, currentBotPad);
          canvas.style.cursor = newBandIdx !== null ? "pointer" : "";
          if (newBandIdx !== hoveredBandIdx) {
            hoveredBandIdx = newBandIdx;
            chart.render();
          }
        };
        mouseleaveHandler = () => {
          document.getElementById("chart-tooltip").style.display = "none";
          if (hoveredDsIdx !== null) {
            hoveredDsIdx = null;
            chart?.render();
          }
          if (hoveredBandIdx !== null) {
            hoveredBandIdx = null;
            canvas.style.cursor = "";
            chart?.render();
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
  function buildScales(isGapMode) {
    const yTickConfig = {
      color: "#555",
      font: { size: 11, family: "'Fira Code', monospace" },
      callback: (v) => {
        const sec = v;
        return (isGapMode() && sec > 0 ? "+" : "") + formatYAxisTick(sec, i18n.t().axisTimeUnits);
      }
    };
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
        position: "left",
        ticks: { ...yTickConfig },
        grid: {
          color: (ctx) => isGapMode() && ctx.tick?.value === 0 ? "#3a3a3a" : "#1c1c1c",
          lineWidth: 1
        },
        border: { color: "#3a3a3a" },
        title: {
          display: true,
          text: i18n.t().axisTimeTitle,
          color: "#3c3c3c",
          font: { size: 11, family: "'Fira Code', monospace" }
        }
      },
      y2: {
        type: "linear",
        position: "right",
        ticks: { ...yTickConfig },
        grid: { drawOnChartArea: false },
        border: { color: "#3a3a3a" },
        title: {
          display: true,
          text: i18n.t().axisTimeTitle,
          color: "#3c3c3c",
          font: { size: 11, family: "'Fira Code', monospace" }
        }
      }
    };
  }
  function handleCanvasClick(e, chart, canvas, stages, botPad) {
    if (!chart) return null;
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
          return "ignore";
        }
      }
      return "ignore";
    }
    if (my < ca.top || my > ca.bottom) return "ignore";
    const elems = chart.getElementsAtEventForMode(e, "nearest", { intersect: false }, false);
    if (!elems.length) return null;
    const el = elems[0];
    const meta = chart.getDatasetMeta(el.datasetIndex);
    const pt = meta.data[el.index];
    if (!pt || Math.hypot(pt.x - mx, pt.y - my) > HOVER_DIST_PX) return null;
    return el.datasetIndex;
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
  function updateLegendPanel(data2, chart, activeStages, recordMap, isExpanded, pinnedKeys, leaderFirst, callbacks) {
    const panel = document.getElementById("legend-panel");
    const itemsEl = document.getElementById("legend-items");
    const expandBtn = document.getElementById("legend-expand-btn");
    const visibleWithTime = buildSortedVisibleDrivers(data2, chart, activeStages, recordMap);
    if (leaderFirst) visibleWithTime.reverse();
    currentCallbacks = callbacks;
    bindLegendEvents(itemsEl);
    const order = visibleWithTime.map((v) => v.drv.username).join("\n");
    if (data2 === renderedData && order === renderedOrder && itemsEl.children.length === visibleWithTime.length) {
      updatePinnedState(itemsEl, pinnedKeys);
    } else {
      renderLegendItems(itemsEl, visibleWithTime, data2, pinnedKeys);
      renderedData = data2;
      renderedOrder = order;
    }
    panel.classList.toggle("expanded", isExpanded);
    expandBtn.textContent = isExpanded ? "\u203A" : "\u2039";
    const inner = document.getElementById("legend-inner");
    requestAnimationFrame(() => {
      const overflows = inner.scrollHeight > inner.clientHeight + 2;
      expandBtn.style.display = overflows || isExpanded ? "" : "none";
    });
  }
  function buildSortedVisibleDrivers(data2, chart, activeStages, recordMap) {
    const dsByKey = /* @__PURE__ */ new Map();
    for (const ds of chart?.data.datasets ?? []) dsByKey.set(ds.driverKey, ds);
    const visibleDrvs = data2.drivers.filter((drv) => {
      const ds = dsByKey.get(drv.username);
      return ds && !ds.hidden;
    });
    const withTime = visibleDrvs.map((drv) => {
      let cum = 0;
      for (const st of activeStages) {
        const r = recordMap.get(drv.username)?.get(st.num);
        if (!r || r.time3 === null) {
          cum = null;
          break;
        }
        cum += r.time3;
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
  var renderedData = null;
  var renderedOrder = "";
  var currentCallbacks;
  var boundContainer = null;
  function updatePinnedState(container, pinnedKeys) {
    for (const item of Array.from(container.children)) {
      const pinned = pinnedKeys.includes(item.dataset["driverKey"]);
      item.setAttribute("aria-pressed", String(pinned));
      item.classList.toggle("pinned-highlight", pinned);
    }
  }
  function bindLegendEvents(container) {
    if (boundContainer === container) return;
    boundContainer = container;
    const itemOf = (e) => e.target?.closest(".legend-item") ?? null;
    const keyOf = (item) => item?.dataset["driverKey"] ?? null;
    container.addEventListener("mouseover", (e) => {
      const item = itemOf(e);
      if (!item || item.contains(e.relatedTarget)) return;
      item.classList.add("legend-item-hover");
      currentCallbacks?.onDriverHover(keyOf(item));
    });
    container.addEventListener("mouseout", (e) => {
      const item = itemOf(e);
      if (!item || item.contains(e.relatedTarget)) return;
      item.classList.remove("legend-item-hover");
      currentCallbacks?.onDriverHover(null);
    });
    container.addEventListener("focusin", (e) => {
      const key = keyOf(itemOf(e));
      if (key) currentCallbacks?.onDriverHover(key);
    });
    container.addEventListener("focusout", (e) => {
      if (itemOf(e)) currentCallbacks?.onDriverHover(null);
    });
    container.addEventListener("click", (e) => {
      const key = keyOf(itemOf(e));
      if (!key) return;
      const additive = e.ctrlKey || e.metaKey || e.shiftKey || isCoarsePointer();
      currentCallbacks?.onDriverClick(key, additive);
    });
  }
  function renderLegendItems(container, items, data2, pinnedKeys) {
    const focusedKey = document.activeElement?.closest(".legend-item")?.dataset["driverKey"] ?? null;
    const colorIdx = new Map(data2.drivers.map((d, i) => [d, i]));
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    let focusItem = null;
    for (const { drv } of items) {
      const color = driverColor(colorIdx.get(drv));
      const item = createElement("button", "legend-item");
      item.type = "button";
      item.dataset["driverKey"] = drv.username;
      const pinned = pinnedKeys.includes(drv.username);
      item.setAttribute("aria-pressed", String(pinned));
      if (pinned) item.classList.add("pinned-highlight");
      const dot = createElement("span", "legend-dot");
      dot.setAttribute("aria-hidden", "true");
      dot.style.background = color;
      const name = createElement(
        "span",
        "legend-name",
        drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username
      );
      item.appendChild(dot);
      item.appendChild(name);
      frag.appendChild(item);
      if (drv.username === focusedKey) focusItem = item;
    }
    container.appendChild(frag);
    focusItem?.focus({ preventScroll: true });
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
  function updatePinnedBar(data2, pinnedKeys, onUnpin) {
    const bar = document.getElementById("pinned-bar");
    const chips = document.getElementById("pinned-chips");
    chips.innerHTML = "";
    const drivers = data2 ? pinnedKeys.map((k) => data2.drivers.find((d) => d.username === k)).filter(Boolean) : [];
    if (!data2 || !drivers.length) {
      bar.style.display = "none";
      return;
    }
    for (const drv of drivers) {
      const chip = createElement("span", "pinned-chip");
      const dot = createElement("span", "pinned-dot");
      dot.style.background = driverColor(data2.drivers.indexOf(drv));
      const name = createElement(
        "span",
        "pinned-name",
        drv.realName && drv.realName !== drv.username ? `${drv.username} (${drv.realName})` : drv.username
      );
      const x = createElement("button", "pinned-chip-x", "\xD7");
      x.title = i18n.t().pinnedChipRemove;
      x.setAttribute("aria-label", `${i18n.t().pinnedChipRemove}: ${drv.username}`);
      x.addEventListener("click", () => onUnpin(drv.username));
      chip.appendChild(dot);
      chip.appendChild(name);
      chip.appendChild(x);
      chips.appendChild(chip);
    }
    document.getElementById("pinned-hint").textContent = isCoarsePointer() ? i18n.t().pinnedHintTouch : i18n.t().pinnedHint;
    bar.style.display = "flex";
  }

  // src/renderer/comments/index.ts
  var STYLES_ID = "comments-module-styles";
  var CARD_WIDTH = 220;
  var DRIVER_COL_W = 190;
  var renderedFor = null;
  var lastData = null;
  function ensureCommentsRendered(data2) {
    if (renderedFor !== data2) renderCommentsView(data2);
  }
  function invalidateComments() {
    renderedFor = null;
  }
  function renderCommentsView(data2) {
    const isNewData = data2 !== lastData;
    renderedFor = lastData = data2;
    injectStyles();
    renderSidebarSearch();
    const container = document.getElementById("view-comments");
    const drivers = buildCommentsData(data2);
    container.innerHTML = "";
    if (drivers.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cmt-empty";
      empty.textContent = i18n.t().commentsEmpty;
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
    if (isNewData) container.scrollTop = 0;
  }
  function renderSidebarSearch() {
    const target = document.getElementById("filter-comments-search");
    if (!target) return;
    const existing = document.getElementById("cmt-search-wrap");
    if (existing) {
      updateSidebarSearchLabels(existing);
      return;
    }
    const wrap = document.createElement("div");
    wrap.id = "cmt-search-wrap";
    wrap.className = "cmt-search-wrap";
    const label = document.createElement("div");
    label.id = "cmt-search-label";
    label.className = "filter-group-title";
    label.textContent = i18n.t().commentsSearchLabel;
    const input = document.createElement("input");
    input.id = "cmt-search-input";
    input.type = "text";
    input.className = "cmt-search-input";
    input.placeholder = i18n.t().commentsSearchPlaceholder;
    input.addEventListener("input", () => scrollToDriverMatch(input.value.trim()));
    wrap.appendChild(label);
    wrap.appendChild(input);
    target.appendChild(wrap);
  }
  function updateSidebarSearchLabels(wrap) {
    const label = wrap.querySelector("#cmt-search-label");
    const input = wrap.querySelector("#cmt-search-input");
    if (label) label.textContent = i18n.t().commentsSearchLabel;
    if (input) input.placeholder = i18n.t().commentsSearchPlaceholder;
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
    const recordMap = buildRecordMap(data2.records);
    const leaderTimes = buildLeaderTimes(data2.records);
    const totalTimes = buildTotalTimes(data2, recordMap);
    const positions = buildPositions(data2, recordMap);
    const result = [];
    const commented = /* @__PURE__ */ new Map();
    for (const r of data2.records) {
      if (!r.comment.trim()) continue;
      const list = commented.get(r.username);
      if (list) list.push(r);
      else commented.set(r.username, [r]);
    }
    for (const driver of data2.drivers) {
      const entries = (commented.get(driver.username) ?? []).sort((a, b) => a.stageNum - b.stageNum).map((r) => ({
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
          position: positions.get(driver.username) ?? 0,
          totalTime: totalTimes.get(driver.username) ?? null,
          entries
        });
      }
    }
    result.sort((a, b) => nullableCompare(a.totalTime, b.totalTime));
    return result;
  }
  function buildRecordMap(records) {
    const map = /* @__PURE__ */ new Map();
    for (const r of records) {
      if (!map.has(r.username)) map.set(r.username, /* @__PURE__ */ new Map());
      map.get(r.username).set(r.stageNum, r);
    }
    return map;
  }
  function buildPositions(data2, recordMap) {
    const stageNums = [...data2.stages].sort((a, b) => a.num - b.num).map((s) => s.num);
    const totals = data2.drivers.map((drv) => {
      let total = 0;
      for (const sn of stageNums) {
        const t3 = recordMap.get(drv.username)?.get(sn)?.time3 ?? null;
        if (t3 === null) {
          total = null;
          break;
        } else total += t3;
      }
      return { username: drv.username, total };
    });
    totals.sort((a, b) => nullableCompare(a.total, b.total));
    const map = /* @__PURE__ */ new Map();
    totals.forEach((d, i) => map.set(d.username, i + 1));
    return map;
  }
  function buildTotalTimes(data2, recordMap) {
    const stageNums = [...data2.stages].sort((a, b) => a.num - b.num).map((s) => s.num);
    const map = /* @__PURE__ */ new Map();
    for (const drv of data2.drivers) {
      let total = 0;
      for (const sn of stageNums) {
        const t3 = recordMap.get(drv.username)?.get(sn)?.time3 ?? null;
        if (t3 === null) {
          total = null;
          break;
        } else total += t3;
      }
      map.set(drv.username, total);
    }
    return map;
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
  function buildDriverRow(driver) {
    const row = document.createElement("div");
    row.className = "cmt-row";
    row.dataset["username"] = driver.username;
    row.dataset["realname"] = driver.realName ?? "";
    row.appendChild(buildPositionBlock(driver.position));
    row.appendChild(buildDriverCol(driver));
    row.appendChild(buildCardsCol(driver.entries));
    return row;
  }
  function buildPositionBlock(position) {
    const el = document.createElement("div");
    el.className = resolvePositionClass(position);
    el.textContent = String(position);
    return el;
  }
  function resolvePositionClass(position) {
    if (position === 1) return "cmt-pos cmt-pos--gold";
    if (position === 2) return "cmt-pos cmt-pos--silver";
    if (position === 3) return "cmt-pos cmt-pos--bronze";
    return "cmt-pos";
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
    count.textContent = i18n.t().commentsCount(driver.entries.length);
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
      time.textContent = formatTime(entry.time3);
      meta.appendChild(time);
    }
    if (entry.gapToLeader === 0) {
      const gap = document.createElement("span");
      gap.className = "cmt-gap cmt-gap--leader";
      gap.textContent = i18n.t().commentsLeader;
      meta.appendChild(gap);
    } else if (entry.gapToLeader !== null && entry.gapToLeader > 0) {
      const gap = document.createElement("span");
      gap.className = "cmt-gap";
      gap.textContent = i18n.t().commentsGap(formatTime(entry.gapToLeader));
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
      pen.textContent = i18n.t().commentsPenalty(formatTime(entry.penalty));
      badges.appendChild(pen);
    }
    if (entry.servicePenalty > 0) {
      const sp = document.createElement("span");
      sp.className = "cmt-badge-penalty";
      sp.textContent = i18n.t().commentsServicePenalty(formatTime(entry.servicePenalty));
      badges.appendChild(sp);
    }
    return badges;
  }
  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = `
        /* \u0418\u043C\u0435\u043D\u0430 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0445 \u043D\u0438\u0436\u0435 \u043D\u0438\u0433\u0434\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u044F\u043B\u0438\u0441\u044C \u2014 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043E\u0441\u0442\u0430\u0432\u0430\u043B\u0438\u0441\u044C
           \u0431\u0435\u0437 \u0444\u043E\u043D\u0430 \u0438 \u0440\u0430\u043C\u043A\u0438 \u0438 \u0441 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u043C \u0448\u0440\u0438\u0444\u0442\u043E\u043C. \u0421\u0432\u043E\u0434\u0438\u043C \u0438\u0445 \u043A \u0442\u043E\u043A\u0435\u043D\u0430\u043C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F. */
        :root {
            --font-mono:                var(--ff);
            --color-text-primary:       var(--text);
            --color-text-secondary:     #aaa;
            --color-text-tertiary:      var(--muted);
            --color-background-secondary: var(--surface);
            --color-border-tertiary:    var(--border);
            --color-border-secondary:   #444;
        }
        #view-comments, .cmt-search-wrap { font-family: var(--ff); }
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
            /* \u0421\u0442\u0440\u043E\u043A\u0438 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u043C\u0438 \u044D\u043A\u0440\u0430\u043D\u0430 \u043D\u0435 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u2014 \u043D\u0430 \u0431\u043E\u043B\u044C\u0448\u0438\u0445 \u0440\u0430\u043B\u043B\u0438 \u0438\u0445 \u0441\u043E\u0442\u043D\u0438.
               auto \u0437\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0442 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0443\u044E \u0432\u044B\u0441\u043E\u0442\u0443, \u043A\u043E\u0433\u0434\u0430 \u0441\u0442\u0440\u043E\u043A\u0430 \u0445\u043E\u0442\u044C \u0440\u0430\u0437 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0430 */
            content-visibility: auto;
            contain-intrinsic-size: auto 400px;
        }
        .cmt-row:last-child { border-bottom: none; }
        .cmt-row--highlighted {
            background: rgba(46,204,113,0.12);
            outline: 1px solid rgba(46,204,113,0.4);
            border-radius: 6px;
        }
        .cmt-pos {
            font-family: var(--font-mono);
            font-size: 13px;
            font-weight: 700;
            color: var(--color-text-tertiary);
            width: 28px;
            min-width: 28px;
            text-align: right;
            padding-top: 2px;
            flex-shrink: 0;
        }
        .cmt-pos--gold   { color: #f1c40f; }
        .cmt-pos--silver { color: #bdc3c7; }
        .cmt-pos--bronze { color: #e67e22; }
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
            padding: 8px 12px 12px;
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

  // src/renderer/rallyName.ts
  var RALLY_NAME_ENDPOINT = "https://script.google.com/macros/s/AKfycbwv4wdJpWe-Zpuwm9_CW34_r4002VgWxB_u3yxm2LgEbR-KvFNhWhwPQwuJ3T9plpY7pQ/exec";
  var STORAGE_PREFIX = "rsf-rally-name:";
  var TIMEOUT_MS = 8e3;
  var MAX_NAME_LEN = 120;
  function getCachedRallyName(rallyId) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + rallyId);
    } catch {
      return null;
    }
  }
  async function fetchRallyName(rallyId) {
    if (!RALLY_NAME_ENDPOINT || !/^\d{1,9}$/.test(rallyId)) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${RALLY_NAME_ENDPOINT}?rally=${rallyId}`, { signal: ctrl.signal });
      if (!res.ok) return null;
      const body = await res.json();
      const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LEN) : "";
      if (!name) return null;
      try {
        localStorage.setItem(STORAGE_PREFIX + rallyId, name);
      } catch {
      }
      return name;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
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
    si.placeholder = i18n.t().filterSearch;
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
    const t = i18n.t();
    const group = createElement("div", "filter-group collapsed");
    const hdr = createElement("div", "filter-header");
    const left = createElement("button", "filter-header-left");
    left.type = "button";
    left.setAttribute("aria-expanded", "false");
    left.innerHTML = `<span class="collapse-icon" aria-hidden="true">\u25B6</span><span class="filter-title">${title}</span><span class="filter-counter" id="${counterId}"></span>`;
    const right = createElement("div", "filter-header-right");
    const btnAll = createElement("button", "btn-fa", t.filterAll);
    const btnNone = createElement("button", "btn-fa", t.filterNone);
    right.appendChild(btnAll);
    right.appendChild(btnNone);
    hdr.appendChild(left);
    hdr.appendChild(right);
    const body = createElement("div", "filter-body");
    left.addEventListener("click", () => {
      const collapsed = group.classList.toggle("collapsed");
      left.setAttribute("aria-expanded", String(!collapsed));
    });
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
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(i18n.t().filterChartStages, "counter-stages");
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
      cb.checked = state.activeStageNums.has(s.num);
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
  function buildDriverFilterUI(drivers, data2, state, callbacks, rankMap2) {
    const wrap = document.getElementById("filter-drivers-wrap");
    wrap.innerHTML = "";
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(i18n.t().filterParticipants, "counter-drivers");
    const t = i18n.t();
    const rankOf = (d) => rankMap2.get(d.username) ?? null;
    const sorted = [...drivers].sort((a, b) => {
      const ra = rankOf(a), rb = rankOf(b);
      if (ra !== null && rb !== null) return ra - rb;
      if (ra !== null) return -1;
      if (rb !== null) return 1;
      return a.username.localeCompare(b.username);
    });
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
    const applyPreset = (pick) => {
      const visible = sorted.filter((d) => state.visibleDriverKeys.has(d.username));
      const finishers = visible.filter((d) => rankOf(d) !== null);
      visible.forEach((d) => state.activeDriverKeys.delete(d.username));
      finishers.forEach((d, i) => {
        if (pick(i + 1)) state.activeDriverKeys.add(d.username);
      });
      qsa(".filter-item[data-driver-key]", body).forEach((item) => {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = state.activeDriverKeys.has(item.dataset["driverKey"]);
      });
      callbacks.onDriversChanged();
    };
    const presets = createElement("div", "filter-presets");
    const addPreset = (label, title, pick) => {
      const btn = createElement("button", "btn-fa", label);
      btn.title = title;
      btn.addEventListener("click", () => applyPreset(pick));
      presets.appendChild(btn);
    };
    addPreset(t.presetTop(10), t.presetTopTitle(10), (r) => r <= 10);
    addPreset(t.presetTop(20), t.presetTopTitle(20), (r) => r <= 20);
    addPreset(t.presetFinished, t.presetFinishedTitle, () => true);
    body.appendChild(presets);
    for (const drv of sorted) {
      const lbl = createElement("label", "filter-item");
      lbl.dataset["driverKey"] = drv.username;
      lbl.dataset["group"] = drv.group;
      lbl.dataset["car"] = drv.car;
      const cb = createElement("input");
      cb.type = "checkbox";
      cb.checked = state.activeDriverKeys.has(drv.username);
      cb.addEventListener("change", () => {
        cb.checked ? state.activeDriverKeys.add(drv.username) : state.activeDriverKeys.delete(drv.username);
        callbacks.onDriversChanged();
      });
      const rank = rankOf(drv);
      const place = createElement(
        "span",
        rank !== null ? "filter-driver-rank" : "filter-driver-rank dnf",
        rank !== null ? String(rank) : "DNF"
      );
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
      lbl.appendChild(place);
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
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(i18n.t().filterGroupClass, "counter-groups");
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
      cb.checked = state.activeGroups.has(grp);
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
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(i18n.t().filterCar, "counter-cars");
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
      cb.checked = state.activeCars.has(car);
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
  function buildChartFilterPanel(data2, state, callbacks, rankMap2) {
    buildStageFilterUI(data2.stages, state, callbacks);
    buildDriverFilterUI(data2.drivers, data2, state, callbacks, rankMap2);
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

  // src/renderer/i18n-dom.ts
  function applyDomTranslations() {
    const t = i18n.t();
    setTextById("welcome-title", t.welcomeTitle);
    setTextById("welcome-desc", t.welcomeDesc);
    setTextById("btn-choose-file", t.selectFileButton);
    setTextById("sidebar-filters-label", t.filtersLabel);
    setTextById("btn-back", t.backButton);
    setTextById("tab-chart", t.tabChart);
    setTextById("tab-results", t.tabResults);
    setTextById("tab-comments", t.tabComments);
    setTextById("btn-apply-filter", t.applyFilterButton);
    setTextById("chart-legend-success", t.chartLegendSuccess);
    setTextById("chart-legend-sr", t.chartLegendSuperRally);
    setTextById("chart-legend-comment", t.chartLegendComment);
    setTextById("ymode-abs", t.yModeAbs);
    setTextById("ymode-leader", t.yModeLeader);
    setTextById("ymode-pinned", t.yModePinned);
    setTextById("drop-hint", t.dropHint);
    setTextById("drop-overlay-text", t.dropOverlay);
    setTextById("welcome-help", t.welcomeHelp);
    setTextById("btn-filters-label", t.filtersLabel);
    setAttrById("btn-sidebar-close", "aria-label", t.closeLabel);
    setAttrById("race-chart", "aria-label", t.chartAriaLabel);
    document.documentElement.lang = i18n.getLanguage();
    setTitleById("pinned-close", t.pinnedCloseTitle);
    setTitleById("legend-expand-btn", t.legendExpandTitle);
    applyEventNameLabel(t.eventNameLabel, t.eventNameOptional);
  }
  function setTextById(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setAttrById(id, attr, value) {
    document.getElementById(id)?.setAttribute(attr, value);
  }
  function setTitleById(id, title) {
    const el = document.getElementById(id);
    if (el) el.title = title;
  }
  function applyEventNameLabel(label, optional) {
    const el = document.getElementById("label-event-name");
    if (!el) return;
    const span = el.querySelector(".optional");
    const textNode = el.childNodes[0];
    if (textNode?.nodeType === Node.TEXT_NODE) {
      textNode.textContent = `${label} `;
    }
    if (span) span.textContent = optional;
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
    const body = document.querySelector(
      '#sidebar-results-filters .filter-body[data-filter="drivers"]'
    );
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
      i18n.t().filterResultsStages,
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
      lbl.appendChild(cb);
      lbl.appendChild(createElement("span", "filter-ss", `SS${st.num}`));
      lbl.appendChild(createElement("span", "filter-name", st.name));
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildResultsDriverFilter(data2, state, onChange, cont) {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
      i18n.t().filterParticipants,
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
      if (drv.car) content.appendChild(createElement("span", "filter-driver-car", drv.car));
      lbl.appendChild(cb);
      lbl.appendChild(content);
      body.appendChild(lbl);
    }
    cont.appendChild(group);
  }
  function buildResultsGroupFilter(data2, state, onChange, cont) {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
      i18n.t().filterResultsClass,
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
      lbl.appendChild(cb);
      lbl.appendChild(createElement("span", "filter-group-label", grp));
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
    { key: "pos", label: () => i18n.t().colPosition, title: () => "" },
    { key: "name", label: () => i18n.t().colParticipant, title: () => "", special: "search" },
    { key: "group", label: () => i18n.t().colClass, title: () => "" },
    { key: "car", label: () => i18n.t().colCar, title: () => "" },
    { key: "totalTime", label: () => i18n.t().colTotalTime, title: () => "" },
    { key: "totalPenalty", label: () => i18n.t().colPenalties, title: () => "" },
    { key: "avgGapLeader", label: () => i18n.t().colAvgGapLeader, title: () => i18n.t().colAvgGapLeaderTitle },
    { key: "avgGapPrev", label: () => i18n.t().colAvgGapPrev, title: () => i18n.t().colAvgGapPrevTitle },
    { key: "cleanLeader", label: () => i18n.t().colCleanGapLeader, title: () => i18n.t().colCleanGapLeaderTitle },
    { key: "cleanPrev", label: () => i18n.t().colCleanGapPrev, title: () => i18n.t().colCleanGapPrevTitle },
    { key: "totalGap", label: () => i18n.t().colTotalGap, title: () => "" },
    { key: "sr", label: () => i18n.t().colSuperRally, title: () => "" }
  ];
  function buildResultsTableHeader(thead, stages, onSearchClick) {
    thead.innerHTML = "";
    const tr = document.createElement("tr");
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      const titleText = col.title();
      if (titleText) th.title = titleText;
      if (col.key === "pos") th.className = "sticky-col sticky-col-1";
      if (col.special === "search") {
        th.className = "th-participant sticky-col sticky-col-2";
        th.innerHTML = col.label();
        th.addEventListener("click", () => onSearchClick(th));
      } else {
        th.textContent = col.label();
      }
      tr.appendChild(th);
    });
    for (const st of stages) {
      const th = createElement("th", "th-stage", `SS${st.num}`);
      th.title = st.name;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }
  function renderResultsRows(tbody, results, stageRanks, selectedRows, onRowClick) {
    tbody.innerHTML = "";
    for (const r of results) {
      const row = buildResultRow(r, stageRanks.get(r.stats.username) ?? [], selectedRows);
      row.tabIndex = 0;
      row.addEventListener("click", () => onRowClick(r.stats.username, row));
      row.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onRowClick(r.stats.username, row);
      });
      tbody.appendChild(row);
    }
  }
  function buildResultRow(r, stageRanks, selectedRows) {
    const row = document.createElement("tr");
    row.dataset["username"] = r.stats.username;
    if (selectedRows.has(r.stats.username)) row.classList.add("row-selected");
    row.setAttribute("aria-selected", String(selectedRows.has(r.stats.username)));
    const t = i18n.t();
    const noPace = r.position === 1 || r.stats.totalTime === null;
    row.appendChild(buildPositionCell(r.stats.totalTime !== null ? r.position : null));
    row.appendChild(buildNameCell(r.stats));
    row.appendChild(buildGroupCell(r.stats.group));
    row.appendChild(createTd("td-time", r.stats.car));
    row.appendChild(createTd(
      "td-time",
      r.stats.totalTime !== null ? formatTime(r.stats.totalTime) : "DNF"
    ));
    row.appendChild(buildPenaltyCell(r.stats.totalPenalty));
    row.appendChild(buildGapWithTooltip(
      noPace ? "\u2014" : formatTimeSigned(r.avgGapFromLeader),
      t.colAvgGapLeaderTitle,
      noPace ? null : r.avgGapFromLeader
    ));
    row.appendChild(buildGapWithTooltip(
      noPace ? "\u2014" : formatTimeSigned(r.avgGapFromPrev),
      t.colAvgGapPrevTitle,
      noPace ? null : r.avgGapFromPrev
    ));
    row.appendChild(buildCleanGapCell(
      noPace ? null : r.cleanGapFromLeader,
      noPace ? 0 : r.cleanCountLeader,
      r.totalStageCount
    ));
    row.appendChild(buildCleanGapCell(
      noPace ? null : r.cleanGapFromPrev,
      noPace ? 0 : r.cleanCountPrev,
      r.totalStageCount
    ));
    row.appendChild(createTd(
      "td-total-gap",
      r.position === 1 ? "\u2014" : r.totalGap !== null ? formatTimeSigned(r.totalGap) : "\u2014"
    ));
    row.appendChild(buildSRCell(r.stats.srCount));
    r.stats.snaps.forEach((snap, s) => row.appendChild(buildStageCell(snap, stageRanks[s] ?? null)));
    return row;
  }
  function buildStageCell(snap, rank) {
    if (snap.time3 === null) return createTd("td-stage td-gap-zero", "\u2014");
    const td = createTd("td-stage", formatTime(snap.time3));
    const rk = createElement("span", "td-stage-rank", `${rank ?? ""}`);
    if (rank === 1) rk.classList.add("pos-gold");
    td.appendChild(rk);
    if (snap.hasSR) td.appendChild(createElement("span", "td-stage-sr", "SR"));
    return td;
  }
  function buildPositionCell(pos) {
    const td = createTd("td-pos sticky-col sticky-col-1", pos !== null ? String(pos) : "DNF");
    if (pos === null) td.classList.add("pos-dnf");
    if (pos === 1) td.classList.add("pos-gold");
    else if (pos === 2) td.classList.add("pos-silver");
    else if (pos === 3) td.classList.add("pos-bronze");
    return td;
  }
  function buildNameCell(stats) {
    const td = createTd("td-name sticky-col sticky-col-2");
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
    inner.dataset["tooltip"] = i18n.t().cleanGapCellTooltip(cleanCount, totalCount);
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
  var _dirty = true;
  var _resetScroll = true;
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
    _dirty = true;
    _resetScroll = true;
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
  function ensureResultsRendered() {
    if (_dirty) renderResultsTable();
  }
  function invalidateResults() {
    _dirty = true;
  }
  function renderResultsTable() {
    if (!_data) return;
    _dirty = false;
    const stats = getFilteredStats();
    const results = computeDriverResults(stats);
    const stages = _data.stages.filter((s) => _filterState.stageFilter.has(s.num)).sort((a, b) => a.num - b.num);
    const thead = document.getElementById("results-thead");
    buildResultsTableHeader(thead, stages, activateParticipantSearch);
    const tbody = document.getElementById("results-tbody");
    renderResultsRows(tbody, results, computeStageRanks(results, stages.length), _selectedRows, toggleRowSelection);
    if (_resetScroll) {
      _resetScroll = false;
      document.querySelector(".results-wrap")?.scrollTo(0, 0);
    }
  }
  function computeStageRanks(results, nStages) {
    const ranks = /* @__PURE__ */ new Map();
    results.forEach((r) => ranks.set(r.stats.username, new Array(nStages).fill(null)));
    for (let s = 0; s < nStages; s++) {
      results.filter((r) => r.stats.snaps[s]?.time3 != null).sort((a, b) => a.stats.snaps[s].time3 - b.stats.snaps[s].time3).forEach((r, i) => {
        ranks.get(r.stats.username)[s] = i + 1;
      });
    }
    return ranks;
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
    row.setAttribute("aria-selected", String(_selectedRows.has(username)));
    updateApplyBar();
  }
  function updateApplyBar() {
    const bar = document.getElementById("apply-filter-bar");
    const countEl = document.getElementById("apply-filter-count");
    if (!bar) return;
    if (_selectedRows.size > 0) {
      bar.classList.add("visible");
      if (countEl) countEl.textContent = i18n.t().selectedCount(_selectedRows.size);
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
    const origLabel = th.textContent || i18n.t().colParticipant;
    th.textContent = "";
    const inp = document.createElement("input");
    inp.className = "th-search-input";
    inp.placeholder = i18n.t().commentsSearchPlaceholder;
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
      th.className = "th-participant sticky-col sticky-col-2";
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
  var RSF_RALLY_URL = "https://www.rallysimfans.hu/rbr/rally_online.php?centerbox=rally_list_details.php&rally_id=";
  var data = null;
  var eventName = "";
  var fileName = "";
  var currentTab = "chart";
  var legendExpanded = false;
  var prevStageFilter = null;
  var rallyName = null;
  var rankMap = /* @__PURE__ */ new Map();
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
    applyDomTranslations();
    initLangSwitcher(() => {
      applyDomTranslations();
      updateHeaderTitle();
      updateResumeButton();
      if (data) {
        buildChartFilterPanel(data, chartState, makeFilterCallbacks(), rankMap);
        updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
        afterFilterChange();
        buildResultsFilters(() => {
        });
        updateHeaderStats();
        invalidateResults();
        invalidateComments();
        if (currentTab === "results") ensureResultsRendered();
        if (currentTab === "comments") ensureCommentsRendered(data);
        chartCtrl.refreshLabels();
        onPinsChanged(chartCtrl.getPinnedKeys());
      }
    });
    qs("#btn-choose-file").addEventListener("click", () => {
      qs("#file-input").click();
    });
    qs("#file-input").addEventListener("change", onFileInputChange);
    initFileDrop();
    qs("#inp-event-name").addEventListener("input", (e) => {
      eventName = e.target.value.trim();
      updateHeaderTitle();
    });
    qs("#btn-back").addEventListener("click", showWelcome);
    qs("#btn-resume").addEventListener("click", resumeChart);
    qs("#pinned-close").addEventListener("click", () => chartCtrl.clearPins());
    qs("#tab-chart").addEventListener("click", () => switchTab("chart"));
    qs("#tab-results").addEventListener("click", () => switchTab("results"));
    qs("#tab-comments").addEventListener("click", () => switchTab("comments"));
    qs("#legend-expand-btn").addEventListener("click", toggleLegendExpand);
    document.querySelectorAll("#ymode-switch .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => setYMode(btn.dataset["ymode"]));
    });
    chartCtrl.setOnPinChange(onPinsChanged);
    qs("#btn-filters").addEventListener("click", () => setSidebarOpen(true));
    qs("#btn-sidebar-close").addEventListener("click", () => setSidebarOpen(false));
    qs("#sidebar-backdrop").addEventListener("click", () => setSidebarOpen(false));
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (isSidebarOpen()) setSidebarOpen(false);
      else if (chartCtrl.getPinnedKeys().length) chartCtrl.clearPins();
    });
    document.addEventListener("mousemove", onCellTooltipMove);
    window.__onStageBandClick = handleStageBandClick;
  });
  async function onFileInputChange(e) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (file) await loadFile(file);
  }
  function initFileDrop() {
    const overlay = document.getElementById("drop-overlay");
    const hasFiles = (e) => !!e.dataTransfer?.types.includes("Files");
    let depth = 0;
    document.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      overlay.classList.add("visible");
    });
    document.addEventListener("dragover", (e) => {
      if (hasFiles(e)) e.preventDefault();
    });
    document.addEventListener("dragleave", (e) => {
      if (!hasFiles(e)) return;
      if (--depth <= 0) {
        depth = 0;
        overlay.classList.remove("visible");
      }
    });
    document.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.classList.remove("visible");
      const file = e.dataTransfer?.files?.[0];
      if (file) void loadFile(file);
    });
  }
  async function loadFile(file) {
    const btn = qs("#btn-choose-file");
    const info = qs("#file-info");
    btn.disabled = true;
    info.textContent = i18n.t().fileReading;
    info.className = "file-info loading";
    try {
      const text = await readFileAsText(file);
      const parsed = parseCsvText(text);
      chartCtrl.destroy();
      data = parsed;
      fileName = file.name;
      lookups = buildRallyLookups(data);
      const allStats = computeAllDriverStats(data, lookups.recordMap);
      initResultsModule(data, lookups.recordMap, allStats);
      rankMap = /* @__PURE__ */ new Map();
      [...allStats].sort((a, b) => nullableCompare(a.totalTime, b.totalTime)).forEach((s, i) => rankMap.set(s.username, s.totalTime !== null ? i + 1 : null));
      const order = (k) => rankMap.get(k) ?? Number.MAX_SAFE_INTEGER;
      data.drivers.sort((a, b) => order(a.username) - order(b.username));
      eventName = qs("#inp-event-name").value.trim();
      info.textContent = i18n.t().fileLoaded(data.stages.length, data.drivers.length);
      info.className = "file-info ok";
      const rallyId = currentRallyId();
      rallyName = rallyId ? getCachedRallyName(rallyId) : null;
      showChart();
      if (rallyId) void refreshRallyName(rallyId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      info.textContent = `${i18n.t().fileError}: ${msg}`;
      info.className = "file-info error";
      showWelcome();
    } finally {
      btn.disabled = false;
    }
  }
  async function refreshRallyName(rallyId) {
    const name = await fetchRallyName(rallyId);
    if (!name || currentRallyId() !== rallyId || name === rallyName) return;
    rallyName = name;
    updateHeaderTitle();
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(i18n.t().fileReadError));
      reader.readAsText(file, "utf-8");
    });
  }
  function showWelcome() {
    document.getElementById("app").classList.remove("sidebar-open");
    document.getElementById("screen-welcome").style.display = "flex";
    document.getElementById("screen-chart").style.display = "none";
    document.getElementById("chart-tooltip").style.display = "none";
    document.getElementById("header-stats").textContent = "";
    updateResumeButton();
  }
  function resumeChart() {
    if (!data) return;
    document.getElementById("screen-welcome").style.display = "none";
    document.getElementById("screen-chart").style.display = "flex";
    updateHeaderTitle();
    updateHeaderStats();
    switchTab(currentTab);
  }
  function updateResumeButton() {
    const btn = qs("#btn-resume");
    btn.style.display = data ? "" : "none";
    if (data) btn.textContent = i18n.t().resumeButton(fileName);
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
    const urlState = readUrlState();
    restoringUrlState = true;
    if (urlState) applyUrlFilters(urlState);
    document.getElementById("screen-welcome").style.display = "none";
    document.getElementById("screen-chart").style.display = "flex";
    updateHeaderTitle();
    applyDomTranslations();
    buildChartFilterPanel(data, chartState, makeFilterCallbacks(), rankMap);
    updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
    buildResultsFilters(() => {
    });
    switchTab("chart");
    if (urlState) applyUrlView(urlState);
    if (chartCtrl.getYMode() === "pinned" && !chartCtrl.getPinnedKeys().length) chartCtrl.setYMode("leader");
    syncYModeSwitch();
    refreshLegend();
    updateHeaderStats();
    restoringUrlState = false;
    writeUrlState();
  }
  var LIST_SEP = "|";
  var restoringUrlState = false;
  function currentRallyId() {
    return data ? fileName.match(/(\d{4,})_table/)?.[1] ?? null : null;
  }
  function readUrlState() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (![...p.keys()].length) return null;
    const rally = p.get("r");
    if (rally && rally !== currentRallyId()) return null;
    const list = (key) => p.get(key)?.split(LIST_SEP).filter(Boolean) ?? null;
    const tab = p.get("tab");
    const y = p.get("y");
    return {
      tab: tab === "chart" || tab === "results" || tab === "comments" ? tab : null,
      yMode: y === "abs" || y === "leader" || y === "pinned" ? y : null,
      stages: list("ss")?.map(Number).filter((n) => !isNaN(n)) ?? null,
      groups: list("cls"),
      pins: list("pin") ?? []
    };
  }
  function applyUrlFilters(s) {
    if (!data) return;
    const stages = s.stages?.filter((n) => data.stages.some((st) => st.num === n));
    if (stages?.length) chartState.activeStageNums = new Set(stages);
    const groups = s.groups?.filter((g) => data.groups.includes(g));
    if (groups?.length) chartState.activeGroups = new Set(groups);
  }
  function applyUrlView(s) {
    if (!data) return;
    syncDatasetVisibility();
    for (const key of s.pins)
      if (data.drivers.some((d) => d.username === key)) chartCtrl.togglePin(key, true);
    if (s.yMode && (s.yMode !== "pinned" || chartCtrl.getPinnedKeys().length)) {
      chartCtrl.setYMode(s.yMode);
      syncYModeSwitch();
      refreshLegend();
    }
    if (s.tab && s.tab !== "chart") switchTab(s.tab);
  }
  function writeUrlState() {
    if (!data || restoringUrlState) return;
    const p = new URLSearchParams();
    const rallyId = currentRallyId();
    if (rallyId) p.set("r", rallyId);
    if (currentTab !== "chart") p.set("tab", currentTab);
    const yMode = chartCtrl.getYMode();
    if (yMode !== "abs") p.set("y", yMode);
    if (chartState.activeStageNums.size !== data.stages.length)
      p.set("ss", [...chartState.activeStageNums].sort((a, b) => a - b).join(LIST_SEP));
    if (data.groups.length && chartState.activeGroups.size !== data.groups.length)
      p.set("cls", [...chartState.activeGroups].join(LIST_SEP));
    const pins = chartCtrl.getPinnedKeys();
    if (pins.length) p.set("pin", pins.join(LIST_SEP));
    const hash = p.toString();
    history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
  }
  function updateHeaderTitle() {
    const rallyId = currentRallyId();
    const title = eventName || rallyName || (rallyId ? i18n.t().rallyTitle(rallyId) : i18n.t().defaultTitle);
    const h1 = document.getElementById("header-event-name");
    h1.textContent = title;
    h1.title = rallyId && title !== i18n.t().rallyTitle(rallyId) ? i18n.t().rallyTitle(rallyId) : "";
    const link = document.getElementById("header-rally-link");
    link.style.display = rallyId ? "" : "none";
    if (rallyId) {
      link.href = RSF_RALLY_URL + rallyId;
      link.title = i18n.t().rallyLinkTitle;
    }
  }
  function updateHeaderStats() {
    if (!data) return;
    const lastStage = data.stages.reduce((m, s) => s.num > m ? s.num : m, 0);
    const finished = data.drivers.filter(
      (d) => lookups.recordMap.get(d.username)?.get(lastStage)?.time3 != null
    ).length;
    document.getElementById("header-stats").textContent = i18n.t().headerStats(finished, data.drivers.length, data.stages.length);
  }
  function isSidebarOpen() {
    return document.getElementById("app").classList.contains("sidebar-open");
  }
  function setSidebarOpen(open) {
    document.getElementById("app").classList.toggle("sidebar-open", open);
    const btn = qs("#btn-filters");
    btn.setAttribute("aria-expanded", String(open));
    if (open) qs("#btn-sidebar-close").focus();
    else btn.focus({ preventScroll: true });
  }
  function switchTab(tab) {
    currentTab = tab;
    for (const t of ["chart", "results", "comments"]) {
      const btn = qs(`#tab-${t}`);
      btn.classList.toggle("active", tab === t);
      btn.setAttribute("aria-pressed", String(tab === t));
    }
    document.getElementById("view-chart").style.display = tab === "chart" ? "flex" : "none";
    setHeavyViewShown("view-results", tab === "results");
    setHeavyViewShown("view-comments", tab === "comments");
    document.getElementById("chart-toolbar").style.display = tab === "chart" ? "" : "none";
    document.getElementById("sidebar-chart-filters").style.display = tab === "chart" ? "" : "none";
    document.getElementById("sidebar-results-filters").style.display = tab === "results" ? "" : "none";
    document.getElementById("sidebar-comments-filters").style.display = tab === "comments" ? "" : "none";
    document.getElementById("legend-panel").style.display = tab === "chart" ? "" : "none";
    if (tab === "chart" && !chartCtrl.getChart()) rebuildChart();
    if (tab === "chart" && chartCtrl.getChart()) refreshLegend();
    if (tab === "results") ensureResultsRendered();
    if (tab === "comments") ensureCommentsRendered(data);
    writeUrlState();
  }
  function setHeavyViewShown(id, shown) {
    const el = document.getElementById(id);
    if (!shown && el.style.display === "none") return;
    el.style.display = "flex";
    el.classList.toggle("view-parked", !shown);
  }
  function makeFilterCallbacks() {
    return {
      onStagesChanged: () => {
        updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
        rebuildChart();
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
    writeUrlState();
  }
  function setYMode(mode) {
    if (mode === "pinned" && !chartCtrl.getPinnedKeys().length) return;
    chartCtrl.setYMode(mode);
    syncYModeSwitch();
    refreshLegend();
    const pinned = chartCtrl.getPinnedKeys();
    scrollLegendTo(pinned[pinned.length - 1] ?? null);
    writeUrlState();
  }
  function syncYModeSwitch() {
    const mode = chartCtrl.getYMode();
    const hasPinned = chartCtrl.getPinnedKeys().length > 0;
    document.querySelectorAll("#ymode-switch .seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset["ymode"] === mode);
      btn.setAttribute("aria-pressed", String(btn.dataset["ymode"] === mode));
    });
    const pinnedBtn = qs("#ymode-pinned");
    pinnedBtn.disabled = !hasPinned;
    pinnedBtn.title = hasPinned ? "" : i18n.t().yModePinnedDisabled;
  }
  function onPinsChanged(keys) {
    if (!keys.length && chartCtrl.getYMode() === "pinned") chartCtrl.setYMode("leader");
    syncYModeSwitch();
    updatePinnedBar(data, keys, (key) => chartCtrl.togglePin(key, true));
    refreshLegend();
    scrollLegendTo(keys[keys.length - 1] ?? null);
    writeUrlState();
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
    updatePinnedBar(data, chartCtrl.getPinnedKeys(), (key) => chartCtrl.togglePin(key, true));
    syncYModeSwitch();
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
      onDriverClick: (key, additive) => chartCtrl.togglePin(key, additive)
    };
    updateLegendPanel(
      data,
      chartCtrl.getChart(),
      chartCtrl.getActiveStages(),
      lookups.recordMap,
      legendExpanded,
      chartCtrl.getPinnedKeys(),
      chartCtrl.getYMode() !== "abs",
      callbacks
    );
  }
  function scrollLegendTo(driverKey) {
    const inner = document.getElementById("legend-inner");
    if (!inner || !driverKey) return;
    const items = inner.querySelectorAll(".legend-item");
    for (const item of items) {
      if (item.dataset["driverKey"] === driverKey) {
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
