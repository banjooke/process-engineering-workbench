/*
 * W&W Engine validation cases — published worked examples with their printed answers.
 * Each case: { id, tool, source, title, run(E) -> {key: computed}, expect: {key: [printed, tol]} , note }
 * tol is a relative tolerance (0.02 = 2 %). Printed answers are reproduced as numbers only.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WWValidation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const GPD_FT_TO_M3_MD = 0.0124193; // 1 gpd/ft = 0.0124193 m3/m·d
  const MGD = 3785.41; // m3/d per mgd
  const FT = 0.3048;

  const cases = [
    // ---------------- properties
    { id: 'P-1', tool: 'Aeration', source: 'M&E 5th ed., Ex. 8-3 / Appendix', title: 'DO saturation and site pressure ratio',
      run: E => ({ Cs20: E.doSat(20), Cs12: E.doSat(12), PbPs500: E.pressureRatio(500, 12) }),
      expect: { Cs20: [9.09, 0.005], Cs12: [10.78, 0.005], PbPs500: [0.94, 0.01] } },

    // ---------------- design basis
    { id: 'DB-1', tool: 'Design Basis', source: 'Qasim & Zhu 2018, Ex. 4.8', title: 'Peak and minimum dry-weather flow, 20,000 people at 380 L/c/d',
      run: E => { const d = E.designBasis({ population: 20000, perCapita: 380, pfMethod: 'harmon', minMethod: 'log48' });
        const pf = k => d.pfTable.find(x => x.key === k).pf;
        return { Qavg: d.flows.Qavg, pfHarmon: pf('harmon'), pfQasim45: pf('qasim45'), pfLog47: pf('log47'), mmin: d.mmin, Qmin: d.flows.Qmin }; },
      expect: { Qavg: [7600, 0.001], pfHarmon: [2.65, 0.01], pfQasim45: [3.03, 0.01], pfLog47: [3.11, 0.01], mmin: [0.32, 0.02], Qmin: [2432, 0.02] } },

    // ---------------- activated sludge
    { id: 'AS-1', tool: 'Activated Sludge', source: 'M&E 5th ed., Ex. 8-3 Part A', title: 'CMAS for BOD removal only, 22,700 m³/d, SRT 5 d, 12 °C',
      run: E => { const a = E.activatedSludge(base83({ mode: 'bod', srtBOD: 5, alpha: 0.50 }));
        return { nbVSS: a.fractions.nbVSS, S: a.S, Pbio: a.Pbio, PxTSS: a.PxTSS, V: a.V, HRT: a.HRT, MLVSS: a.MLVSS, FM: a.FM, VL: a.VL,
          YobsTSSperBOD: a.YobsTSSperBOD, YobsVSSperBOD: a.YobsVSSperBOD, Ro: a.Ro, SOTR: a.aer.SOTR, air: a.aer.airM3min, R: a.R }; },
      note: 'The book prints 0.64 g VSS/g BOD for observed yield; its own figures (0.42 g VSS/g bCOD × 1.6) give 0.67, which is the value checked here.',
      expect: { nbVSS: [20.0, 0.01], S: [0.70, 0.05], Pbio: [1688.5, 0.01], PxTSS: [2667.5, 0.01], V: [4445.7, 0.01], HRT: [4.7, 0.02], MLVSS: [2400, 0.01],
        FM: [0.30, 0.03], VL: [0.71, 0.02], YobsTSSperBOD: [0.84, 0.02], YobsVSSperBOD: [0.67, 0.02], Ro: [111.3, 0.01], SOTR: [343.3, 0.02], air: [60.5, 0.02], R: [0.60, 0.001] } },
    { id: 'AS-2', tool: 'Activated Sludge', source: 'M&E 5th ed., Ex. 8-3 Part B', title: 'CMAS with nitrification to 0.5 mg/L NH4-N, SF 1.5, 12 °C',
      run: E => { const a = E.activatedSludge(base83({ mode: 'nit', SF: 1.5, NeTarget: 0.5, alpha: 0.65 }));
        return { muN: a.kinetics.muN, srtTheo: a.kinetics.srtTheo, SRT: a.SRT, S: a.S, NOx: a.NOx, Pbio: a.Pbio, PxTSS: a.PxTSS, V: a.V, HRT: a.HRT,
          MLVSS: a.MLVSS, FM: a.FM, VL: a.VL, Ro: a.Ro, SOTR: a.aer.SOTR, air: a.aer.airM3min, alkAddKg: a.alkAddKg, NaHCO3: a.NaHCO3, BODe: a.BODe }; },
      expect: { muN: [0.0714, 0.01], srtTheo: [14.0, 0.01], SRT: [21.0, 0.01], S: [0.32, 0.05], NOx: [28.9, 0.01], Pbio: [1050.4, 0.01], PxTSS: [1916.8, 0.01],
        V: [13418, 0.01], HRT: [14.2, 0.01], MLVSS: [2370, 0.01], FM: [0.10, 0.03], VL: [0.24, 0.03], Ro: [275.9, 0.01], SOTR: [654.6, 0.02], air: [115.5, 0.02],
        alkAddKg: [3094, 0.01], NaHCO3: [5197, 0.01], BODe: [10.2, 0.01] } },
    { id: 'AS-3', tool: 'Activated Sludge (check mode)', source: 'Giorgi, Math for WW Operators (AWWA 2009), Grade 2 Q22', title: 'F/M of an existing aeration tank (US units converted)',
      run: E => { const V = 0.785 * (51.4 * FT) ** 2 * (15.8 * FT); const c = E.activatedSludgeCheck({ Q: 2.86 * MGD, V, MLSS: 2870, fv: 1.0, BOD: 296, SRT: 5, TKN: 35 });
        return { FM: c.FM }; },
      expect: { FM: [1.20, 0.01] } },

    // ---------------- clarifiers
    { id: 'CL-1', tool: 'Clarifiers (check mode)', source: 'Qasim & Zhu 2018, Ex. 9.21', title: 'Rectangular primary basin 46.33 × 11.58 m, 4.0 m deep, 19,000 m³/d, PF 2.8',
      run: E => { const c = E.clarifier({ duty: 'primary', criteriaSet: 'Q', mode: 'check', shape: 'rectangular', L: 46.33, W: 11.58, SWD: 4.0, Q: 19000, PF: 2.8, n: 1 });
        return { A: c.Aunit, sorAvg: c.sorAvg, sorPeak: c.sorPeak, hrtAvg: c.hrtAvg, hrtPeak: c.hrtPeak }; },
      expect: { A: [537, 0.002], sorAvg: [35, 0.02], sorPeak: [99, 0.01], hrtAvg: [2.7, 0.02], hrtPeak: [1.0, 0.04] } },
    { id: 'CL-2', tool: 'Clarifiers (design mode)', source: 'Qasim & Zhu 2018, Ex. 10.166', title: 'BNR final clarifiers, 2 × 2,000 m³/d, MLSS 4,000, R 0.6, SOR 24, SLR 5.7',
      run: E => { const c = E.clarifier({ duty: 'secondaryBNR', criteriaSet: 'Q', mode: 'design', shape: 'circular', Q: 4000, PF: 2.8, n: 2, MLSS: 4000, R: 0.6, sorDesign: 24, slrDesign: 5.7, SWD: 4.5, sizeForPeak: false });
        return { dia: c.dia, A: c.Aunit, sorAvg: c.sorAvg, sorPeak: c.sorPeak, slrAvg: c.slrAvg }; },
      expect: { dia: [11.0, 0.001], A: [95.0, 0.005], sorAvg: [21, 0.02], sorPeak: [59, 0.01], slrAvg: [5.6, 0.01] },
      note: 'The book sizes on average-flow criteria and then checks peak; run with peak sizing off to match. With peak sizing on (the app default) the tool enlarges the units.' },
    { id: 'CL-3', tool: 'Clarifiers (design and check)', source: 'M&E 5th ed., Ex. 8-3 Part C', title: 'Secondary clarifiers, 22,700 m³/d, MLSS 3,000, Xr 8,000, SOR 24',
      run: E => { const d = E.clarifier({ duty: 'secondaryAS', criteriaSet: 'ME', mode: 'design', shape: 'circular', Q: 22700, PF: 2.5, n: 3, MLSS: 3000, Xr: 8000, sorDesign: 24, slrDesign: 99, roundUp: false, sizeForPeak: false });
        const c = E.clarifier({ duty: 'secondaryAS', criteriaSet: 'ME', mode: 'check', shape: 'circular', dia: 20, Q: 22700, PF: 2.5, n: 3, MLSS: 3000, Xr: 8000 });
        return { R: d.R, Atot: d.Atot, slrCheck: c.slrAvg }; },
      expect: { R: [0.60, 0.001], Atot: [946, 0.002], slrCheck: [4.82, 0.01] },
      note: 'The book prints 4.9 kg/m²·h for solids loading; its own inputs give 4.82. Sized on average flow as in the book.' },
    { id: 'CL-4', tool: 'Clarifiers (check mode)', source: 'Giorgi, Math for WW Operators (AWWA 2009), Grade 2 Q5', title: 'Weir overflow rate, 0.377 mgd, clarifier radius 35.1 ft',
      run: E => { const c = E.clarifier({ duty: 'primary', criteriaSet: 'ME', mode: 'check', shape: 'circular', dia: 2 * 35.1 * FT, Q: 0.377 * MGD, PF: 2.5, n: 1, SWD: 3.5 });
        return { weirAvg: c.weirAvg }; },
      expect: { weirAvg: [1710 * GPD_FT_TO_M3_MD, 0.01] }, note: 'Giorgi uses π = 3.14; the engine uses π.' },

    // ---------------- chemical dosing
    { id: 'CH-1', tool: 'Chemical Dosing', source: 'Qasim & Zhu 2018, Ex. 9.27', title: 'Alum and ferric chloride for 95% P removal, 3,000 m³/d, 6 mg/L P',
      run: E => { const al = E.phosphorusDose({ Q: 3000, P: 6, molarRatio: 2.0 * 30.97 / 26.98, chem: 'alum_48' });
        const fe = E.phosphorusDose({ Q: 3000, P: 6, molarRatio: 3.1 * 30.97 / 55.85, chem: 'FeCl3_40' });
        return { alumMgL: al.activeMgL, alumKgD: al.dosing.cases[1].active, fecl3MgL: fe.activeMgL, fecl3KgD: fe.dosing.cases[1].active }; },
      expect: { alumMgL: [132, 0.01], alumKgD: [396, 0.01], fecl3MgL: [53.8, 0.01], fecl3KgD: [161, 0.01] },
      note: 'Qasim states dose ratios by weight (Al:P 2.0, Fe:P 3.1); converted to molar here.' },
    { id: 'CH-2', tool: 'Chemical Dosing', source: 'Qasim & Zhu 2018, Ex. 9.28', title: 'Liquid ferric chloride (41%, 1.3 kg/L), 1.9 mol Fe/mol P, 10,000 m³/d, 30-day storage',
      run: E => { const p = E.phosphorusDose({ Q: 10000, P: 6, molarRatio: 1.9, chem: 'FeCl3_40', strength: 0.41, density: 1.3, storageDays: 30, nTanks: 2 });
        return { LperKgP: p.LperKgP, Ld: p.dosing.cases[1].Ld, storeM3: p.dosing.storeM3 }; },
      expect: { LperKgP: [19, 0.03], Ld: [1140, 0.03], storeM3: [34, 0.03] },
      note: 'Qasim rounds to 19 L/kg P; unrounded arithmetic gives 18.7 L/kg P and 1,120 L/d.' },

    // ---------------- disinfection
    { id: 'DS-1', tool: 'Disinfection CT', source: 'EPA 815-R-20-003, Ex. 4-1 and 4-2', title: 'Unbaffled clearwell 40 ft dia × 30 ft, 347 gpm peak, 0.8 mg/L',
      run: E => { const V = Math.PI * (20 * FT) ** 2 * (30 * FT); const d = E.disinfectionCT({ Qpeak: 347 * 3.78541 * 1.44, volume: V, BF: 0.1, C: 0.8, T: 0.5, pH: 6, giardiaLogs: 3, virusLogs: 4 });
        return { T10: d.T10, CTcalc: d.CTcalc }; },
      expect: { T10: [81.3, 0.01], CTcalc: [65.0, 0.01] }, note: 'EPA uses π = 3.14.' },
    { id: 'DS-2', tool: 'Disinfection CT', source: 'EPA 815-R-20-003, Ex. 5-1', title: 'CT99.9 Giardia, free chlorine 0.8 mg/L, 0.5 °C, pH 6.0',
      run: E => ({ ct: E.ctGiardiaFreeCl({ T: 0.5, pH: 6.0, C: 0.8, logs: 3 }).ct }),
      expect: { ct: [145, 0.001] } },
    { id: 'DS-3', tool: 'Disinfection CT', source: 'NC DEQ CT Method Reference Guide, App. C example 2', title: '0.5-log Giardia, 1.2 mg/L, 5 °C, pH 7.5 (table method)',
      run: E => ({ ct: E.ctGiardiaFreeCl({ T: 5, pH: 7.5, C: 1.2, logs: 0.5, method: 'table-conservative' }).ct }),
      expect: { ct: [31, 0.02] }, note: 'Guide rounds 30.5 up to 31.' },
    { id: 'DS-4', tool: 'Disinfection CT', source: 'NC DEQ CT Method Reference Guide, App. C example 4', title: '0.5-log Giardia by regression, 0.8 mg/L, 10.3 °C, pH 7.4',
      run: E => ({ ct: E.ctGiardiaFreeCl({ T: 10.3, pH: 7.4, C: 0.8, logs: 0.5, method: 'regression' }).ct }),
      expect: { ct: [21.27, 0.002] } },
    { id: 'DS-5', tool: 'Disinfection (UV)', source: '40 CFR 141.720(d)', title: 'LT2 UV dose: 3-log Cryptosporidium, 4-log virus',
      run: E => ({ crypto3: E.uvDose({ target: 'crypto', logs: 3 }).dose, virus4: E.uvDose({ target: 'virus', logs: 4 }).dose }),
      expect: { crypto3: [12, 0.001], virus4: [186, 0.001] } },
    // ---------------- robustness: inputs that must be refused, not silently calculated (1 = refused/flagged)
    { id: 'G-1', tool: 'Guards', source: 'Independent review, 14 Oct 2026', title: 'Invalid inputs are refused with a message',
      run: E => {
        const base = { Q: 22700, BOD: 140, sBOD: 70, COD: 300, sCOD: 132, TSS: 70, VSS: 60, TKN: 35, Alk: 140, MLSS: 3000, Xr: 8000 };
        return {
          heteroWashout: E.activatedSludge(Object.assign({}, base, { T: 12, mode: 'bod', srtBOD: 0.3 })).error ? 1 : 0,
          nitWashout: E.activatedSludge(Object.assign({}, base, { T: 5, DO: 0.5, mode: 'nit' })).error ? 1 : 0,
          zeroFlow: E.activatedSludge(Object.assign({}, base, { Q: 0, mode: 'bod' })).error ? 1 : 0,
          rasZero: E.clarifier({ duty: 'secondaryAS', mode: 'design', Q: 10000, n: 2, MLSS: 3000, R: 0, SVI: 120 }).error ? 1 : 0,
          xrBelowMlss: E.clarifier({ duty: 'secondaryAS', mode: 'design', Q: 10000, n: 2, MLSS: 3000, Xr: 2500, SVI: 120 }).error ? 1 : 0,
          doAboveSat: E.aeration({ AOTR: 100, T: 30, DO: 7, elevation: 2000, depth: 4.9, diffHeight: 0.5, alpha: 0.5, beta: 0.95, F: 0.9, SOTE: 0.3, de: 0.4, dwp: 5, pipeLoss: 7, blowerEff: 0.7 }).error ? 1 : 0,
          ctOutsideTable: E.ctGiardiaFreeCl({ T: 10, pH: 9.5, C: 4, logs: 3 }).warning ? 1 : 0,
          checkNoSrt: E.activatedSludgeCheck(Object.assign({}, base, { V: 5000, T: 12 })).error ? 1 : 0,
        };
      },
      expect: { heteroWashout: [1, 0], nitWashout: [1, 0], zeroFlow: [1, 0], rasZero: [1, 0], xrBelowMlss: [1, 0], doAboveSat: [1, 0], ctOutsideTable: [1, 0], checkNoSrt: [1, 0] } },
    { id: 'G-2', tool: 'Design Basis', source: 'Ten States; Qasim Ch. 4', title: 'Peaking applies to domestic flow only, not infiltration',
      run: E => { const d = E.designBasis({ population: 20000, perCapita: 200, infiltration: 4000, pfMethod: 'harmon' }); return { Qpeak: d.flows.Qpeak }; },
      expect: { Qpeak: [4000 * 2.6524758 + 4000, 0.001] } },
  ];

  function base83(extra) {
    return Object.assign({ Q: 22700, BOD: 140, sBOD: 70, COD: 300, sCOD: 132, TSS: 70, VSS: 60, TKN: 35, Alk: 140, bcodRatio: 1.6, T: 12,
      DO: 2.0, MLSS: 3000, nTanks: 3, depth: 4.9, diffHeight: 0.5, elevation: 500, beta: 0.95, F: 0.9, SOTE: 0.35, de: 0.40, Tair: 12, Xr: 8000, TSSe: 10, sBODe: 3, alkResidual: 70 }, extra);
  }

  function runAll(E) {
    const out = [];
    for (const c of cases) {
      let got = {}, err = null;
      try { got = c.run(E); } catch (e) { err = String(e && e.stack || e); }
      const rows = Object.entries(c.expect).map(([k, [exp, tol]]) => {
        const v = got[k];
        const dev = (v == null || !isFinite(v)) ? null : (exp === 0 ? Math.abs(v) : Math.abs(v - exp) / Math.abs(exp));
        return { key: k, expected: exp, computed: v, dev, tol, pass: dev != null && dev <= tol + 1e-12 };
      });
      out.push({ id: c.id, tool: c.tool, source: c.source, title: c.title, note: c.note || '', error: err, rows, pass: !err && rows.every(x => x.pass) });
    }
    return { engineVersion: E.VERSION, total: out.length, passed: out.filter(x => x.pass).length, checks: out.reduce((a, x) => a + x.rows.length, 0), checksPassed: out.reduce((a, x) => a + x.rows.filter(y => y.pass).length, 0), cases: out };
  }

  return { cases, runAll };
});
