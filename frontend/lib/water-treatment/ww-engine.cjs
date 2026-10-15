/*
 * W&W Engine — Water & Wastewater design calculations, Release 1
 * BAFED Services / Process Engineering Workbench
 * Version 0.2.0 (prototype, 14 Oct 2026; independent review fixes applied)
 *
 * Pure functions, SI units throughout (m, m3, m3/d, mg/L = g/m3, kg/d, °C, kPa).
 * Every result object carries `checks`: [{item, value, unit, range:[lo,hi], source, status, note}]
 * status: 'pass' | 'warn' | 'fail' | 'info'
 *
 * References (equations and numbers only; no text reproduced):
 *   M&E  = Metcalf & Eddy | AECOM, Wastewater Engineering: Treatment and Resource Recovery, 5th ed., 2014
 *   Q    = Qasim & Zhu, Wastewater Treatment and Reuse: Theory and Design Examples, Vol. 1, 2018
 *   10S  = Recommended Standards (Ten States): Wastewater Facilities 2014; Water Works 2022
 *   EPA  = US EPA Disinfection Profiling and Benchmarking Technical Guidance Manual, EPA 815-R-20-003 (2020)
 *   LT2  = 40 CFR 141.720 (UV dose tables)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WWEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '0.2.0';

  // ---------------------------------------------------------------- helpers
  const r = (x, d = 3) => (x == null || !isFinite(x)) ? x : Math.round(x * 10 ** d) / 10 ** d;
  const num = (x, def) => (x === '' || x == null || isNaN(+x)) ? def : +x;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /** Build a check row. range = [lo, hi] (either may be null). warnBand = fraction outside range treated as warn. */
  function check(item, value, unit, range, source, opts = {}) {
    const [lo, hi] = range || [null, null];
    let status = 'pass';
    if (value == null) status = 'info';
    else if (typeof value === 'number' && !isFinite(value)) status = 'fail';
    else {
      const band = opts.warnBand == null ? 0.10 : opts.warnBand;
      if (lo != null && value < lo) status = value < lo * (1 - band) ? 'fail' : 'warn';
      if (hi != null && value > hi) status = value > hi * (1 + band) ? 'fail' : 'warn';
      if (opts.hard && status === 'warn') status = 'fail';
      if (opts.soft && status === 'fail') status = 'warn';
    }
    return { item, value: (value == null || !isFinite(value)) ? value : r(value, opts.dp == null ? 3 : opts.dp), unit, range: [lo, hi], source, status, note: opts.note || '' };
  }
  const errRow = (item, note, source = 'Input validation') => ({ item, value: 'not valid', unit: '', range: [null, null], source, status: 'fail', note });
  const info = (item, value, unit, note = '') => ({ item, value: r(value, 3), unit, range: [null, null], source: '', status: 'info', note });

  // ---------------------------------------------------------------- physical properties
  /** DO saturation in fresh water at 1 atm, mg/L (APHA Standard Methods 4500-O / Benson & Krause). */
  function doSat(T) {
    const Tk = T + 273.15;
    const ln = -139.34411 + 1.575701e5 / Tk - 6.642308e7 / Tk ** 2 + 1.2438e10 / Tk ** 3 - 8.621949e11 / Tk ** 4;
    return Math.exp(ln);
  }
  /** Pressure ratio Pb/Ps at elevation z (m), barometric equation with air temperature T (°C). M&E Appendix B. */
  function pressureRatio(z, T) {
    return Math.exp(-9.81 * 28.97 * z / (8314 * (T + 273.15)));
  }
  /** Water dynamic viscosity, Pa·s (Vogel fit, 0–60 °C). */
  function waterViscosity(T) { return 2.414e-5 * 10 ** (247.8 / (T + 273.15 - 140)); }

  // ---------------------------------------------------------------- statistics
  function stats(values) {
    const v = (values || []).map(Number).filter(x => isFinite(x)).sort((a, b) => a - b);
    const n = v.length;
    if (!n) return { n: 0 };
    const pct = p => { const h = (n - 1) * p; const lo = Math.floor(h); return v[lo] + (h - lo) * ((v[Math.min(lo + 1, n - 1)]) - v[lo]); };
    const mean = v.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    return { n, min: v[0], max: v[n - 1], mean, sd, cov: mean ? sd / mean : null, p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), p99: pct(0.99) };
  }

  // ---------------------------------------------------------------- 1. DESIGN BASIS
  const PF_METHODS = {
    harmon: { label: 'Harmon (Ten States; Q Eq. 4.4)', f: P => 1 + 14 / (4 + Math.sqrt(P)) },
    qasim45: { label: 'Qasim Eq. 4.5: 5 / P^0.167', f: P => 5 / P ** 0.167 },
    babbitt: { label: 'Babbitt: 5 / P^0.2', f: P => 5 / P ** 0.2 },
    log47: { label: 'Qasim Eq. 4.7: log PF = −0.19 log P + 0.74', f: P => 10 ** (-0.19 * Math.log10(P) + 0.74) },
  };

  /**
   * Wastewater design basis.
   * inp: { population, perCapita (L/c/d), industrialFlow (m3/d), infiltration (m3/d), avgFlowOverride (m3/d),
   *        pfMethod, pfManual, maxDayFactor, maxMonthFactor, minMethod ('log48'|'manual'), minFactorManual,
   *        conc: {BOD, COD, sBOD, sCOD, TSS, VSS, TKN, NH4N, TP, FOG, Alk}, loadPF: {BOD, TSS, TKN, TP},
   *        Tmin, Tmax, origin: {param: 'measured'|'assumed'} }
   */
  function designBasis(inp) {
    const P = num(inp.population, 0) / 1000; // thousands
    const domestic = num(inp.population, 0) * num(inp.perCapita, 0) / 1000;
    const Qavg = num(inp.avgFlowOverride, 0) > 0 ? +inp.avgFlowOverride : domestic + num(inp.industrialFlow, 0) + num(inp.infiltration, 0);
    const pfTable = Object.entries(PF_METHODS).map(([k, m]) => ({ key: k, label: m.label, pf: P > 0 ? m.f(P) : null }));
    const pf = inp.pfMethod === 'manual' || !(P > 0) ? num(inp.pfManual, 3) : PF_METHODS[inp.pfMethod || 'harmon'].f(P);
    const mmin = inp.minMethod === 'manual' || !(P > 0) ? num(inp.minFactorManual, 0.3) : 10 ** (0.142 * Math.log10(P) - 0.682);
    // Peaking applies to the domestic component; industrial flow takes its own factor; infiltration is not peaked (Ten States; Qasim Ch. 4)
    const override = num(inp.avgFlowOverride, 0) > 0;
    const Qdom = override ? Qavg : domestic, Qind = override ? 0 : num(inp.industrialFlow, 0), Qinf = override ? 0 : num(inp.infiltration, 0);
    const ipf = num(inp.industrialPF, 1);
    const flows = {
      Qavg, Qdom, Qind, Qinf,
      Qpeak: Qdom * pf + Qind * ipf + Qinf, Qmin: Qdom * mmin + Qind * num(inp.industrialMinFactor, 1) + Qinf,
      QmaxDay: Qdom * num(inp.maxDayFactor, 1.5) + Qind * Math.max(1, ipf * 0.8) + Qinf, QmaxMonth: Qdom * num(inp.maxMonthFactor, 1.25) + Qind + Qinf,
      pf, mmin,
    };
    flows.pfOverall = Qavg > 0 ? flows.Qpeak / Qavg : null;
    const c = inp.conc || {};
    const loads = {};
    for (const k of Object.keys(c)) if (isFinite(+c[k]) && c[k] !== '') loads[k] = Qavg * +c[k] / 1000; // kg/d
    const lpf = inp.loadPF || {};
    const peakLoads = {};
    for (const k of Object.keys(lpf)) if (loads[k] != null) peakLoads[k] = loads[k] * num(lpf[k], 1);
    const PE = loads.BOD != null ? loads.BOD / 0.060 : null; // EU: 60 g BOD5/PE/d
    const checks = [];
    if (!(Qavg > 0)) checks.push(errRow('Average flow', 'Enter a population and per-capita flow, or an average flow'));
    if (P > 0) checks.push(check('Peaking factor, peak hour / average', pf, '–', [1.5, 4.5], 'Typical municipal range (Q Ex. 4.8; Ten States)'));
    if (P > 0 && P < 1 && inp.pfMethod !== 'manual') checks.push({ item: 'Population below 1,000', value: P * 1000, unit: 'people', range: [1000, null], source: 'Peaking equations are fitted for P ≥ 1,000; use plant or similar-community data', status: 'warn', note: 'Small systems peak more sharply (often 4–6)' });
    if (c.COD && c.BOD) {
      const ratio = c.COD / c.BOD;
      checks.push(check('COD / BOD ratio', ratio, '–', [1.5, 2.5], 'Municipal 1.9–2.5 typical; > 2.5 suggests low biodegradability (M&E Ch. 2)', { soft: true, warnBand: 0.6 }));
      checks.push(check('COD ≥ BOD (consistency)', c.COD - c.BOD, 'mg/L', [0, null], 'Data consistency', { hard: true }));
    }
    if (c.TKN != null && c.NH4N != null && c.TKN !== '' && c.NH4N !== '') checks.push(check('TKN ≥ NH4-N (consistency)', c.TKN - c.NH4N, 'mg/L', [0, null], 'Data consistency', { hard: true }));
    if (c.TSS && c.VSS) checks.push(check('VSS / TSS ratio', c.VSS / c.TSS, '–', [0.6, 0.9], 'Municipal 0.7–0.85 typical (M&E Ch. 2)', { soft: true }));
    if (c.BOD && c.TKN) checks.push(check('Nitrogen available, TKN per 100 BOD', 100 * c.TKN / c.BOD, 'g N/100 g BOD', [5, null], 'Nutrient balance BOD:N:P = 100:5:1 (Q Ch. 10)', { soft: true, note: 'Below 5: nitrogen dosing (urea) likely needed' }));
    if (c.BOD && c.TP) checks.push(check('Phosphorus available, TP per 100 BOD', 100 * c.TP / c.BOD, 'g P/100 g BOD', [1, null], 'Nutrient balance BOD:N:P = 100:5:1', { soft: true, note: 'Below 1: phosphorus dosing likely needed' }));
    if (c.BOD && c.Alk && c.TKN) checks.push(check('Alkalinity vs nitrification demand', c.Alk - 7.14 * c.TKN * 0.8, 'mg/L as CaCO3', [50, null], 'Residual ≥ 50–70 mg/L after 7.14 g CaCO3 per g N nitrified (M&E Ex. 8-3)', { soft: true, note: 'Rough screen assuming 80% of TKN nitrified' }));
    const origin = inp.origin || {};
    const assumed = Object.keys(c).filter(k => c[k] !== '' && c[k] != null && origin[k] !== 'measured');
    if (assumed.length) checks.push({ item: 'Assumed (not measured) inputs', value: assumed.length, unit: 'parameters', range: [null, null], source: 'Measured vs assumed flag', status: 'warn', note: assumed.join(', ') });
    return { flows, pfTable, mmin, loads, peakLoads, PE, checks };
  }

  /**
   * Water demand and plant capacity.
   * inp: { population, perCapita, nonDomesticPct, lossesPct, maxDayFactor, peakHourFactor, processWaterPct, operatingHours }
   */
  function waterDemand(inp) {
    const pop = num(inp.population, 0), pc = num(inp.perCapita, 120);
    const domestic = pop * pc / 1000;
    const demand = domestic * (1 + num(inp.nonDomesticPct, 0) / 100);
    const lp = Math.min(num(inp.lossesPct, 0), 90);
    const avgProduction = demand / (1 - lp / 100);
    const maxDay = avgProduction * num(inp.maxDayFactor, 1.5);
    const peakHour = maxDay * num(inp.peakHourFactor, 1.5);
    const plantCapacity = maxDay * (1 + num(inp.processWaterPct, 5) / 100) * 24 / num(inp.operatingHours, 24);
    const checks = [
      check('Per-capita demand', pc, 'L/c/d', [60, 250], 'Nigeria policy 120 urban / 60 semi-urban; Kenya practice manual 75–250 urban', { soft: true }),
      check('Losses (non-revenue water)', num(inp.lossesPct, 0), '%', [5, 30], 'Kenya manual includes ~20%; Mwache WTP 5% production losses', { soft: true }),
      check('Process water (backwash, desludging)', num(inp.processWaterPct, 5), '%', [2, 5], '2–5% of production (Kenya manual 5%)', { soft: true }),
    ];
    return { domestic, demand, avgProduction, maxDay, peakHour, plantCapacity, checks };
  }

  // ---------------------------------------------------------------- STANDARDS LIBRARY
  // Values: [limit] single max, or {min,max} range (pH). status: 'verified' (primary text checked) | 'to verify'
  const STANDARDS = {
    effluent: {
      ZA_GN665_general: { name: 'South Africa GN 665 (2013) — General limits', version: 'GN 665 of 6 Sep 2013', checked: '2026-10-14', status: 'verified',
        url: 'https://api.acts.co.za/national-water-act-1998/n665_2__discharge_of_waste_or_water.php',
        limits: { COD: 75, TSS: 25, NH4N: 6, NO3N: 15, oPO4P: 10, FOG: 2.5, pH: { min: 5.5, max: 9.5 }, FaecalColi: 1000, freeCl: 0.25 } },
      ZA_GN665_special: { name: 'South Africa GN 665 (2013) — Special limits', version: 'GN 665 of 6 Sep 2013', checked: '2026-10-14', status: 'verified',
        url: 'https://api.acts.co.za/national-water-act-1998/n665_2__discharge_of_waste_or_water.php',
        limits: { COD: 30, TSS: 10, NH4N: 2, NO3N: 1.5, oPO4P: 1, FOG: 0, pH: { min: 5.5, max: 7.5 }, FaecalColi: 0, freeCl: 0 } },
      KE_2024_environment: { name: 'Kenya EMC (Water Quality) Regulations 2024 — discharge to environment', version: 'L.N. 177/2024', checked: '2026-10-14', status: 'to verify',
        url: 'https://new.kenyalaw.org/akn/ke/act/ln/2024/177/eng@2024-12-06',
        limits: { BOD: 30, COD: 50, TSS: 30, FOG: 0, TN: 2, TP: 2, pH: { min: 6.5, max: 8.5 } }, note: 'TN value looks strict; confirm against gazette' },
      KE_2024_sewer: { name: 'Kenya EMC (Water Quality) Regulations 2024 — discharge to public sewer', version: 'L.N. 177/2024', checked: '2026-10-14', status: 'to verify',
        url: 'https://new.kenyalaw.org/akn/ke/act/ln/2024/177/eng@2024-12-06',
        limits: { BOD: 500, COD: 1000, TSS: 250, FOG: 5, NH4N: 20, PO4: 30, pH: { min: 6, max: 9 } } },
      NG_NESREA_FBT_2009: { name: 'Nigeria NESREA Food, Beverages & Tobacco Sector Regulations 2009 (Schedule I)', version: 'S.I. 2009', checked: '2026-10-14', status: 'verified',
        url: 'https://nesrea.gov.ng/wp-content/uploads/2025/05/Food_Beverages_and_Tobacco_Sector_Regulation-2009.pdf',
        limits: { BOD: 30, COD: 60, TSS: 25, TDS: 500, FOG: 10, NH4N: 1.0, NO3N: 10, TP: 2.0, pH: { min: 6.5, max: 8.8 } },
        note: 'Schedule gives paired values (e.g. BOD 30/50, COD 60/90); the stricter value is used here. Confirm which applies to your discharge.' },
      GH_EPA_guideline: { name: 'Ghana EPA effluent guideline (pre-2025) — partial', version: 'Superseded by L.I. 2506 (2025) / GS 1212', checked: '2026-10-14', status: 'to verify',
        limits: { BOD: 50, COD: 250 }, note: 'Buy GS 1212 and update before use' },
      EU_UWWTD_secondary: { name: 'EU UWWTD secondary treatment (91/271/EEC Annex I Table 1)', version: '91/271/EEC; recast (EU) 2024/3019 transposition by 2027', checked: '2026-10-14', status: 'to verify',
        limits: { BOD: 25, COD: 125, TSS: 35 } },
      EU_BREF_FDM_upper: { name: 'EU Food, Drink & Milk BAT-AELs (upper end of range)', version: 'Decision (EU) 2019/2031', checked: '2026-10-14', status: 'verified',
        limits: { COD: 100, TSS: 50, TN: 20, TP: 2 }, note: 'Permit sets the value within the range; upper end shown' },
    },
    drinking: {
      WHO_GDWQ: { name: 'WHO Guidelines for Drinking-water Quality, 4th ed. + addenda', version: '2026 consolidation', checked: '2026-10-14', status: 'verified',
        limits: { turbidity: 1, NO3: 50, F: 1.5, As: 0.01, Ecoli: 0, Mn: 0.08 }, note: 'Turbidity < 1 NTU is an operational target; Mn health-based value to verify' },
      NG_NIS554_2007: { name: 'Nigeria NIS 554 (2007)', version: '2007 (2015 revision not checked)', checked: '2026-10-14', status: 'verified',
        limits: { turbidity: 5, colour: 15, pH: { min: 6.5, max: 8.5 }, TDS: 500, Fe: 0.3, Mn: 0.2, hardness: 150, NO3: 50, F: 1.5, As: 0.01, Ecoli: 0, freeCl: { min: 0.2, max: 0.25 } } },
      GH_GS175: { name: 'Ghana GS 175 (draft 2021)', version: 'DGS 175:2021', checked: '2026-10-14', status: 'to verify',
        limits: { turbidity: 5, colour: 5, pH: { min: 6.5, max: 8.5 }, TDS: 500, Fe: 0.3, Mn: 0.4, hardness: 500, NO3: 50, F: 1.5, As: 0.01, Ecoli: 0 } },
      ZA_SANS241_2015: { name: 'South Africa SANS 241-1:2015', version: '2015', checked: '2026-10-14', status: 'verified',
        limits: { turbidity: 5, colour: 15, pH: { min: 5, max: 9.7 }, TDS: 1200, Fe: 2.0, Mn: 0.4, NO3: 49, F: 1.5, As: 0.01, Ecoli: 0, freeCl: 5 }, note: 'Health limits; aesthetic Fe 0.3, Mn 0.1; operational turbidity 1 NTU' },
      EU_DWD_2020: { name: 'EU Drinking Water Directive (EU) 2020/2184', version: '2020/2184', checked: '2026-10-14', status: 'verified',
        limits: { pH: { min: 6.5, max: 9.5 }, Fe: 0.2, Mn: 0.05, NO3: 50, F: 1.5, As: 0.01, Ecoli: 0 } },
    },
    labels: { BOD: 'BOD5', COD: 'COD', TSS: 'TSS', TDS: 'TDS', FOG: 'Oil & grease', NH4N: 'NH3/NH4-N', NO3N: 'NO3-N', TN: 'Total N', TP: 'Total P', oPO4P: 'Ortho-P', PO4: 'Phosphate', pH: 'pH', FaecalColi: 'Faecal coliforms (per 100 mL)', freeCl: 'Free chlorine', turbidity: 'Turbidity (NTU)', colour: 'Colour (TCU)', Fe: 'Iron', Mn: 'Manganese', hardness: 'Hardness (as CaCO3)', NO3: 'Nitrate (as NO3)', F: 'Fluoride', As: 'Arsenic', Ecoli: 'E. coli (per 100 mL)' },
  };

  /** Compare predicted quality with a standard. kind 'effluent'|'drinking'. */
  function compliance(predicted, kind, standardId) {
    const s = STANDARDS[kind] && STANDARDS[kind][standardId];
    if (!s) return { standard: null, rows: [] };
    const rows = [];
    for (const [k, lim] of Object.entries(s.limits)) {
      const v = predicted[k];
      if (v == null || v === '' || !isFinite(+v)) { rows.push({ param: k, label: STANDARDS.labels[k] || k, limit: lim, value: null, status: 'info' }); continue; }
      let status = 'pass';
      if (typeof lim === 'object') { if ((lim.min != null && +v < lim.min) || (lim.max != null && +v > lim.max)) status = 'fail'; }
      else if (+v > lim) status = 'fail';
      else if (+v > 0.9 * lim) status = 'warn';
      rows.push({ param: k, label: STANDARDS.labels[k] || k, limit: lim, value: +v, status });
    }
    return { standard: s, rows };
  }

  // ---------------------------------------------------------------- 2. ACTIVATED SLUDGE (M&E 5th ed. steady-state method, Sec. 8-6)
  const KINETICS_DEFAULT = { // M&E Table 8-14 at 20 °C
    het: { mumax: 6.0, Ks: 8.0, Y: 0.45, b: 0.12, fd: 0.15, thMu: 1.07, thB: 1.04 },
    aob: { mumax: 0.90, Kn: 0.50, Y: 0.15, b: 0.17, Ko: 0.50, thMu: 1.072, thB: 1.029 },
  };

  const AS_CRITERIA = {
    // F/M kg BOD/kg VSS·d, SRT d, MLSS mg/L, HRT h, vol load kg BOD/m3·d — Q Appendix E; M&E Table 8-5, Sec. 8-3
    conventional: { label: 'Conventional / complete mix', fm: [0.2, 0.6], srt: [3, 15], mlss: [1200, 4000], vl: [0.3, 1.0], hrt: [3, 8], src: 'Q App. E; M&E Sec. 8-3' },
    nitrifying: { label: 'Nitrifying / BNR', fm: [0.1, 0.25], srt: [7, 40], mlss: [2000, 4000], vl: [0.1, 0.5], hrt: [6, 24], src: 'Q App. E (BNR); M&E Table 8-5' },
    extended: { label: 'Extended aeration / oxidation ditch', fm: [0.04, 0.2], srt: [15, 40], mlss: [2000, 5000], vl: [0.08, 0.3], hrt: [18, 36], src: 'Q App. E; M&E' },
  };

  /**
   * inp: { Q, BOD, sBOD, COD, sCOD, TSS, VSS, TKN, Alk, bcodRatio, T, mode: 'bod'|'nit'|'nitdn',
   *        srtBOD, SF, NeTarget, DO, MLSS, nTanks, depth, diffHeight, elevation, alpha, beta, F, SOTE, de, Tair,
   *        Xr, TSSe, sBODe, alkResidual, NO3eTarget, SDNR, process ('conventional'|'nitrifying'|'extended'), kinetics }
   */
  function activatedSludge(inp) {
    const k = mergeKin(inp.kinetics);
    const Q = num(inp.Q, 0), T = num(inp.T, 20);
    const ratio = num(inp.bcodRatio, 1.6);
    const BOD = num(inp.BOD, 0), sBOD = num(inp.sBOD, BOD * 0.5);
    const COD = num(inp.COD, BOD * 2.1), sCOD = num(inp.sCOD, COD * 0.44);
    const TSS = num(inp.TSS, 0), VSS = num(inp.VSS, TSS * 0.85), TKN = num(inp.TKN, 0);
    // Step 1: wastewater fractions (M&E Ex. 8-3 step 1)
    const bCOD = ratio * BOD;
    const nbsCODe = Math.max(0, sCOD - ratio * sBOD);
    const nbpCOD = Math.max(0, COD - bCOD - nbsCODe);
    const VSScod = VSS > 0 ? (COD - sCOD) / VSS : 1.42;
    const nbVSS = VSScod > 0 ? nbpCOD / VSScod : 0;
    const iTSS = Math.max(0, TSS - VSS);
    // Temperature-corrected kinetics
    const muH = k.het.mumax * k.het.thMu ** (T - 20), bH = k.het.b * k.het.thB ** (T - 20), Ks = k.het.Ks;
    const muA = k.aob.mumax * k.aob.thMu ** (T - 20), bA = k.aob.b * k.aob.thB ** (T - 20);
    const DO = num(inp.DO, 2.0), Ne = num(inp.NeTarget, 0.5);
    const mode = inp.mode || 'bod';
    let srtTheo = null, muN = null, SF = null, SRT;
    if (mode === 'bod') SRT = num(inp.srtBOD, 5);
    else {
      muN = muA * (Ne / (k.aob.Kn + Ne)) * (DO / (k.aob.Ko + DO)) - bA;
      srtTheo = muN > 0 ? 1 / muN : Infinity;
      SF = num(inp.SF, 1.5);
      SRT = num(inp.srtOverride, 0) > 0 ? +inp.srtOverride : SF * srtTheo;
    }
    const guard = [];
    if (!(Q > 0)) guard.push(errRow('Flow', 'Flow must be greater than zero'));
    if (!(BOD > 0)) guard.push(errRow('BOD', 'BOD must be greater than zero'));
    if (mode !== 'bod' && !(muN > 0)) guard.push(errRow('Nitrification', `Nitrifiers wash out at ${T} °C and DO ${DO} mg/L (net growth rate ${r(muN, 4)} g/g·d). Raise DO or temperature, or relax the NH4-N target.`, 'M&E Eq. 7-94'));
    const Sraw = Ks * (1 + bH * SRT) / (SRT * (muH - bH) - 1);
    if (isFinite(SRT) && SRT * (muH - bH) > 1 && Sraw >= bCOD) guard.push(errRow('SRT', `SRT ${r(SRT, 2)} d is too short: predicted effluent soluble bCOD (${r(Sraw, 0)} mg/L) is at or above the influent (${r(bCOD, 0)} mg/L)`, 'M&E Eq. 7-46'));
    if (isFinite(SRT) && SRT * (muH - bH) <= 1) guard.push(errRow('SRT', `SRT ${r(SRT, 2)} d is below heterotroph washout (needs SRT·(µ−b) > 1, i.e. > ${r(1 / (muH - bH), 2)} d)`, 'M&E Eq. 7-46'));
    if (!(num(inp.MLSS, 3000) > 0)) guard.push(errRow('MLSS', 'MLSS must be greater than zero'));
    if (guard.length) return { error: guard.map(g => g.note).join(' '), checks: guard };
    const S = Math.min(bCOD, Ks * (1 + bH * SRT) / (SRT * (muH - bH) - 1));
    const QY = Q * k.het.Y * (bCOD - S) / 1000; // kg/d
    const PA = QY / (1 + bH * SRT);
    const PB = k.het.fd * bH * QY * SRT / (1 + bH * SRT);
    // Nitrification: iterate NOx (M&E Ex. 8-3 steps 11–12)
    let NOx = 0, PC = 0;
    if (mode !== 'bod') {
      NOx = 0.8 * TKN;
      for (let i = 0; i < 20; i++) {
        PC = Q * k.aob.Y * NOx / 1000 / (1 + bA * SRT);
        const n2 = TKN - Ne - 0.12 * (PA + PB + PC) * 1000 / Q;
        if (Math.abs(n2 - NOx) < 1e-6) { NOx = n2; break; }
        NOx = n2;
      }
      PC = Q * k.aob.Y * NOx / 1000 / (1 + bA * SRT);
    }
    const Pbio = PA + PB + PC;
    const PxVSS = Pbio + Q * nbVSS / 1000;
    const PxTSS = Pbio / 0.85 + Q * nbVSS / 1000 + Q * iTSS / 1000;
    const massVSS = PxVSS * SRT, massTSS = PxTSS * SRT;
    const MLSS = num(inp.MLSS, 3000);
    const V = massTSS * 1000 / MLSS; // m3
    const nT = Math.max(1, Math.round(num(inp.nTanks, 1)));
    const HRT = V / Q * 24;
    const fv = massVSS / massTSS, MLVSS = fv * MLSS;
    const FM = Q * BOD / (MLVSS * V);
    const VL = Q * BOD / 1000 / V;
    const bCODrem = Q * (bCOD - S) / 1000;
    const YobsTSS = PxTSS / bCODrem, YobsVSS = YobsTSS * fv;
    // Denitrification (MLE pre-anoxic) — optional
    let dn = null, NO3den = 0;
    if (mode === 'nitdn' && R == null) return { error: 'Return sludge concentration must exceed MLSS', checks: [errRow('RAS', 'Return sludge concentration Xr must exceed MLSS')] };
    const XrIn = num(inp.Xr, 8000);
    const R = XrIn > MLSS ? MLSS / (XrIn - MLSS) : null;
    if (mode === 'nitdn') {
      const NO3e = num(inp.NO3eTarget, 6);
      const IR = Math.max(0, NOx / NO3e - 1 - (R || 0)); // M&E Sec. 8-7 MLE mass balance: IR = NOx/NO3e − 1 − R
      const NO3feed = (IR + (R || 0)) * Q * NO3e / 1000; // kg/d of NO3-N to anoxic zone
      NO3den = Math.max(0, NOx - NO3e);
      const SDNR = num(inp.SDNR, 0.10);
      const Vanox = NO3feed * 1000 / (SDNR * MLVSS); // m3
      dn = { NO3e, IR, NO3feed, SDNR, Vanox, HRTanox: Vanox / Q * 24, NO3removed: NO3den * Q / 1000, bcodPerN: NO3den > 0 ? bCOD / NO3den : null };
    }
    // Oxygen demand (M&E Eq. 8-23), heterotroph biomass only (parts A+B)
    const RoKgD = bCODrem - 1.42 * (PA + PB) + 4.57 * Q * NOx / 1000 - (mode === 'nitdn' ? 2.86 * NO3den * Q / 1000 : 0);
    const Ro = RoKgD / 24; // kg/h
    // Aeration (M&E Ex. 8-3 step 8)
    const aer = aeration({ AOTR: Ro, T, DO, elevation: num(inp.elevation, 0), depth: num(inp.depth, 4.9), diffHeight: num(inp.diffHeight, 0.5),
      alpha: num(inp.alpha, mode === 'bod' ? 0.50 : 0.65), beta: num(inp.beta, 0.95), F: num(inp.F, 0.9), SOTE: num(inp.SOTE, 0.35), de: num(inp.de, 0.40), Tair: num(inp.Tair, T),
      dwp: num(inp.dwp, 5), pipeLoss: num(inp.pipeLoss, 7), blowerEff: num(inp.blowerEff, 0.7), Tinlet: num(inp.Tinlet, 30) });
    // Alkalinity (M&E Ex. 8-3 step 19)
    const alkUsed = 7.14 * NOx - (mode === 'nitdn' ? 3.57 * NO3den : 0);
    const alkRes = num(inp.alkResidual, 70);
    const alkAdd = Math.max(0, alkRes - (num(inp.Alk, 0) - alkUsed));
    const alkAddKg = alkAdd * Q / 1000;
    // Effluent BOD (M&E Eq. 8-26)
    const TSSe = num(inp.TSSe, 10), sBODe = num(inp.sBODe, 3);
    const BODe = sBODe + 0.85 * 0.85 * TSSe;
    // RAS and WAS (M&E Eqs. 8-28 to 8-32), wasting from return line
    const Xr = XrIn;
    const Qw = Xr > TSSe ? (V * MLSS / SRT - Q * TSSe) / (Xr - TSSe) : null; // m3/d, wasting from return line (M&E Eq. 7-56 rearranged)
    const proc = AS_CRITERIA[inp.process || (mode === 'bod' ? 'conventional' : 'nitrifying')];
    const checks = [
      check('SRT (aerobic)', SRT, 'd', proc.srt, proc.src),
      check('F/M', FM, 'kg BOD/kg MLVSS·d', proc.fm, proc.src),
      check('MLSS', MLSS, 'mg/L', proc.mlss, proc.src),
      check('Volumetric BOD load', VL, 'kg BOD/m³·d', proc.vl, proc.src),
      check('HRT', HRT, 'h', proc.hrt, proc.src, { soft: true }),
      check('Effluent soluble bCOD, S', S, 'mg/L', [null, 5], 'M&E Eq. 7-46', { soft: true }),
      check('Residual alkalinity before addition', num(inp.Alk, 0) - alkUsed, 'mg/L as CaCO3', [alkRes, null], 'Keep ≥ 70 mg/L to hold pH ~7 (M&E Ex. 8-3)', { soft: true, note: alkAdd > 0 ? 'Alkalinity addition required' : '' }),
      check('Oxygen per BOD removed', RoKgD / (Q * BOD / 1000), 'kg O2/kg BOD', [0.6, 2.4], 'Q App. E (0.6–2.4 incl. nitrification)', { soft: true }),
      R == null ? errRow('RAS ratio', 'Return sludge concentration Xr must exceed MLSS') : check('RAS ratio R', R, '–', [0.25, 1.0], 'Q App. E (0.2–1); M&E Ex. 8-3 uses 0.6', { soft: true }),
      Qw == null || Qw <= 0 ? errRow('Waste sludge flow', 'Effluent solids already exceed sludge production at this SRT; lower effluent TSS or shorten SRT') : info('Waste sludge flow (from return line)', Qw, 'm³/d'),
      check('Tanks for maintenance', nT, 'no.', [2, null], 'At least 2 so one can be taken offline (M&E Ex. 8-3; Ten States)', { soft: true }),
    ];
    if (mode !== 'bod') checks.push(check('Safety factor on nitrification SRT', SF, '–', [1.3, 2.0], 'M&E Table 8-15: SF = peak/average TKN load, 1.3–2.0'));
    if (dn) {
      checks.push(check('Specific denitrification rate SDNR', dn.SDNR, 'g NO3-N/g MLVSS·d', [0.04, 0.42], 'M&E Sec. 8-7 full-scale range'));
      checks.push(check('Internal recycle ratio', dn.IR, '–', [1, 4], 'Q App. E (1–4)', { soft: true }));
      if (dn.bcodPerN != null) checks.push(check('bCOD available per NO3-N denitrified', dn.bcodPerN, 'g/g', [4, null], 'Rule of thumb ≥ 4 g bCOD/g NO3-N for pre-anoxic denitrification', { soft: true }));
      checks.push(info('Total volume, aerobic + anoxic', V + dn.Vanox, 'm³', 'Aerobic SRT applies to the aerobic volume only'));
    }
    checks.push(...aer.checks);
    return {
      fractions: { bCOD, nbsCODe, nbpCOD, VSScod, nbVSS, iTSS },
      kinetics: { muH, bH, muA, bA, muN, srtTheo, SF },
      error: null, SRT, S, PA, PB, PC, Pbio, PxVSS, PxTSS, massVSS, massTSS, V, Veach: V / nT, nT, HRT, MLSS, MLVSS, fv, FM, VL, bCODrem, YobsTSS, YobsVSS,
      YobsTSSperBOD: YobsTSS * ratio, YobsVSSperBOD: YobsVSS * ratio,
      Vtotal: V + (dn ? dn.Vanox : 0), NOx, dn, RoKgD, Ro, aer, alkUsed, alkAdd, alkAddKg, NaHCO3: alkAddKg * 84 / 50, BODe, TSSe, NeTarget: Ne, R, Qw,
      effluent: { BOD: BODe, TSS: TSSe, NH4N: mode === 'bod' ? null : Ne, NO3N: dn ? dn.NO3e : (mode === 'nit' ? NOx : null) },
      checks,
    };
  }
  function mergeKin(kin) {
    const d = JSON.parse(JSON.stringify(KINETICS_DEFAULT));
    if (kin) for (const g of ['het', 'aob']) if (kin[g]) for (const [kk, v] of Object.entries(kin[g])) if (isFinite(+v) && v !== '') d[g][kk] = +v;
    return d;
  }

  /**
   * Diffused aeration: AOTR → SOTR → air flow → blower.
   * M&E Eq. 5-55/Ex. 8-3 step 8; blower Eq. 5-77.
   * inp: { AOTR kg/h, T, DO, elevation, depth, diffHeight, alpha, beta, F, SOTE (fraction), de, Tair, dwp (kPa), pipeLoss (kPa), blowerEff, Tinlet }
   */
  function aeration(inp) {
    const T = inp.T, Cst = doSat(T), Cs20 = doSat(20);
    const PbPs = pressureRatio(inp.elevation, inp.Tair == null ? T : inp.Tair);
    const Df = inp.depth - inp.diffHeight;
    const Cinf20 = Cs20 * (1 + inp.de * Df / 10.33);
    const denom = inp.beta * (Cst / Cs20) * PbPs * Cinf20 - inp.DO;
    if (!(denom > 0.5)) return { error: 'DO set-point is at or above field saturation', checks: [errRow('Aeration', `DO set-point ${inp.DO} mg/L is too close to field saturation (${r(denom + inp.DO, 2)} mg/L)`, 'M&E Eq. 5-55')], SOTR: NaN, airM3min: NaN, Pw: NaN };
    const SOTR = inp.AOTR / (inp.alpha * inp.F) * (Cinf20 / denom) * 1.024 ** (20 - T);
    const Pb = PbPs * 101.325; // kPa
    const rhoAir = Pb * 1000 * 28.97 / (8314 * (T + 273.15));
    const O2perM3 = 0.2318 * rhoAir;
    const airM3min = SOTR / (inp.SOTE * 60 * O2perM3);
    // Blower (adiabatic, M&E Eq. 5-77, SI): Pw(kW) = wRT1/(29.7 n e)[(p2/p1)^0.283 − 1]
    const p1 = Pb, p2 = Pb + 9.81 * Df + inp.dwp + inp.pipeLoss; // kPa
    const T1 = (inp.Tinlet == null ? 30 : inp.Tinlet) + 273.15;
    const w = airM3min * rhoAir / 60; // kg/s
    const Pw = w * 8.314 * T1 / (29.7 * 0.283 * inp.blowerEff) * ((p2 / p1) ** 0.283 - 1);
    const checks = [
      check('Alpha factor', inp.alpha, '–', [0.3, 0.8], 'M&E: diffused 0.4–0.8; Q 0.4–0.8; lower at high MLSS', { soft: true }),
      check('Beta factor', inp.beta, '–', [0.8, 1.0], 'M&E 0.8–1.0; Q typical 0.95'),
      check('Fouling factor F', inp.F, '–', [0.65, 0.9], 'M&E Sec. 5-11', { soft: true }),
      check('Clean-water SOTE at depth', inp.SOTE * 100, '%', [7, 40], 'M&E Table 5-28: fine pore 25–35% at 4.5 m; coarse 7–15% (Q)', { soft: true }),
      check('Diffuser submergence', Df, 'm', [3, 7], 'Typical diffused aeration 3–7 m', { soft: true }),
    ];
    return { Cst, Cs20, PbPs, Df, Cinf20, SOTR, rhoAir, O2perM3, airM3min, airNm3h: airM3min * 60 * (Pb / 101.325) * (273.15 / (T + 273.15)), p1, p2, dP: p2 - p1, w, Pw, checks };
  }

  /** Activated sludge CHECK mode: rate an existing / proposed reactor. */
  function activatedSludgeCheck(inp) {
    const Q = num(inp.Q, 0), V = num(inp.V, 0), MLSS = num(inp.MLSS, 3000), fv = num(inp.fv, 0.8);
    const MLVSS = MLSS * fv, BOD = num(inp.BOD, 0);
    const Qw = num(inp.Qw, 0), Xr = num(inp.Xr, 8000), TSSe = num(inp.TSSe, 10);
    if (!(V > 0) || !(Q > 0)) return { error: 'Enter the reactor volume and flow', checks: [errRow('Volume / flow', 'Reactor volume and flow must be greater than zero')] };
    const SRT = (Qw > 0) ? V * MLSS / (Qw * Xr + (Q - Qw) * TSSe) : num(inp.SRT, null);
    if (!(SRT > 0)) return { error: 'Enter the waste sludge flow (or the operating SRT)', checks: [errRow('SRT', 'Enter the waste sludge flow (WAS) or the operating SRT')] };
    const FM = Q * BOD / (MLVSS * V), VL = Q * BOD / 1000 / V, HRT = V / Q * 24;
    const proc = AS_CRITERIA[inp.process || ((inp.mode && inp.mode !== 'bod') ? 'nitrifying' : 'conventional')];
    // Design run at the checked SRT to find oxygen demand and required volume
    const design = activatedSludge(Object.assign({}, inp, { mode: inp.mode || 'bod', srtBOD: SRT, srtOverride: (inp.mode && inp.mode !== 'bod') ? SRT : null }));
    if (design.error) return { error: design.error, checks: design.checks };
    let nitSRTreq = null, NeAchieved = null;
    if (inp.mode && inp.mode !== 'bod') {
      const d2 = activatedSludge(Object.assign({}, inp, { srtOverride: null })); nitSRTreq = d2.SRT;
      const k = mergeKin(inp.kinetics), T = num(inp.T, 20), DO = num(inp.DO, 2);
      const muA = k.aob.mumax * k.aob.thMu ** (T - 20) * DO / (k.aob.Ko + DO), bA = k.aob.b * k.aob.thB ** (T - 20);
      const den = SRT * (muA - bA) - 1;
      NeAchieved = den > 0 ? k.aob.Kn * (1 + bA * SRT) / den : Infinity; // M&E Eq. 7-46 form with DO term
    }
    const airSupplied = num(inp.airSupplied, null);
    const checks = [
      check('SRT (from wasting rate)', SRT, 'd', proc.srt, proc.src),
      check('F/M', FM, 'kg BOD/kg MLVSS·d', proc.fm, proc.src),
      check('MLSS', MLSS, 'mg/L', proc.mlss, proc.src),
      check('Volumetric BOD load', VL, 'kg BOD/m³·d', proc.vl, proc.src),
      check('HRT', HRT, 'h', proc.hrt, proc.src, { soft: true }),
      check('Reactor volume provided vs needed at this SRT and MLSS', V / design.V, '× needed', [1.0, null], 'M&E Sec. 8-6 mass balance', { hard: true }),
    ];
    if (nitSRTreq) checks.push(check('SRT vs SRT needed for nitrification', SRT / nitSRTreq, '× needed', [1.0, null], 'M&E Eq. 7-98 × safety factor', { hard: true }));
    if (NeAchieved != null) checks.push(check('Effluent NH4-N expected at this SRT (average load)', NeAchieved, 'mg/L', [null, num(inp.NeTarget, 0.5)], 'M&E Eq. 7-46 with DO limitation', { soft: true }));
    if (airSupplied) checks.push(check('Air supplied vs air needed', airSupplied / design.aer.airM3min, '× needed', [1.0, null], 'M&E Eq. 5-55', { hard: true }));
    return { error: null, SRT, FM, VL, HRT, MLVSS, design, nitSRTreq, NeAchieved, checks };
  }

  // ---------------------------------------------------------------- 3. SETTLING TANKS & CLARIFIERS
  // Criteria sets keyed by duty. SOR m3/m2·d (avg, peak); SLR kg/m2·h (avg, peak); HRT h; weir m3/m·d; SWD m.
  const CLARIFIER_CRITERIA = {
    primary: {
      ME: { label: 'M&E Table 5-19', sorAvg: [30, 50], sorPeak: [80, 120], hrt: [1.5, 2.5], weir: [125, 500], swd: [3, 4.9] },
      Q: { label: 'Qasim App. E', sorAvg: [24, 48], sorPeak: [40, 100], hrt: [1.5, 4], weir: [125, 375] },
      TS: { label: 'Ten States 2014 (via Tennessee Ch. 5)', sorAvg: [null, 49], sorPeak: [null, 122], hrt: [null, 2.5], weir: [null, 186], swd: [2.4, null] },
    },
    primaryWAS: {
      ME: { label: 'M&E Table 5-19 (with WAS)', sorAvg: [24, 32], sorPeak: [48, 70], hrt: [1.5, 2.5], weir: [125, 500] },
      Q: { label: 'Qasim App. E', sorAvg: [24, 48], sorPeak: [40, 100], hrt: [1.5, 4], weir: [125, 375] },
    },
    secondaryAS: {
      ME: { label: 'M&E Table 8-34 (air activated sludge)', sorAvg: [16, 28], sorPeak: [36, 56], slrAvg: [4, 6], slrPeak: [null, 10], swd: [4.0, 5.5] },
      Q: { label: 'Qasim App. E (activated sludge)', sorAvg: [16, 24], sorPeak: [40, 64], slrAvg: [1, 8], slrPeak: [7, 10] },
      TS: { label: 'Ten States 2014 (via Tennessee)', sorAvg: [null, 32.6], sorPeak: [null, 48.9], slrAvg: [null, 6.1], slrPeak: [null, 10.2] },
    },
    secondaryBNR: {
      ME: { label: 'M&E Table 8-34 (selectors, BNR)', sorAvg: [24, 32], sorPeak: [40, 64], slrAvg: [5, 8], slrPeak: [null, 10], swd: [4.0, 5.5] },
      Q: { label: 'Qasim App. E (EBPR/BNR)', sorAvg: [12, 32], sorPeak: [40, 64], slrAvg: [1, 8], slrPeak: [7, 10] },
    },
    secondaryEA: {
      ME: { label: 'M&E Table 8-34 (extended aeration)', sorAvg: [8, 16], sorPeak: [24, 32], slrAvg: [1.0, 5], slrPeak: [null, 8], swd: [4.0, 5.5] },
      Q: { label: 'Qasim App. E (extended aeration)', sorAvg: [8, 16], sorPeak: [40, 64], slrAvg: [1, 8], slrPeak: [7, 10] },
    },
    waterHorizontal: {
      TS: { label: 'Ten States Water Works 2022 (as adopted, e.g. Alabama/Virginia)', sorAvg: [null, 34.6], hrt: [4, null], weir: [null, 248], vh: [null, 0.15] },
    },
    waterTube: {
      TS: { label: 'Ten States Water Works 2022: tube settlers ≤ 2 gpm/ft²', sorAvg: [null, 117] },
    },
    waterSolidsContact: {
      TS: { label: 'Ten States Water Works 2022: solids contact', sorAvg: [null, 58.7], hrt: [2, null], weir: [null, 179] },
    },
  };

  /** Zone settling velocity, m/h, from SVI. M&E Eq. 8-86: ln(Vs) = 1.871 − (0.165 + 0.00159·SVI)·X, X in g/L. */
  function settlingVelocity(X_gL, SVI, method = 'ME8-86', vmax = 7, K = 600) {
    if (method === 'vesilind') return vmax * Math.exp(-(K / 1e6) * X_gL * 1000);
    return Math.exp(1.871 - (0.165 + 0.00159 * SVI) * X_gL);
  }

  /** Solids flux / state point analysis. Q m3/d per unit, Qr m3/d, A m2, X0 g/L. */
  function statePoint({ Q, Qr, A, X0, SVI, method }) {
    if (!(Qr > 0) || !(A > 0) || !(X0 > 0)) return { error: 'RAS flow, area and MLSS must be greater than zero' };
    const vo = Q / A / 24, vu = Qr / A / 24; // m/h
    const Gg = X => X * settlingVelocity(X, SVI, method);
    const Gt = X => Gg(X) + vu * X; // total flux at bulk underflow velocity
    const applied = (Q + Qr) * X0 / A / 24; // kg/m2·h
    const Xu = X0 * (Q + Qr) / Qr;
    // limiting flux: local minimum of Gt beyond the peak of Gg (search X from X0 to 40 g/L)
    let Xpk = 0, Gpk = 0;
    for (let X = 0.1; X <= 30; X += 0.01) { const g = Gg(X); if (g > Gpk) { Gpk = g; Xpk = X; } }
    // Limiting flux = local minimum of total flux Gt beyond the gravity-flux peak (independent of X0)
    let GL = null, XL = null;
    for (let X = Xpk + 0.005; X <= 40; X += 0.005) { const g0 = Gt(X - 0.005), g1 = Gt(X), g2 = Gt(X + 0.005); if (g1 <= g0 && g1 <= g2) { GL = g1; XL = X; break; } }
    // Underflow operating line, through (0, applied) and (Xu, 0), must not cross the descending limb of the gravity flux curve
    let minMargin = Infinity;
    for (let X = Xpk; X <= Xu; X += 0.005) { const m = Gg(X) - (applied - vu * X); if (m < minMargin) minMargin = m; }
    const clarOK = settlingVelocity(X0, SVI, method) > vo;
    const thickOK = minMargin >= 0 && (GL == null || applied <= GL + 1e-9);
    // Maximum MLSS for clarification + thickening at these flows (bisection)
    const okAt = X => {
      if (!(settlingVelocity(X, SVI, method) > vo)) return false;
      const ap = (Q + Qr) * X / A / 24, xu = X * (Q + Qr) / Qr;
      for (let x = Xpk; x <= xu; x += 0.02) if (Gg(x) < ap - vu * x - 1e-9) return false;
      return true;
    };
    let lo = 0.2, hi = 20; if (!okAt(lo)) lo = 0;
    for (let i = 0; i < 40 && lo > 0; i++) { const m = (lo + hi) / 2; if (okAt(m)) lo = m; else hi = m; }
    // curve for plotting
    const curve = []; for (let X = 0.25; X <= 16; X += 0.25) curve.push([X, Gg(X)]);
    return { vo, vu, applied, Xu, GL, XL, Gpk, Xpk, clarOK, thickOK, minMargin, maxMLSS: lo, Vs0: settlingVelocity(X0, SVI, method), curve, rasNote: 'RAS held at the average-flow rate' };
  }

  /**
   * Clarifier design / check.
   * inp: { duty, criteriaSet, mode:'design'|'check', Q (avg, total m3/d), PF, n, shape:'circular'|'rectangular', LW, SWD, sorDesign, slrDesign,
   *        dia, L, W (check mode), weirLength (per unit, optional), weirFactor (rect: weir length = factor × width),
   *        MLSS (mg/L), R or Xr, SVI, oneOut (bool) }
   */
  function clarifier(inp) {
    const duty = inp.duty || 'primary';
    const sets = CLARIFIER_CRITERIA[duty];
    const setKey = sets[inp.criteriaSet] ? inp.criteriaSet : Object.keys(sets)[0];
    const crit = sets[setKey];
    const secondary = duty.startsWith('secondary');
    const water = duty.startsWith('water');
    const Q = num(inp.Q, 0), PF = num(inp.PF, 2.5), n = Math.round(num(inp.n, 2));
    if (!(Q > 0) || !(n >= 1)) return { error: 'Flow and number of units must be at least 1', checks: [errRow('Inputs', 'Flow must be > 0 and number of units ≥ 1')], notes: [] };
    const Qp = Q * PF;
    const MLSS = num(inp.MLSS, 3000), X0 = MLSS / 1000;
    let R = num(inp.R, null);
    const Xr = num(inp.Xr, 8000);
    if (secondary && (R == null)) R = Xr > MLSS ? MLSS / (Xr - MLSS) : null;
    if (secondary && !(R > 0)) return { error: 'Return sludge concentration must exceed MLSS (or enter R > 0)', checks: [errRow('RAS', 'Return sludge concentration must exceed MLSS, or enter a recycle ratio R > 0')], notes: [] };
    const nOutD = inp.oneOut ? Math.max(1, n - 1) : n;
    let Aunit, dia = null, L = null, W = null, notes = [];
    if (inp.mode === 'check') {
      if (inp.shape === 'rectangular') { L = num(inp.L, 0); W = num(inp.W, 0); Aunit = L * W; }
      else { dia = num(inp.dia, 0); Aunit = Math.PI * dia * dia / 4; }
    } else {
      const sor = num(inp.sorDesign, crit.sorAvg ? (crit.sorAvg[0] != null ? (crit.sorAvg[0] + crit.sorAvg[1]) / 2 : crit.sorAvg[1] * 0.85) : 30);
      let Areq = Q / sor;
      notes.push(`Area from overflow rate: ${r(Areq, 1)} m² total`);
      if (secondary) {
        const slr = num(inp.slrDesign, crit.slrAvg ? crit.slrAvg[1] * 0.85 : 5);
        const Aslr = (1 + R) * Q * X0 / (slr * 24);
        notes.push(`Area from solids loading: ${r(Aslr, 1)} m² total`);
        if (Aslr > Areq) Areq = Aslr;
      }
      if (inp.sizeForPeak !== false) {
        if (crit.sorPeak && crit.sorPeak[1]) { const Ap = Q * PF / crit.sorPeak[1] * n / nOutD; notes.push(`Area for peak overflow ≤ ${crit.sorPeak[1]}: ${r(Ap, 1)} m² total`); if (Ap > Areq) Areq = Ap; }
        if (secondary && crit.slrPeak && crit.slrPeak[1]) { const Ap = (Q * PF + R * Q) * X0 / (crit.slrPeak[1] * 24) * n / nOutD; notes.push(`Area for peak solids loading ≤ ${crit.slrPeak[1]}: ${r(Ap, 1)} m² total`); if (Ap > Areq) Areq = Ap; }
      }
      Aunit = Areq / n;
      if (inp.shape === 'rectangular') {
        const LW = num(inp.LW, 4); W = Math.sqrt(Aunit / LW); L = LW * W;
      } else dia = Math.sqrt(4 * Aunit / Math.PI);
      if (inp.roundUp !== false && dia) { dia = Math.ceil(dia * 2) / 2; Aunit = Math.PI * dia * dia / 4; }
    }
    const SWD = num(inp.SWD, secondary ? 4.5 : 4.0);
    const Atot = Aunit * n, Vunit = Aunit * SWD;
    const nOut = inp.oneOut ? Math.max(1, n - 1) : n;
    const Aop = Aunit * nOut;
    const weirUnit = num(inp.weirLength, 0) > 0 ? +inp.weirLength : (dia ? Math.PI * (dia - 2 * num(inp.launderSetback, 0)) : null);
    if (!weirUnit) notes.push('Enter the weir (launder) length per unit to check weir loading');
    const res = {
      duty, setKey, critLabel: crit.label, n, nOut, Aunit, Atot, dia, L, W, SWD, Vunit,
      sorAvg: Q / Atot, sorPeak: Qp / Aop, hrtAvg: Vunit * n / Q * 24, hrtPeak: Vunit * nOut / Qp * 24,
      weirAvg: weirUnit > 0 ? Q / (weirUnit * n) : null, weirPeak: weirUnit > 0 ? Qp / (weirUnit * nOut) : null, weirUnit, notes, R, Qp,
    };
    const checks = [];
    const src = crit.label;
    if (crit.sorAvg) checks.push(check('Overflow rate at average flow', res.sorAvg, 'm³/m²·d', crit.sorAvg, src));
    if (crit.sorPeak) checks.push(check(`Overflow rate at peak flow${inp.oneOut && n > 1 ? ', one unit out' : ''}`, res.sorPeak, 'm³/m²·d', crit.sorPeak, src));
    if (crit.hrt) checks.push(check('Detention time at average flow', res.hrtAvg, 'h', crit.hrt, src, { soft: !water }));
    if (!secondary && !water) checks.push(check('Detention time at peak flow', res.hrtPeak, 'h', [0.9, null], 'Qasim Ex. 9.21 (≥ 0.9 h typical)', { soft: true }));
    if (crit.weir && res.weirAvg != null) checks.push(check('Weir loading at average flow', res.weirAvg, 'm³/m·d', crit.weir, src, { soft: true }));
    if (crit.swd) checks.push(check('Side water depth', SWD, 'm', crit.swd, src, { soft: true }));
    if (water && crit.vh && L) {
      const vh = Q / (W * SWD * n) / 1440; // m/min
      res.vh = vh; checks.push(check('Horizontal velocity', vh, 'm/min', crit.vh, src));
    }
    if (inp.shape === 'rectangular' && L && W) checks.push(check('Length : width', L / W, '–', water ? [2, null] : [3, 6], water ? 'Ten States: ≥ 2:1' : 'Qasim Ex. 9.21 (4:1 typical)', { soft: true }));
    if (n < 2) checks.push(check('Number of units', n, 'no.', [2, null], 'Allow one unit out of service (Ten States)', { soft: true }));
    if (secondary) {
      const Qr = R * Q / n, Qu = Q / n;
      res.slrAvg = (1 + R) * Q * X0 / (Atot * 24);
      res.slrPeak = (Qp + R * Q) * X0 / (Aop * 24);
      if (crit.slrAvg) checks.push(check('Solids loading at average flow', res.slrAvg, 'kg/m²·h', crit.slrAvg, src));
      if (crit.slrPeak) checks.push(check(`Solids loading at peak flow${inp.oneOut && n > 1 ? ', one unit out' : ''}`, res.slrPeak, 'kg/m²·h', crit.slrPeak, src));
      if (num(inp.SVI, 0) > 0) {
        res.rasNote = 'RAS flow held at the average-flow rate at peak';
        const spAvg = statePoint({ Q: Qu, Qr, A: Aunit, X0, SVI: +inp.SVI, method: inp.svMethod });
        const spPeak = statePoint({ Q: Qp / nOut, Qr: R * Q / nOut, A: Aunit, X0, SVI: +inp.SVI, method: inp.svMethod });
        res.statePoint = { avg: spAvg, peak: spPeak };
        checks.push({ item: 'State point, average flow', value: spAvg.applied <= spAvg.GL && spAvg.clarOK ? 'within limits' : 'overloaded', unit: '', range: [null, null], source: 'M&E Sec. 8-10 (Eq. 8-86 settling)', status: (spAvg.thickOK && spAvg.clarOK) ? 'pass' : 'fail', note: `Applied ${r(spAvg.applied, 2)} vs limiting ${r(spAvg.GL, 2)} kg/m²·h; max MLSS ≈ ${r(spAvg.maxMLSS * 1000, -1)} mg/L` });
        checks.push({ item: 'State point, peak flow', value: spPeak.applied <= spPeak.GL && spPeak.clarOK ? 'within limits' : 'overloaded', unit: '', range: [null, null], source: 'M&E Sec. 8-10 (Eq. 8-86 settling)', status: (spPeak.thickOK && spPeak.clarOK) ? 'pass' : 'fail', note: `Applied ${r(spPeak.applied, 2)} vs limiting ${r(spPeak.GL, 2)} kg/m²·h; max MLSS ≈ ${r(spPeak.maxMLSS * 1000, -1)} mg/L` });
        checks.push(check('SVI', +inp.SVI, 'mL/g', [null, 150], 'M&E: < 120 desired; > 150 bulking', { soft: true }));
      }
    }
    // Primary performance estimate, M&E Sec. 5-6 empirical removal curve R = t/(a + b·t)
    if (duty.startsWith('primary')) {
      const t = res.hrtAvg;
      res.removalBOD = 100 * t / (0.018 + 0.020 * t);
      res.removalTSS = 100 * t / (0.0075 + 0.014 * t);
    }
    res.checks = checks;
    res.error = null;
    return res;
  }

  // ---------------------------------------------------------------- 4. CHEMICAL DOSING & STORAGE
  const CHEMICALS = {
    FeCl3_40: { name: 'Ferric chloride 40%', active: 'FeCl3', strength: 0.40, density: 1.42, mw: 162.2, metal: { el: 'Fe', mw: 55.85, n: 1, mwPO4: 150.8, mwOH3: 106.9 }, alkPerMg: 0.925, sludgePerMg: 0.66, coagSludgePerMg: 1.0 },
    alum_48: { name: 'Liquid alum 48% (Al2(SO4)3·14H2O)', active: 'Al2(SO4)3·14H2O', strength: 0.48, density: 1.33, mw: 594.4, metal: { el: 'Al', mw: 26.98, n: 2, mwPO4: 121.95, mwOH3: 78.0 }, alkPerMg: 0.505, sludgePerMg: 0.26, coagSludgePerMg: 0.44 },
    NaOCl_125: { name: 'Sodium hypochlorite, 12.5% trade (125 g/L available Cl2)', active: 'Cl2', strength: 0.104, density: 1.20, mw: 70.9, note: 'Trade % is weight per volume; 125 g/L ÷ 1.20 kg/L = 10.4% by weight. Strength decays in storage.' },
    NaOH_50: { name: 'Caustic soda 50%', active: 'NaOH', strength: 0.50, density: 1.52, mw: 40.0, alkSupply: 1.25 },
    H2SO4_98: { name: 'Sulphuric acid 98%', active: 'H2SO4', strength: 0.98, density: 1.84, mw: 98.1, alkSupply: -1.02 },
    lime: { name: 'Hydrated lime (dry, 90% Ca(OH)2)', active: 'Ca(OH)2', strength: 0.90, density: null, mw: 74.1, alkSupply: 1.35 },
    NaHCO3: { name: 'Sodium bicarbonate (dry)', active: 'NaHCO3', strength: 1.0, density: null, mw: 84.0, alkSupply: 0.595 },
    urea: { name: 'Urea (dry, 46% N)', active: 'N', strength: 0.46, density: null, mw: 60.06 },
    H3PO4_75: { name: 'Phosphoric acid 75%', active: 'P', strength: 0.75 * 30.97 / 98.0, density: 1.58, mw: 98.0 },
    polymer: { name: 'Polymer solution 0.25%', active: 'polymer', strength: 0.0025, density: 1.0 },
    custom: { name: 'Custom chemical', active: 'active', strength: 1, density: 1 },
  };

  /**
   * inp: { chem, custom:{strength,density}, Qmin, Qavg, Qmax (m3/d), doseMin, doseAvg, doseMax (mg/L as active),
   *        storageDays, nTanks, bundPct, nPumps, pumpMaxLh (optional), hoursPerDay }
   */
  function chemicalDosing(inp) {
    const c = Object.assign({}, CHEMICALS[inp.chem || 'FeCl3_40']);
    if (inp.chem === 'custom' || inp.strength) { if (num(inp.strength, 0) > 0) c.strength = +inp.strength; if (num(inp.density, 0) > 0) c.density = +inp.density; }
    const hrs = num(inp.hoursPerDay, 24);
    const cases = ['min', 'avg', 'max'].map(kk => {
      const Q = num(inp['Q' + kk], num(inp.Qavg, 0)), dose = num(inp['dose' + kk[0].toUpperCase() + kk.slice(1)], num(inp.doseAvg, 0));
      const active = Q * dose / 1000; // kg/d
      const product = active / c.strength; // kg/d
      const Lh = c.density ? product / c.density / hrs : null;
      return { case: kk, Q, dose, active, product, Lh, Ld: c.density ? product / c.density : null };
    });
    const avg = cases[1];
    const days = num(inp.storageDays, 30);
    const storeM3 = c.density ? avg.product / c.density * days / 1000 : null;
    const storeKg = avg.product * days;
    const nT = Math.max(1, Math.round(num(inp.nTanks, 2)));
    const bund = storeM3 != null ? storeM3 / nT * num(inp.bundPct, 110) / 100 : null;
    const turndown = cases[0].Lh && cases[2].Lh ? cases[2].Lh / cases[0].Lh : null;
    const checks = [
      check('Storage at average use', days, 'd', [15, 30], 'Common practice 15–30 d (Ten States: ≥ 30 d supply typical for many chemicals)', { soft: true }),
      check('Dosing range max/min', turndown, ':1', [null, 10], 'Single metering pump turndown typically ≤ 10:1; above that use two pump sizes or VFD + stroke', { soft: true }),
      check('Bund (secondary containment)', num(inp.bundPct, 110), '% of largest tank', [110, null], '110% common (UK/EU); 125% per Qasim Ex. 9.28', { soft: true }),
    ];
    if (num(inp.pumpMaxLh, 0) > 0) {
      checks.push(check('Pump capacity vs max dose', +inp.pumpMaxLh / cases[2].Lh, '× needed', [1.1, null], 'Size pump ≥ 110% of max dose', { hard: true }));
      checks.push(check('Pump at min dose', 100 * cases[0].Lh / +inp.pumpMaxLh, '% of capacity', [10, null], 'Keep above ~10% of pump capacity for accuracy', { soft: true }));
    }
    return { chemical: c, cases, storeM3, storeKg, perTankM3: storeM3 != null ? storeM3 / nT : null, bund, turndown, checks };
  }

  /** Metal salt dose for chemical P removal. inp: { Q, P (mg/L as P to remove), molarRatio, chem } */
  function phosphorusDose(inp) {
    const c = CHEMICALS[inp.chem || 'FeCl3_40'];
    const P = num(inp.P, 0), mr = num(inp.molarRatio, 1.9);
    const metalMgL = P * mr * c.metal.mw / 30.97; // mg/L as metal
    const activeMgL = metalMgL / (c.metal.mw * c.metal.n) * c.mw; // mg/L as active salt
    const dosing = chemicalDosing(Object.assign({}, inp, { chem: inp.chem, doseMin: activeMgL, doseAvg: activeMgL, doseMax: activeMgL, Qmin: inp.Q, Qavg: inp.Q, Qmax: inp.Q }));
    const LperKgP = dosing.cases[1].Ld / (num(inp.Q, 0) * P / 1000);
    const checks = [check('Metal : P molar ratio', mr, 'mol/mol', [1.0, 3.5], 'M&E 1–3; Qasim Fe(III):P 1.5–3.5, Al:P 1–2.5', { soft: true })];
    const molP = P / 30.97, molM = mr * molP; // mmol/L
    const sludgeMgL = molP * c.metal.mwPO4 + Math.max(0, molM - molP) * c.metal.mwOH3; // metal phosphate + hydroxide from excess metal (M&E Sec. 6-4)
    return { metalMgL, activeMgL, alkUsed: activeMgL * (c.alkPerMg || 0), sludgeMgL, sludgeKgD: sludgeMgL * num(inp.Q, 0) / 1000, LperKgP, dosing, checks };
  }

  /** Nutrient supplement for BOD:N:P = 100:5:1 (industrial). inp: { Q, BOD, N, P, ratio:{N,P} } */
  function nutrientDose(inp) {
    const Q = num(inp.Q, 0), BOD = num(inp.BOD, 0);
    const rN = num(inp.ratioN, 5), rP = num(inp.ratioP, 1);
    const Nreq = BOD * rN / 100, Preq = BOD * rP / 100;
    const Nadd = Math.max(0, Nreq - num(inp.N, 0)), Padd = Math.max(0, Preq - num(inp.P, 0));
    return {
      Nreq, Preq, Nadd, Padd,
      ureaKgD: Q * Nadd / 1000 / CHEMICALS.urea.strength,
      h3po4LD: Q * Padd / 1000 / CHEMICALS.H3PO4_75.strength / CHEMICALS.H3PO4_75.density,
      checks: [info('N to add', Nadd, 'mg/L'), info('P to add', Padd, 'mg/L')],
    };
  }

  /** Coagulant: alkalinity consumed and chemical sludge (water treatment). inp: { Q, chem, dose (mg/L as product active), alkRaw, alkResidual, turbidity, ssFactor } */
  function coagulant(inp) {
    const c = CHEMICALS[inp.chem || 'alum_48'];
    const dose = num(inp.dose, 30), Q = num(inp.Q, 0);
    const alkUsed = dose * (c.alkPerMg || 0);
    const alkLeft = num(inp.alkRaw, 100) - alkUsed;
    const alkAdd = Math.max(0, num(inp.alkResidual, 30) - alkLeft);
    const limeMgL = alkAdd / 1.35; // mg/L Ca(OH)2 per mg/L as CaCO3 (74.1/50 inverse)
    const ss = num(inp.turbidity, 10) * num(inp.ssFactor, 1.5);
    const sludgeKgD = Q * (dose * (c.coagSludgePerMg || c.sludgePerMg || 0) + ss) / 1000; // AWWA/Cornwell: 0.44 × alum dose; 2.9 × Fe (≈1.0 × FeCl3)
    return {
      alkUsed, alkLeft, alkAdd, limeMgL, limeKgD: Q * limeMgL / 1000 / CHEMICALS.lime.strength, sludgeKgD,
      checks: [
        check('Alkalinity remaining after coagulant', alkLeft, 'mg/L as CaCO3', [num(inp.alkResidual, 30), null], 'Keep residual ≥ 20–30 mg/L for floc formation (AWWA practice)', { soft: true }),
        info('Sludge solids (dry)', sludgeKgD, 'kg/d', 'Hydroxide + raw SS (SS ≈ factor × NTU)'),
      ],
    };
  }

  /** Neutralisation (strong acid/base): inp: { Q, acidity or alkalinity to neutralise (mg/L as CaCO3), chem } */
  function neutralisation(inp) {
    const c = CHEMICALS[inp.chem || 'NaOH_50'];
    if (!c.alkSupply) return { error: 'Choose an acid or alkali reagent', checks: [errRow('Reagent', 'This chemical has no neutralising capacity defined')] };
    const eq = num(inp.demand, 0); // mg/L as CaCO3
    const activeMgL = Math.abs(eq) / Math.abs(c.alkSupply || 1);
    const d = chemicalDosing(Object.assign({}, inp, { doseMin: activeMgL, doseAvg: activeMgL, doseMax: activeMgL, Qmin: inp.Q, Qavg: inp.Q, Qmax: inp.Q }));
    return { activeMgL, dosing: d, checks: [info('Stoichiometric dose', activeMgL, 'mg/L as ' + c.active, 'Buffered streams need a titration curve; treat as a minimum')] };
  }

  // ---------------------------------------------------------------- 5. DISINFECTION
  // EPA SWTR Guidance Manual / 40 CFR 141.74 Table: CT for 3-log Giardia by free chlorine (mg·min/L)
  // Rows: chlorine 0.4..3.0 step 0.2; Cols: pH 6.0,6.5,...,9.0. Two independent copies (Oregon OHA, Maine CDC) agree,
  // including the irregular 0.5 °C, 2.2 mg/L, pH 7.5 value of 297 as published.
  const CT_GIARDIA_FC = {
    temps: [0.5, 5, 10, 15, 20, 25],
    cl: [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0],
    ph: [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0],
    t: {
      0.5: [[137,163,195,237,277,329,390],[141,168,200,239,286,342,407],[145,172,205,246,295,354,422],[148,176,210,253,304,365,437],[152,180,215,259,313,376,451],[155,184,221,266,321,387,464],[157,189,226,273,329,397,477],[162,193,231,279,338,407,489],[165,197,236,286,346,417,500],[169,201,242,297,353,426,511],[172,205,247,298,361,435,522],[175,209,252,304,368,444,533],[178,213,257,310,375,452,543],[181,217,261,316,382,460,552]],
      5: [[97,117,139,166,198,236,279],[100,120,143,171,204,244,291],[103,122,146,175,210,252,301],[105,125,149,179,216,260,312],[107,127,152,183,221,267,320],[109,130,155,187,227,274,329],[111,132,158,192,232,281,337],[114,135,162,196,238,287,345],[116,138,165,200,243,294,353],[118,140,169,204,248,300,361],[120,143,172,209,253,306,368],[122,146,175,213,258,312,375],[124,148,178,217,263,318,382],[126,151,182,221,268,324,389]],
      10: [[73,88,104,125,149,177,209],[75,90,107,128,153,183,218],[78,92,110,131,158,189,226],[79,94,112,134,162,195,234],[80,95,114,137,166,200,240],[82,98,116,140,170,206,247],[83,99,119,144,174,211,253],[86,101,122,147,179,215,259],[87,104,124,150,182,221,265],[89,105,127,153,186,225,271],[90,107,129,157,190,230,276],[92,110,131,160,194,234,281],[93,111,134,163,197,239,287],[95,113,137,166,201,243,292]],
      15: [[49,59,70,83,99,118,140],[50,60,72,86,102,122,146],[52,61,73,88,105,126,151],[53,63,75,90,108,130,156],[54,64,76,92,111,134,160],[55,65,78,94,114,137,165],[56,66,79,96,116,141,169],[57,68,81,98,119,144,173],[58,69,83,100,122,147,177],[59,70,85,102,124,150,181],[60,72,86,105,127,153,184],[61,73,88,107,129,156,188],[62,74,89,109,132,159,191],[63,76,91,111,134,162,195]],
      20: [[36,44,52,62,74,89,105],[38,45,54,64,77,92,109],[39,46,55,66,79,95,113],[39,47,56,67,81,98,117],[40,48,57,69,83,100,120],[41,49,58,70,85,103,123],[42,50,59,72,87,105,126],[43,51,61,74,89,108,129],[44,52,62,75,91,110,132],[44,53,63,77,93,113,135],[45,54,65,78,95,115,138],[46,55,66,80,97,117,141],[47,56,67,81,99,119,143],[47,57,68,83,101,122,146]],
      25: [[24,29,35,42,50,59,70],[25,30,36,43,51,61,73],[26,31,37,44,53,63,75],[26,31,37,45,54,65,78],[27,32,38,46,55,67,80],[27,33,39,47,57,69,82],[28,33,40,48,58,70,84],[29,34,41,49,60,72,86],[29,35,41,50,61,74,88],[30,35,42,51,62,75,90],[30,36,43,52,63,77,92],[31,37,44,53,65,78,94],[31,37,45,54,66,80,96],[32,38,46,55,67,81,97]],
    },
  };
  // Virus inactivation by free chlorine, pH 6–9 (EPA SWTR Guidance Manual Appendix E; to verify against primary text)
  const CT_VIRUS_FC = { temps: [0.5, 5, 10, 15, 20, 25], log2: [6, 4, 3, 2, 1, 1], log3: [9, 6, 4, 3, 2, 1], log4: [12, 8, 6, 4, 3, 2] };
  // LT2 UV dose tables, mJ/cm2 (40 CFR 141.720(d)(1))
  const UV_LT2 = {
    logs: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
    crypto: [1.6, 2.5, 3.9, 5.8, 8.5, 12, 15, 22],
    giardia: [1.5, 2.1, 3.0, 5.2, 7.7, 11, 15, 22],
    virus: [39, 58, 79, 100, 121, 143, 163, 186],
  };

  function interp1(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
  }

  /** CT required for Giardia by free chlorine. method 'table-interp' | 'table-conservative' | 'regression'. */
  function ctGiardiaFreeCl({ T, pH, C, logs = 3, method = 'table-interp' }) {
    let warning = null;
    if (method !== 'regression' && (C > 3.0 || pH > 9.0)) { warning = 'Chlorine above 3.0 mg/L or pH above 9 is outside the EPA tables; regression used'; method = 'regression'; }
    if (T < 0.5) warning = (warning ? warning + '; ' : '') + 'Temperature below 0.5 °C: 0.5 °C table used (may understate CT)';
    if (method === 'regression') {
      // Smith et al. (1995) regression adopted by EPA; check: T=10.3, C=0.8, pH=7.4, 0.5-log → 21.27 (NC DEQ CT guide)
      const ct = T < 12.5 ? (0.353 * logs) * (12.006 + Math.exp(2.46 - 0.073 * T + 0.125 * C + 0.389 * pH))
        : (0.361 * logs) * (-2.216 + Math.exp(2.69 - 0.065 * T + 0.111 * C + 0.361 * pH));
      return { ct, method, warning };
    }
    const tb = CT_GIARDIA_FC;
    const lookup = (temp) => {
      const tab = tb.t[temp];
      if (method === 'table-conservative') {
        const ci = tb.cl.findIndex(x => x >= C - 1e-9); const pi = tb.ph.findIndex(x => x >= pH - 1e-9);
        const row = tab[ci < 0 ? tab.length - 1 : ci]; return row[pi < 0 ? row.length - 1 : pi];
      }
      const colVals = tab.map(row => interp1(tb.ph, row, clamp(pH, 6, 9)));
      return interp1(tb.cl, colVals, clamp(C, 0.4, 3.0));
    };
    let ct3;
    if (method === 'table-conservative') {
      // EPA rule: use the lower temperature table
      const tt = tb.temps.filter(x => x <= Math.max(T, 0.5)).pop();
      ct3 = lookup(tt);
    } else {
      const vals = tb.temps.map(tt => lookup(tt));
      ct3 = interp1(tb.temps, vals, clamp(T, 0.5, 25));
    }
    return { ct: ct3 * logs / 3, ct3, method, warning };
  }

  function ctVirusFreeCl({ T, logs = 4 }) {
    if (!(logs > 0)) return { ct: 0, key: 'none' };
    const key = logs <= 2 ? 'log2' : logs <= 3 ? 'log3' : 'log4';
    const base = interp1(CT_VIRUS_FC.temps, CT_VIRUS_FC[key], clamp(T, 0.5, 25));
    return { ct: base, key };
  }

  /**
   * Drinking-water CT and contact tank. inp: { Qpeak (m3/d), volume (m3) | dims, minLevelFraction, BF, C (mg/L residual at outlet), T, pH,
   *   giardiaLogs, virusLogs, method, designMode: 'check'|'size' }
   */
  function disinfectionCT(inp) {
    const Qp = num(inp.Qpeak, 0), BF = num(inp.BF, 0.5), C = num(inp.C, 1.0), T = num(inp.T, 10), pH = num(inp.pH, 7.5);
    if (!(Qp > 0) || !(C > 0) || !(BF > 0)) return { error: 'Peak flow, chlorine residual and baffle factor must be greater than zero', checks: [errRow('Inputs', 'Peak flow, chlorine residual and baffle factor must be greater than zero')] };
    const gl = num(inp.giardiaLogs, 0.5), vl = num(inp.virusLogs, 2);
    const req = ctGiardiaFreeCl({ T, pH, C, logs: gl, method: inp.method || 'table-interp' });
    const vir = ctVirusFreeCl({ T, logs: vl });
    const ctReq = Math.max(req.ct, vir.ct);
    let V = num(inp.volume, 0) * num(inp.minLevelFraction, 1);
    const QpMin = Qp / 1440; // peak flow, m3/min
    let res = { error: null };
    if (inp.designMode === 'size') {
      const T10req = ctReq / C; // min
      V = T10req / BF * QpMin; // m3 at min operating level
      res.volumeRequired = V;
      res.volumeTotal = V / num(inp.minLevelFraction, 1);
    }
    if (!(V > 0)) return { error: 'Enter the tank volume', checks: [errRow('Volume', 'Tank volume must be greater than zero')] };
    const HDT = V / QpMin; // min
    const T10 = HDT * BF;
    const CTcalc = C * T10;
    const ratioG = CTcalc / req.ct, ratioV = CTcalc / vir.ct;
    const checks = [
      check('CT ratio, Giardia (CTcalc / CTreq)', ratioG, '–', [1, null], `EPA SWTR tables; ${gl}-log Giardia`, { hard: true }),
      check('CT ratio, viruses', ratioV, '–', [1, null], `EPA virus CT (free chlorine, pH 6–9); ${vl}-log`, { hard: true }),
      check('Baffle factor used', BF, '–', [0.1, 0.7], 'EPA Table 4-2: 0.1 unbaffled … 0.7 superior; 1.0 only for pipelines; confirm by tracer test', { soft: true }),
      check('Free chlorine residual', C, 'mg/L', [0.2, 4.0], 'WHO ≥ 0.5 after 30 min at pH < 8 (target); EPA MRDL 4.0', { soft: true }),
      check('pH for chlorination', pH, '–', [6, 8], 'CT rises sharply above pH 8 (EPA tables)', { soft: true }),
    ];
    if (req.warning) checks.push({ item: 'CT table range', value: 'outside', unit: '', range: [null, null], source: 'EPA SWTR tables', status: 'warn', note: req.warning });
    if (vl > 4) checks.push({ item: 'Virus log target', value: vl, unit: 'log', range: [null, 4], source: 'EPA table stops at 4-log', status: 'warn', note: '4-log CT used' });
    return Object.assign(res, { warning: req.warning, Qp, V, HDT, T10, CTcalc, ctReqGiardia: req.ct, ctReq3: req.ct3, ctReqVirus: vir.ct, ctReq, ratioG, ratioV, checks });
  }

  /** UV dose lookup (LT2). */
  function uvDose({ target = 'crypto', logs = 2 }) {
    const warning = logs > 4 ? 'LT2 tables stop at 4-log; value shown is the 4-log dose' : null;
    return { dose: interp1(UV_LT2.logs, UV_LT2[target], logs), warning };
  }

  /**
   * Wastewater effluent chlorination. inp: { Qavg, Qpeak, volume, BF, demand, residual, product ('NaOCl_125'), dechlor (bool), limitResidual, criteria 'TS'|'ME'|'CA' }
   */
  function effluentChlorination(inp) {
    const Qa = num(inp.Qavg, 0), Qp = num(inp.Qpeak, Qa * 2.5), V = num(inp.volume, 0);
    if (!(Qa > 0) || !(V > 0)) return { error: 'Flow and contact volume must be greater than zero', checks: [errRow('Inputs', 'Flow and contact volume must be greater than zero')] };
    const tPeak = V / (Qp / 1440), tAvg = V / (Qa / 1440);
    const modal = tPeak * num(inp.BF, 0.7);
    const dose = num(inp.demand, 8) + num(inp.residual, 1);
    const cl2KgD = Qa * dose / 1000, cl2KgDpeak = Qp * dose / 1000;
    const c = CHEMICALS[inp.product || 'NaOCl_125'];
    const prodLd = cl2KgD / c.strength / c.density;
    const sbsRatio = num(inp.sbsRatio, 1.6); // theoretical 1.46 mg NaHSO3/mg Cl2; 1.5–1.7 in practice
    const sbsKgD = inp.dechlor ? Qa * num(inp.residual, 1) * sbsRatio / 1000 : 0;
    const CT = num(inp.residual, 1) * modal;
    const checks = [
      check('Contact time at peak flow', tPeak, 'min', [15, null], 'Ten States 2014: ≥ 15 min at peak hourly flow', { hard: true }),
      check('Contact time at average flow', tAvg, 'min', [30, 120], 'M&E: mean contact 30–120 min typical', { soft: true }),
      check('Applied chlorine dose', dose, 'mg/L', [4, 40], 'Qasim App. E: 4–40 mg/L', { soft: true }),
    ];
    if (inp.reuse) {
      checks.push(check('CT for reuse', CT, 'mg·min/L', [450, null], 'California Title 22: CT ≥ 450 mg·min/L', { hard: true, note: 'Modal time approximated as baffle factor × detention; confirm by tracer test' }));
      checks.push(check('Modal contact time for reuse', modal, 'min', [90, null], 'California Title 22: ≥ 90 min modal time at peak dry-weather flow', { hard: true }));
    }
    if (num(inp.limitResidual, null) != null) checks.push(check('Residual at discharge vs limit', inp.dechlor ? 0 : num(inp.residual, 1), 'mg/L', [null, +inp.limitResidual], 'Selected effluent standard (e.g. SA GN 665: 0.25 mg/L)', { hard: true, note: inp.dechlor ? 'Assumes full dechlorination' : 'Consider dechlorination' }));
    return { error: null, tPeak, tAvg, modal, dose, cl2KgD, cl2KgDpeak, prodLd, sbsKgD, sbsRatio, CT, checks };
  }

  // ---------------------------------------------------------------- summary helpers
  function summarise(checks) {
    const s = { pass: 0, warn: 0, fail: 0, info: 0 };
    for (const c of checks || []) s[c.status] = (s[c.status] || 0) + 1;
    s.overall = s.fail ? 'fail' : s.warn ? 'warn' : 'pass';
    return s;
  }

  return {
    VERSION, r, num, check, stats, doSat, pressureRatio, waterViscosity,
    PF_METHODS, designBasis, waterDemand, STANDARDS, compliance,
    KINETICS_DEFAULT, AS_CRITERIA, activatedSludge, activatedSludgeCheck, aeration,
    CLARIFIER_CRITERIA, settlingVelocity, statePoint, clarifier,
    CHEMICALS, chemicalDosing, phosphorusDose, nutrientDose, coagulant, neutralisation,
    CT_GIARDIA_FC, CT_VIRUS_FC, UV_LT2, ctGiardiaFreeCl, ctVirusFreeCl, disinfectionCT, uvDose, effluentChlorination,
    summarise,
  };
});
