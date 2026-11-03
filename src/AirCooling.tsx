import { useMemo, useState } from "react";
import "./AirCooling.css";

type Axis = "X" | "Y" | "Z";
type ProcessKey = "al-extrusion" | "al-skiving" | "cu-skiving" | "al-cnc" | "cu-cnc";
type Objective = "thermal" | "pressure" | "compact";
type DfmTier = "Recommended" | "Advanced" | "Not Recommended";
type Material = { label: string; k: number };
type Geometry = { length: number; width: number; height: number; baseT: number; finT: number; gap: number; finCount: number };
type Result = Geometry & {
  finPitch: number; flowLength: number; inletArea: number; openArea: number;
  faceVelocity: number; channelVelocity: number; reynolds: number; h: number;
  eta: number; rjc: number; rtim: number; rbase: number; rfinAir: number;
  rtotal: number; tout: number; tj: number; margin: number; pressure: number;
  volume: number; feasible: boolean; dfm: boolean; dfmTier: DfmTier;
};
const materials: Record<string, Material> = {
  al6063: { label: "Aluminum 6063", k: 200 },
  al6061: { label: "Aluminum 6061", k: 167 },
  c1100: { label: "Copper C1100", k: 390 },
  custom: { label: "Custom", k: 200 },
};
const processes: Record<ProcessKey, { label: string; minT: number; maxT: number; minGap: number; maxGap: number; minH: number; maxH: number }> = {
  "al-extrusion": { label: "Aluminum Extrusion", minT: 1.0, maxT: 1.5, minGap: 2.0, maxGap: 4.0, minH: 10, maxH: 50 },
  "al-skiving": { label: "Aluminum Skiving", minT: 0.3, maxT: 0.8, minGap: 0.5, maxGap: 2.0, minH: 10, maxH: 80 },
  "cu-skiving": { label: "Copper Skiving", minT: 0.2, maxT: 0.6, minGap: 0.4, maxGap: 1.5, minH: 10, maxH: 50 },
  "al-cnc": { label: "Aluminum CNC", minT: 1.0, maxT: 2.0, minGap: 1.5, maxGap: 3.0, minH: 5, maxH: 30 },
  "cu-cnc": { label: "Copper CNC", minT: 1.0, maxT: 2.0, minGap: 1.5, maxGap: 3.0, minH: 5, maxH: 30 },
};
const air = { rho: 1.18, cp: 1006, mu: 1.85e-5, k: 0.0263, pr: 0.71 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const unique = (xs: number[]) => [...new Set(xs.map(x => Math.round(x * 1000) / 1000))];
const fmt = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : "—";

function Field({ label, value, unit, onChange, step = 1, min = 0, disabled = false }: {
  label: string; value: number; unit: string; onChange: (v: number) => void; step?: number; min?: number; disabled?: boolean;
}) {
  return <label className="ac-field"><span>{label}</span><div className={"ac-input" + (disabled ? " is-disabled" : "")}><input type="number" min={min} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))}/><small>{unit}</small></div></label>;
}
function Choice({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  return <label className="ac-field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <label className="ac-toggle"><span>{label}</span><button type="button" className={value ? "on" : ""} onClick={() => onChange(!value)}>{value ? "AUTO" : "MANUAL"}</button></label>;
}

function evaluate(g: Geometry, p: {
  axis: Axis; power: number; tjMax: number; tin: number; cfm: number; lfm: number;
  airMode: "cfm" | "lfm"; rjc: number; rtim: number; dieL: number; dieW: number;
  baseK: number; finK: number; process: ProcessKey;
}): Result | null {
  const dims = { X: g.length, Y: g.width, Z: g.height };
  const flowLength = dims[p.axis];
  const crossAxes = (["X", "Y", "Z"] as Axis[]).filter(a => a !== p.axis);
  const finHeightAxis: Axis = p.axis === "Z" ? "X" : "Z";
  const finWidthAxis: Axis = crossAxes.find(a => a !== finHeightAxis) || "Y";
  const finHeight = dims[finHeightAxis];
  const finWidth = dims[finWidthAxis];
  const inletArea = crossAxes.reduce((a, axis) => a * dims[axis], 1) / 1e6;
  if ([flowLength, finHeight, finWidth, inletArea, p.power, p.baseK, p.finK, p.dieL, p.dieW].some(v => !(v > 0))) return null;
  const q = p.airMode === "cfm" ? p.cfm * 0.00047194745 : (p.lfm * 0.00508) * inletArea;
  if (!(q > 0)) return null;
  const faceVelocity = q / inletArea;
  const openWidth = (finWidth - g.finCount * g.finT) / 1000;
  const openArea = openWidth * (finHeight / 1000);
  if (!(openWidth > 0 && openArea > 0 && g.finCount >= 1 && g.gap > 0 && g.finT > 0)) return null;
  const channelVelocity = q / openArea;
  const gapM = g.gap / 1000, heightM = finHeight / 1000, lengthM = flowLength / 1000;
  const dh = 2 * gapM * heightM / (gapM + heightM);
  const reynolds = air.rho * channelVelocity * dh / air.mu;
  const nu = reynolds < 2300 ? 3.66 : 0.023 * Math.pow(reynolds, 0.8) * Math.pow(air.pr, 0.4);
  const h = nu * air.k / dh;
  const finTM = g.finT / 1000;
  const m = Math.sqrt((2 * h) / (p.finK * finTM));
  const eta = m * heightM > 0 ? Math.tanh(m * heightM) / (m * heightM) : 1;
  const finArea = 2 * g.finCount * lengthM * heightM;
  const exposedBaseArea = Math.max(0, lengthM * openWidth);
  const effectiveArea = eta * finArea + exposedBaseArea;
  const rfinAir = 1 / Math.max(h * effectiveArea, 1e-9);
  const dieArea = p.dieL * p.dieW / 1e6;
  const baseTM = g.baseT / 1000;
  const spreadL = Math.min(g.length, p.dieL + 2 * g.baseT);
  const spreadW = Math.min(g.width, p.dieW + 2 * g.baseT);
  const spreadArea = Math.max(dieArea, spreadL * spreadW / 1e6);
  const rbase = baseTM / (p.baseK * spreadArea);
  const massFlow = air.rho * q;
  const tout = p.tin + p.power / (massFlow * air.cp);
  const meanAir = (p.tin + tout) / 2;
  const rtotal = p.rjc + p.rtim + rbase + rfinAir;
  const tj = meanAir + p.power * rtotal;
  const f = reynolds < 2300 ? 64 / Math.max(reynolds, 1) : 0.3164 / Math.pow(reynolds, 0.25);
  const pressure = (f * (lengthM / dh) + 2.5) * (air.rho * channelVelocity * channelVelocity / 2);
  const proc = processes[p.process];
  const recommended = g.finT >= proc.minT && g.finT <= proc.maxT && g.gap >= proc.minGap && g.gap <= proc.maxGap && finHeight >= proc.minH && finHeight <= proc.maxH;
  const advanced = g.finT >= proc.minT * 0.7 && g.finT <= proc.maxT * 1.3 && g.gap >= proc.minGap * 0.7 && g.gap <= proc.maxGap * 1.3 && finHeight >= proc.minH * 0.7 && finHeight <= proc.maxH * 1.3;
  const dfmTier: DfmTier = recommended ? "Recommended" : advanced ? "Advanced" : "Not Recommended";
  const dfm = recommended;
  return {
    ...g, finPitch: g.finT + g.gap, flowLength, inletArea, openArea, faceVelocity,
    channelVelocity, reynolds, h, eta, rjc: p.rjc, rtim: p.rtim, rbase, rfinAir,
    rtotal, tout, tj, margin: p.tjMax - tj, pressure, volume: g.length * g.width * g.height,
    feasible: tj <= p.tjMax, dfm, dfmTier,
  };
}

function makeCandidates(base: Geometry, auto: Record<string, boolean>, proc: ProcessKey, constrained: boolean, envelope: Geometry, axis: Axis): Geometry[] {
  const rule = processes[proc];
  const tValues = auto.finT ? unique([rule.minT, (rule.minT + rule.maxT) / 2, rule.maxT]) : [base.finT];
  const gapValues = auto.gap ? unique([rule.minGap, (rule.minGap + rule.maxGap) / 2, rule.maxGap]) : [base.gap];
  const baseFinHeight = axis === "Z" ? base.length : base.height;
  const hValues = auto.height ? unique([rule.minH, clamp(baseFinHeight, rule.minH, rule.maxH), rule.maxH]) : [baseFinHeight];
  const bValues = auto.baseT ? [2, 3, 5, 8, 10] : [base.baseT];
  const lValues = axis === "Z" && auto.height ? hValues : auto.length && axis !== "Z" ? (constrained ? unique([0.6, 0.8, 1].map(f => envelope.length * f)) : [70, 90, 110, 130, 150]) : [base.length];
  const wValues = auto.width ? (constrained ? unique([0.6, 0.8, 1].map(f => envelope.width * f)) : [70, 90, 110, 130, 150]) : [base.width];
  const out: Geometry[] = [];
  for (const length of lValues) for (const width of wValues) for (const height of (axis === "Z" ? [base.height] : hValues))
  for (const baseT of bValues) for (const finT of tValues) for (const gap of gapValues) {
    if (constrained && (length > envelope.length || width > envelope.width || height > envelope.height)) continue;
    const candidateFinHeight = axis === "Z" ? length : height;
    if (candidateFinHeight < rule.minH || candidateFinHeight > rule.maxH || finT < rule.minT || finT > rule.maxT || gap < rule.minGap || gap > rule.maxGap) continue;
    const finArrayWidth = axis === "Y" ? length : width;
    const count = auto.finCount ? Math.max(1, Math.floor((finArrayWidth + gap) / (finT + gap))) : base.finCount;
    if (count * finT >= finArrayWidth) continue;
    out.push({ length, width, height, baseT, finT, gap, finCount: count });
  }
  return out;
}
function SectionDrawing({ result, axis }: { result: Result; axis: Axis }) {
  const count = Math.max(1, result.finCount);
  const svgW = 320, svgH = 150, pad = 24;
  const innerW = svgW - pad * 2, innerH = svgH - pad * 2;
  const faceWidth = axis === "Y" ? result.length : result.width;
  const faceHeight = axis === "Z" ? result.length : result.height;
  const finW = Math.max(0.8, innerW * (result.finT / faceWidth));
  const gapW = innerW * (result.gap / faceWidth);
  const total = count * finW + (count - 1) * gapW;
  const start = pad + (innerW - total) / 2;
  const openAreaMm2 = result.openArea * 1e6;
  return <div className="ac-drawing-wrap">
    <svg viewBox={"0 0 " + svgW + " " + svgH} role="img" aria-label="散熱器入口截面示意圖">
      <rect x={pad} y={pad} width={innerW} height={innerH} rx="3" fill="#172832" stroke="#8da1aa" strokeWidth="1.5"/>
      {Array.from({ length: count }, (_, i) => <rect key={i} x={start + i * (finW + gapW)} y={pad + 4} width={finW} height={innerH - 8} fill="#b8ef6b" opacity=".9"/>)}
      {Array.from({ length: 5 }, (_, i) => <g key={i} stroke="#83b9ca" strokeWidth="1.5" fill="none"><path d={"M " + (pad + 7 + i * (innerW / 5)) + " 8 v 10 m -4 -4 l 4 4 l 4 -4"}/></g>)}
      <path d={"M " + (pad + innerW / 2) + " 5 V 20"} stroke="#83b9ca" strokeWidth="1.5"/>
      <text x={svgW / 2} y={svgH - 5} textAnchor="middle" fill="#9aabb3" fontSize="9">{"Airflow direction: " + axis}</text>
    </svg>
    <div className="ac-drawing-legend"><span><i className="ac-fin-key"/> Fin</span><span><i className="ac-gap-key"/> Fin Gap</span><span>入口截面非實際比例渲染</span></div>
    <div className="ac-drawing-dimensions"><span>Inlet Face {fmt(faceWidth, 1)} × {fmt(faceHeight, 1)} mm</span><span>Fin T {fmt(result.finT, 2)} mm</span><span>Gap {fmt(result.gap, 2)} mm</span><span>Fin Qty {result.finCount}</span><span>Open Flow Area {fmt(openAreaMm2, 1)} mm²</span></div>
  </div>;
}
export default function AirCooling() {
  const [mode, setMode] = useState<"forward" | "inverse">("forward");
  const [objective, setObjective] = useState<Objective>("thermal");
  const [envelopeMode, setEnvelopeMode] = useState<"limited" | "open">("limited");
  const [axis, setAxis] = useState<Axis>("X");
  const [power, setPower] = useState(500), [tjMax, setTjMax] = useState(85), [tin, setTin] = useState(35);
  const [dieL, setDieL] = useState(40), [dieW, setDieW] = useState(40), [pkgL, setPkgL] = useState(60), [pkgW, setPkgW] = useState(60);
  const [rjc, setRjc] = useState(0.015), [rtim, setRtim] = useState(0.02);
  const [length, setLength] = useState(100), [width, setWidth] = useState(100), [height, setHeight] = useState(40);
  const [baseT, setBaseT] = useState(5), [finT, setFinT] = useState(0.4), [gap, setGap] = useState(0.8), [finCount, setFinCount] = useState(70);
  const [autoT, setAutoT] = useState(true), [autoGap, setAutoGap] = useState(true), [autoHeight, setAutoHeight] = useState(true);
  const [autoBase, setAutoBase] = useState(false), [autoCount, setAutoCount] = useState(true), [autoLength, setAutoLength] = useState(true), [autoWidth, setAutoWidth] = useState(true);
  const [process, setProcess] = useState<ProcessKey>("cu-skiving");
  const [baseMat, setBaseMat] = useState("c1100"), [finMat, setFinMat] = useState("c1100");
  const [baseCustomK, setBaseCustomK] = useState(200), [finCustomK, setFinCustomK] = useState(200);
  const [airMode, setAirMode] = useState<"cfm" | "lfm">("cfm"), [cfm, setCfm] = useState(60), [lfm, setLfm] = useState(1300);
  const [maxL, setMaxL] = useState(140), [maxW, setMaxW] = useState(140), [maxH, setMaxH] = useState(60);

  const baseK = baseMat === "custom" ? baseCustomK : materials[baseMat].k;
  const finK = finMat === "custom" ? finCustomK : materials[finMat].k;
  const geometry: Geometry = { length, width, height, baseT, finT, gap, finCount };
  const envelope: Geometry = { length: maxL, width: maxW, height: maxH, baseT, finT, gap, finCount };
  const inputParams = { axis, power, tjMax, tin, cfm, lfm, airMode, rjc, rtim, dieL, dieW, baseK, finK, process };
  const result = useMemo(() => evaluate(geometry, inputParams), [length, width, height, baseT, finT, gap, finCount, axis, power, tjMax, tin, cfm, lfm, airMode, rjc, rtim, dieL, dieW, baseK, finK, process]);
  const candidates = useMemo(() => {
    if (mode !== "inverse") return [];
    const auto = { finT: autoT, gap: autoGap, height: autoHeight, baseT: autoBase, finCount: autoCount, length: autoLength, width: autoWidth };
    return makeCandidates(geometry, auto, process, envelopeMode === "limited", envelope, axis);
  }, [mode, length, width, height, baseT, finT, gap, finCount, autoT, autoGap, autoHeight, autoBase, autoCount, autoLength, autoWidth, process, envelopeMode, maxL, maxW, maxH, axis]);
  const evaluated = useMemo(() => candidates.map(g => evaluate(g, inputParams)).filter((r): r is Result => !!r && r.dfm), [candidates, axis, power, tjMax, tin, cfm, lfm, airMode, rjc, rtim, dieL, dieW, baseK, finK, process]);
  const ranked = useMemo(() => {
    const pool = evaluated.filter(r => r.feasible);
    const source = pool.length ? pool : evaluated;
    const thermal = [...source].sort((a, b) => a.tj - b.tj)[0];
    const pressure = [...source].sort((a, b) => a.pressure - b.pressure)[0];
    const compact = [...source].sort((a, b) => a.volume - b.volume)[0];
    const preferred = objective === "thermal" ? thermal : compact;
    const ordered = [preferred, pressure, objective === "thermal" ? compact : thermal];
    return ordered.filter((r, i, arr): r is Result => !!r && arr.findIndex(x => x && x.length === r.length && x.width === r.width && x.height === r.height && x.finT === r.finT && x.gap === r.gap && x.baseT === r.baseT) === i);
  }, [evaluated, objective]);
  const shown = mode === "inverse" ? ranked : (result ? [result] : []);
  const selected = shown[0];
  const status = (r: Result) => r.margin < 0 ? "FAIL" : r.margin < 3 ? "MARGINAL" : "PASS";
  const valid = !!result && power > 0 && tjMax > tin && dieL > 0 && dieW > 0 && pkgL >= dieL && pkgW >= dieW && rjc >= 0 && rtim >= 0;
  const procRule = processes[process];
  const inletArea = axis === "X" ? width * height : axis === "Y" ? length * height : length * width;
  const faceVelocity = airMode === "cfm" ? (cfm * 0.00047194745) / (inletArea / 1e6) : lfm * 0.00508;

  return <main className="ac-shell">
    <header className="ac-header"><div><p className="ac-kicker">THERMAL ENGINEERING TOOLBOX / AIR COOLING</p><h1>風冷散熱器設計工作台</h1><p>固定幾何性能評估與依熱需求反向搜尋散熱器設計。</p></div><span className="ac-version">PRELIMINARY<br/>DESIGN / AIR</span></header>

    <section className="ac-modebar">
      <button className={mode === "forward" ? "active" : ""} onClick={() => setMode("forward")}><b>A</b><span>Forward Analysis<small>固定幾何性能評估</small></span></button>
      <button className={mode === "inverse" ? "active" : ""} onClick={() => setMode("inverse")}><b>B</b><span>Inverse Design<small>依熱需求自動搜尋幾何</small></span></button>
    </section>

    <section className="ac-section">
      <div className="ac-section-title"><div><small>01 / CHIP & THERMAL INPUT</small><h2>晶片與熱條件</h2></div><span>THERMAL PATH</span></div>
      <div className="ac-card">
        <div className="ac-grid">
          <Field label="晶片功耗 Power" value={power} unit="W" onChange={setPower}/>
          <Field label="最高接面溫度 Tj Max" value={tjMax} unit="°C" onChange={setTjMax}/>
          <Field label="入口空氣溫度 Tin" value={tin} unit="°C" onChange={setTin}/>
          <Field label="Rjc（Junction-to-Case）" value={rjc} unit="K/W" step={0.001} onChange={setRjc}/>
          <Field label="Die Length" value={dieL} unit="mm" onChange={setDieL}/>
          <Field label="Die Width" value={dieW} unit="mm" onChange={setDieW}/>
          <Field label="Package Length" value={pkgL} unit="mm" onChange={setPkgL}/>
          <Field label="Package Width" value={pkgW} unit="mm" onChange={setPkgW}/>
          <Field label="TIM Thermal Resistance" value={rtim} unit="K/W" step={0.001} onChange={setRtim}/>
        </div>
        <p className="ac-note">Die Size 用於熱源面積與底板熱擴散估算；Package Size 用於封裝幾何檢查。Rjc 與 TIM 熱阻直接輸入，不在此頁反算材料厚度或接觸熱阻。</p>
      </div>
    </section>

    <section className="ac-section">
      <div className="ac-section-title"><div><small>02 / AIRFLOW CONDITIONS</small><h2>風量與入風方向</h2></div><span>ACTUAL HEATSINK FLOW</span></div>
      <div className="ac-card">
        <div className="ac-grid">
          <Choice label="Airflow Input" value={airMode} onChange={v => setAirMode(v as "cfm" | "lfm")} options={[["cfm","總風量 CFM"],["lfm","面風速 LFM"]]}/>
          {airMode === "cfm" ? <Field label="實際通過散熱器風量" value={cfm} unit="CFM" onChange={setCfm} step={1}/> : <Field label="散熱器面風速" value={lfm} unit="LFM" onChange={setLfm} step={10}/>}
          <Choice label="入風方向" value={axis} onChange={v => setAxis(v as Axis)} options={[["X","X Direction"],["Y","Y Direction"],["Z","Z Direction"]]}/>
          <div className="ac-readout"><span>Inlet Face Area</span><b>{fmt(inletArea, 1)} <small>mm²</small></b></div>
          <div className="ac-readout"><span>Face Velocity</span><b>{fmt(faceVelocity, 2)} <small>m/s</small></b></div>
        </div>
        <p className="ac-note">風量視為實際通過散熱器的流量；CFM 依入風截面積計算面風速，LFM 依入風截面積換算 CFM。第一版不含風扇 P-Q Curve、旁通漏風與流量不均。</p>
      </div>
    </section>

    <section className="ac-section">
      <div className="ac-section-title"><div><small>03 / HEATSINK GEOMETRY</small><h2>散熱器幾何與製程</h2></div><span>MANUAL / AUTO</span></div>
      <div className="ac-card">
        {mode === "inverse" && <div className="ac-subpanel">
          <Choice label="空間設定" value={envelopeMode} onChange={v => setEnvelopeMode(v as "limited" | "open")} options={[["limited","有空間限制"],["open","無空間限制／理論搜尋"]]}/>
          {envelopeMode === "limited" && <div className="ac-grid ac-envelope">
            <Field label="Maximum Length" value={maxL} unit="mm" onChange={setMaxL}/>
            <Field label="Maximum Width" value={maxW} unit="mm" onChange={setMaxW}/>
            <Field label="Maximum Height" value={maxH} unit="mm" onChange={setMaxH}/>
          </div>}
          <Choice label="最佳化目標" value={objective} onChange={v => setObjective(v as Objective)} options={[["thermal","A · 達標／散熱性能優先"],["compact","B · 符合 Tj 下最小尺寸"]]}/>
          <p className="ac-note">有空間限制時在 Envelope 內搜尋；無限制時先以 70–150 mm 的長寬候選範圍進行初步搜尋，並非無界搜尋。</p>
        </div>}
        <div className="ac-grid">
          <Field label={axis === "Z" ? "Fin Height (X axis)" : (mode === "inverse" ? "Length / Max Length" : "Heatsink Length")} value={length} unit="mm" onChange={setLength} disabled={mode === "inverse" && (axis === "Z" ? autoHeight : autoLength)}/>
          <Field label={mode === "inverse" ? "Width / Max Width" : "Heatsink Width"} value={width} unit="mm" onChange={setWidth} disabled={mode === "inverse" && autoWidth}/>
          <Field label={axis === "Z" ? "Flow Length (Z axis)" : "Fin Height / Heatsink Height"} value={height} unit="mm" onChange={setHeight} disabled={mode === "inverse" && axis !== "Z" && autoHeight}/>
          <Choice label="Fin Manufacturing Process" value={process} onChange={v => setProcess(v as ProcessKey)} options={Object.entries(processes).map(([k, v]) => [k, v.label]) as [string, string][]}/>
        </div>
        <div className="ac-process-rule"><b>DFM 候選區間</b><span>Fin T {procRule.minT}–{procRule.maxT} mm</span><span>Gap {procRule.minGap}–{procRule.maxGap} mm</span><span>Height {procRule.minH}–{procRule.maxH} mm</span></div>
        <div className="ac-subtitle">Fin Geometry Control</div>
        <div className="ac-geometry-grid">
          <div>{mode === "inverse" && <Toggle label="Fin Thickness" value={autoT} onChange={setAutoT}/>}<Field label="Fin Thickness" value={finT} unit="mm" step={0.05} onChange={setFinT} disabled={mode === "inverse" && autoT}/></div>
          <div>{mode === "inverse" && <Toggle label="Fin Gap" value={autoGap} onChange={setAutoGap}/>}<Field label="Fin Gap" value={gap} unit="mm" step={0.05} onChange={setGap} disabled={mode === "inverse" && autoGap}/></div>
          <div>{mode === "inverse" && <Toggle label="Fin Height" value={autoHeight} onChange={setAutoHeight}/>}<span className="ac-auto-caption">{mode === "inverse" && autoHeight ? "Height selected by search" : "Set in overall dimensions"}</span></div>
          <div>{mode === "inverse" && <Toggle label="Fin Quantity" value={autoCount} onChange={setAutoCount}/>}<Field label="Fin Quantity" value={finCount} unit="pcs" onChange={setFinCount} disabled={mode === "inverse" && autoCount}/></div>
          <div>{mode === "inverse" && <Toggle label="Base Thickness" value={autoBase} onChange={setAutoBase}/>}<Field label="Base Thickness" value={baseT} unit="mm" step={0.5} onChange={setBaseT} disabled={mode === "inverse" && autoBase}/></div>
          {mode === "inverse" && <><div>{axis !== "Z" && <Toggle label="Heatsink Length" value={autoLength} onChange={setAutoLength}/>}</div><div><Toggle label="Heatsink Width" value={autoWidth} onChange={setAutoWidth}/></div></>}
        </div>
        <p className="ac-note">Fin Pitch = Fin Thickness + Fin Gap。Fin Quantity 可手動指定或依可用寬度自動計算；自動搜尋僅在所選製程候選 DFM 區間內進行。</p>
      </div>
    </section>

    <section className="ac-section">
      <div className="ac-section-title"><div><small>04 / MATERIAL CONFIGURATION</small><h2>底板與鰭片材料</h2></div><span>INDEPENDENT MATERIALS</span></div>
      <div className="ac-card">
        <div className="ac-grid">
          <Choice label="Base Material" value={baseMat} onChange={setBaseMat} options={Object.entries(materials).map(([k, v]) => [k, v.label]) as [string, string][]}/>
          <Choice label="Fin Material" value={finMat} onChange={setFinMat} options={Object.entries(materials).map(([k, v]) => [k, v.label]) as [string, string][]}/>
          {baseMat === "custom" && <Field label="Base Thermal Conductivity" value={baseCustomK} unit="W/m·K" onChange={setBaseCustomK}/>}
          {finMat === "custom" && <Field label="Fin Thermal Conductivity" value={finCustomK} unit="W/m·K" onChange={setFinCustomK}/>}
        </div>
        <div className="ac-material-readouts"><div><span>Base k</span><b>{baseK} <small>W/m·K</small></b></div><div><span>Fin k</span><b>{finK} <small>W/m·K</small></b></div><div><span>Material Pairing</span><b>{baseMat === finMat ? "Same Material" : "Dissimilar Materials"}</b></div></div>
        <p className="ac-note">Base Material 與 Fin Material 可分開選擇。第一版忽略異材接合介面熱阻，異材組合結果屬理想化估算；材料導熱係數請依實際牌號與溫度更新。</p>
      </div>
    </section>

    <section className="ac-section">
      <div className="ac-section-title"><div><small>05 / PERFORMANCE RESULTS</small><h2>熱性能與壓差結果</h2></div><span>ENGINEERING ESTIMATE</span></div>
      {!valid ? <div className="ac-alert">輸入條件無效。請確認功耗、溫度、Die / Package 尺寸、TIM 熱阻及風量皆合理，且 Package Size 不小於 Die Size。</div> : <>
        <div className="ac-card ac-budget">
          <div className="ac-budget-item"><span>Thermal Budget Rtotal,max（依目前幾何平均空氣溫度）</span><b>{fmt((tjMax - (tin + result!.tout) / 2) / power, 4)} <small>K/W</small></b></div>
          <div className="ac-budget-item"><span>Rjc + R_TIM</span><b>{fmt(rjc + rtim, 4)} <small>K/W</small></b></div>
          <div className="ac-budget-item"><span>Available Heatsink Rth</span><b>{fmt((tjMax - (tin + result!.tout) / 2) / power - rjc - rtim, 4)} <small>K/W</small></b></div>
        </div>
        {mode === "forward" && result && <div className="ac-card">
          <div className="ac-result-head"><div><span>ESTIMATED JUNCTION TEMPERATURE</span><strong>{fmt(result.tj, 1)} °C</strong></div><span className={"ac-status " + (status(result) === "FAIL" ? "fail" : status(result) === "MARGINAL" ? "marginal" : "pass")}>{status(result)}</span></div>
          <div className="ac-kpi-grid">
            <div><span>Thermal Margin</span><b>{fmt(result.margin, 1)} °C</b></div>
            <div><span>Total Thermal Resistance</span><b>{fmt(result.rtotal, 4)} K/W</b></div>
            <div><span>Heatsink Pressure Drop</span><b>{fmt(result.pressure, 1)} Pa</b></div>
            <div><span>Outlet Air Temperature</span><b>{fmt(result.tout, 1)} °C</b></div>
          </div>
          <div className="ac-result-columns">
            <div><h3>Thermal Path Breakdown</h3>{[
              ["Rjc", result.rjc], ["R_TIM", result.rtim], ["R_base", result.rbase], ["R_fin-air", result.rfinAir],
            ].map(([name, value]) => <div className="ac-bar-row" key={String(name)}><span>{name}</span><b>{fmt(Number(value), 4)} K/W</b><i style={{ width: Math.max(2, Number(value) / result.rtotal * 100) + "%" }}/><small>ΔT {fmt(power * Number(value), 1)} °C</small></div>)}</div>
            <div><h3>Inlet Cross Section</h3><SectionDrawing result={result} axis={axis}/><p className="ac-note">入風面 {axis} · Face Velocity {fmt(result.faceVelocity, 2)} m/s · Channel Velocity {fmt(result.channelVelocity, 2)} m/s</p></div>
          </div>
          <div className="ac-geometry-summary"><span>Size {result.length} × {result.width} × {result.height} mm</span><span>Fin {result.finCount} pcs · {result.dfmTier}</span><span>T / Gap / Pitch {result.finT} / {result.gap} / {result.finPitch} mm</span><span>Fin Efficiency {fmt(result.eta * 100, 1)}%</span></div>
        </div>}
        {mode === "inverse" && <div className="ac-scheme-grid">
          {shown.length ? shown.map((r, i) => <article className="ac-card ac-scheme" key={r.length + "-" + r.width + "-" + r.finT + "-" + r.gap + "-" + r.baseT}>
            <div className="ac-scheme-title"><span>SCHEME 0{i + 1}</span><b>{i === 0 ? (objective === "thermal" ? "Thermal Performance" : "Compact Design") : i === 1 ? "Low Pressure Drop" : (objective === "thermal" ? "Compact Design" : "Thermal Performance")}</b></div>
            <div className="ac-scheme-main"><strong>{fmt(r.tj, 1)} °C</strong><span className={"ac-status " + (status(r) === "FAIL" ? "fail" : status(r) === "MARGINAL" ? "marginal" : "pass")}>{status(r)}</span></div>
            <div className="ac-scheme-values"><span>Margin <b>{fmt(r.margin, 1)} °C</b></span><span>Rtotal <b>{fmt(r.rtotal, 4)} K/W</b></span><span>ΔP <b>{fmt(r.pressure, 1)} Pa</b></span><span>Tout <b>{fmt(r.tout, 1)} °C</b></span></div>
            <div className="ac-scheme-thermalpath"><span>Rjc {fmt(r.rjc, 4)}</span><span>R_TIM {fmt(r.rtim, 4)}</span><span>R_base {fmt(r.rbase, 4)}</span><span>R_fin-air {fmt(r.rfinAir, 4)}</span></div>
            <div className="ac-scheme-geometry"><b>{r.length} × {r.width} × {r.height} mm</b><span>Fin {r.finCount} pcs · T {r.finT} mm · Gap {r.gap} mm · Pitch {r.finPitch} mm</span><span>Base {r.baseT} mm · ηfin {fmt(r.eta * 100, 1)}%</span></div>
            <button className="ac-use-scheme" onClick={() => { setLength(r.length); setWidth(r.width); setHeight(r.height); setBaseT(r.baseT); setFinT(r.finT); setGap(r.gap); setFinCount(r.finCount); setMode("forward"); }}>帶入 Forward Analysis</button>
          </article>) : <div className="ac-alert">目前搜尋範圍內沒有可用的幾何候選。請放寬尺寸限制或調整製程與手動參數。</div>}
        </div>}
        {selected && <div className="ac-card ac-result-note"><b>模型假設與限制</b><p>本結果為簡化 1D 熱阻與空氣側壓差估算：以平均空氣溫度計算接面溫度，使用簡化內流道 Nu / Darcy friction factor 關係式；未納入風扇工作點、旁通漏風、流量不均、鰭片入口效應、接觸熱阻分布及 CFD 三維效應。異材底板／鰭片忽略接合界面熱阻。結果應用於前期設計比較，不可取代樣品測試與 CFD 驗證。</p><p>PASS：Tj 低於上限且 Margin ≥ 3°C；MARGINAL：0–3°C；FAIL：超過 Tj Max。壓差只代表散熱器入口至出口，不代表整機系統壓降。未設定壓差硬性門檻，僅供方案比較。</p></div>}
      </>}
    </section>
    <footer className="ac-footer"><span>THERMAL ENGINEERING TOOLBOX</span><span>Forced-air heatsink · preliminary engineering model</span></footer>
  </main>;
}
