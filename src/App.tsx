import { useMemo, useState } from "react";
import LiquidCooling from "./LiquidCooling";

import { useMemo, useState } from "react";

type Material = { label: string; k: number; density: number };
const materials: Record<string, Material> = {
  al6063: { label: "Aluminum 6063", k: 200, density: 2700 },
  al6061: { label: "Aluminum 6061", k: 167, density: 2700 },
  c1100: { label: "Copper C1100", k: 390, density: 8940 },
  custom: { label: "Custom", k: 200, density: 2700 },
};
function NumberField({ label, value, unit, onChange, step = 1 }: { label: string; value: number; unit: string; onChange: (v: number) => void; step?: number }) {
  return <label className="field"><span>{label}</span><div className="input-wrap"><input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))}/><small>{unit}</small></div></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return <label className="field"><span>{label}</span><select className="select-input" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v,t]) => <option value={v} key={v}>{t}</option>)}</select></label>;
}
function AirCooling() {
  const [power,setPower]=useState(500), [tjMax,setTjMax]=useState(85), [tin,setTin]=useState(35);
  const [chipL,setChipL]=useState(40), [chipW,setChipW]=useState(40), [rjc,setRjc]=useState(0.015);
  const [timT,setTimT]=useState(0.1), [timK,setTimK]=useState(5);
  const [mode,setMode]=useState("fixed"), [process,setProcess]=useState("skived");
  const [baseMat,setBaseMat]=useState("c1100"), [finMat,setFinMat]=useState("c1100");
  const [baseT,setBaseT]=useState(5), [length,setLength]=useState(100), [width,setWidth]=useState(100), [height,setHeight]=useState(40);
  const [airMode,setAirMode]=useState("cfm"), [cfm,setCfm]=useState(60), [velocity,setVelocity]=useState(3);
  const [target,setTarget]=useState("balanced"), [maxDrop,setMaxDrop]=useState(30);
  const [model,setModel]=useState("advanced");
  const [customBaseK,setCustomBaseK]=useState(200), [customBaseD,setCustomBaseD]=useState(2700);
  const [customFinK,setCustomFinK]=useState(200), [customFinD,setCustomFinD]=useState(2700);
  const base=materials[baseMat], fin=materials[finMat];
  const baseK=baseMat==="custom"?customBaseK:base.k, baseD=baseMat==="custom"?customBaseD:base.density;
  const finK=finMat==="custom"?customFinK:fin.k, finD=finMat==="custom"?customFinD:fin.density;
  const calc=useMemo(()=>{
    const a=(chipL/1000)*(chipW/1000);
    const rtim=(timT/1000)/(timK*a);
    const rtotal=(tjMax-tin)/power;
    const rsink=rtotal-rjc-rtim;
    return {a,rtim,rtotal,rsink,valid:power>0&&tjMax>tin&&chipL>0&&chipW>0&&timK>0&&rsink>0};
  },[power,tjMax,tin,chipL,chipW,rjc,timT,timK]);
  const valid=calc.valid;
  return <main className="shell">
    <header className="topbar"><div className="brand-mark">TE</div><div><p className="eyebrow">ENGINEERING WORKBENCH / 02</p><h1>Thermal Engineering Toolbox</h1></div><span className="version">PRELIMINARY DESIGN</span></header>
    <section className="intro"><div><p className="eyebrow accent">FORCED AIR · SINGLE HEAT SOURCE</p><h2>從晶片熱負載出發，<br/>建立散熱器初步設計。</h2><p className="muted">單晶片風冷散熱器設計工作台。設定熱源、材料、製程、機構空間與風量條件，建立後續熱性能與幾何最佳化模型。</p></div><div className="intro-stat"><span>DESIGN MODULE</span><strong>02</strong><small>Heatsink preliminary design</small></div></section>
    <div className="section-title"><div><p className="eyebrow">01 / CHIP & THERMAL INPUT</p><h3>晶片與熱條件</h3></div><span className="step">HEAT SOURCE</span></div>
    <section className="panel"><div className="field-grid">
      <NumberField label="晶片功耗 Power" value={power} unit="W" onChange={setPower}/><NumberField label="最高接面溫度 Tj Max" value={tjMax} unit="°C" onChange={setTjMax}/>
      <NumberField label="入口空氣溫度" value={tin} unit="°C" onChange={setTin}/><NumberField label="Rjc（接面至外殼）" value={rjc} unit="K/W" step={0.001} onChange={setRjc}/>
      <NumberField label="晶片長度" value={chipL} unit="mm" onChange={setChipL}/><NumberField label="晶片寬度" value={chipW} unit="mm" onChange={setChipW}/>
      <NumberField label="TIM 厚度" value={timT} unit="mm" step={0.01} onChange={setTimT}/><NumberField label="TIM 導熱係數" value={timK} unit="W/m·K" onChange={setTimK}/>
    </div><div className="hint"><span className="hint-icon">i</span><span>目前以單顆晶片作為熱源。Rjc、TIM 為可調整的初始估值；請優先使用晶片及材料供應商資料。</span></div></section>
    <div className="section-title"><div><p className="eyebrow">02 / HEATSINK CONFIGURATION</p><h3>散熱器設計條件</h3></div><span className="step">GEOMETRY & PROCESS</span></div>
    <section className="workspace">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">DIMENSION MODE</p><h3>尺寸模式</h3></div></div>
        <div className="choice-row"><button className={mode==="fixed"?"choice active":"choice"} onClick={()=>setMode("fixed")}>固定尺寸</button><button className={mode==="auto"?"choice active":"choice"} onClick={()=>setMode("auto")}>自動搜尋</button></div>
        <p className="muted small-note">{mode==="fixed"?"輸入既有系統可用尺寸，後續由模型搜尋鰭片幾何。":"輸入系統最大空間，後續由模型搜尋可行的散熱器外形與鰭片配置。"}</p>
        <div className="field-grid"><NumberField label={mode==="fixed"?"散熱器長度":"最大長度"} value={length} unit="mm" onChange={setLength}/><NumberField label={mode==="fixed"?"散熱器寬度":"最大寬度"} value={width} unit="mm" onChange={setWidth}/><NumberField label={mode==="fixed"?"散熱器高度":"最大高度"} value={height} unit="mm" onChange={setHeight}/><NumberField label="底板厚度" value={baseT} unit="mm" step={0.5} onChange={setBaseT}/></div>
        <div className="subheading">Fin Manufacturing Process</div><SelectField label="鰭片製程" value={process} onChange={setProcess} options={[["extruded","Extruded Fin 擠型"],["skived","Skived Fin 鏟齒"],["bonded","Bonded Fin 焊接／黏合"]]}/>
      </div>
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">MATERIAL DATABASE</p><h3>底板與鰭片材料</h3></div></div>
        <div className="field-grid"><SelectField label="底板材料" value={baseMat} onChange={setBaseMat} options={Object.entries(materials).map(([k,v])=>[k,v.label] as [string,string])}/><SelectField label="鰭片材料" value={finMat} onChange={setFinMat} options={Object.entries(materials).map(([k,v])=>[k,v.label])}/></div>
        <div className="material-stats"><div><span>Base conductivity</span><b>{baseK} <small>W/m·K</small></b><span>Density {baseD.toLocaleString()} kg/m³</span></div><div><span>Fin conductivity</span><b>{finK} <small>W/m·K</small></b><span>Density {finD.toLocaleString()} kg/m³</span></div></div>
        {(baseMat==="custom"||finMat==="custom")&&<div className="field-grid custom-grid">{baseMat==="custom"&&<><NumberField label="自訂底板導熱係數" value={customBaseK} unit="W/m·K" onChange={setCustomBaseK}/><NumberField label="自訂底板密度" value={customBaseD} unit="kg/m³" onChange={setCustomBaseD}/></>}{finMat==="custom"&&<><NumberField label="自訂鰭片導熱係數" value={customFinK} unit="W/m·K" onChange={setCustomFinK}/><NumberField label="自訂鰭片密度" value={customFinD} unit="kg/m³" onChange={setCustomFinD}/></>}</div>}
        <div className="hint"><span className="hint-icon">i</span><span>材料值為初始參考值；實際導熱係數與密度依材料牌號、狀態及溫度確認。Bonded Fin 後續需加入接合界面熱阻。</span></div>
      </div>
    </section>
    <div className="section-title"><div><p className="eyebrow">03 / AIRFLOW & OPTIMIZATION</p><h3>風量與設計目標</h3></div><span className="step">FLOW CONDITIONS</span></div>
    <section className="workspace">
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">AIRFLOW INPUT</p><h3>風量條件</h3></div></div>
        <SelectField label="輸入方式" value={airMode} onChange={setAirMode} options={[["cfm","已知總風量 CFM"],["velocity","已知通道風速"],["auto","風量未知／初步搜尋"]]}/>
        {airMode==="cfm"?<NumberField label="總風量" value={cfm} unit="CFM" onChange={setCfm}/>:airMode==="velocity"?<NumberField label="鰭片通道風速" value={velocity} unit="m/s" step={0.1} onChange={setVelocity}/>:<NumberField label="允許壓降上限" value={maxDrop} unit="Pa" onChange={setMaxDrop}/>}
        <div className="hint"><span className="hint-icon">i</span><span>初版將輸入風量視為實際通過散熱器的流量，暫不納入風扇 P-Q Curve、旁通漏風與流量不均。</span></div>
      </div>
      <div className="panel"><div className="panel-heading"><div><p className="eyebrow">DESIGN OBJECTIVE</p><h3>最佳化方向</h3></div></div>
        <SelectField label="設計目標" value={target} onChange={setTarget} options={[["thermal","Thermal Priority 散熱優先"],["pressure","Low Pressure Drop 低壓降"],["compact","Compact Design 緊湊尺寸"],["light","Lightweight 輕量化"],["balanced","Balanced 平衡設計"]]}/>
        <SelectField label="熱模型" value={model} onChange={setModel} options={[["basic","Basic 等效熱阻模型"],["advanced","Advanced 底板熱擴散模型"]]}/>
        <p className="muted small-note">最佳化將先篩選溫度、尺寸、製程與壓降可行解，再比較不同目標下的 Pareto 方案。</p>
      </div>
    </section>
    <div className="section-title"><div><p className="eyebrow">04 / THERMAL BUDGET</p><h3>初步熱阻預算</h3></div><span className="step">LIVE CALCULATION</span></div>
    <section className="panel result-panel">
      {valid?<><div className="result-grid budget-grid"><div><span>允許總熱阻（Tj Max budget）</span><strong>{calc.rtotal.toFixed(4)} <small>K/W</small></strong></div><div><span>TIM 理想一維熱阻</span><strong>{calc.rtim.toFixed(4)} <small>K/W</small></strong></div><div><span>預留給散熱器的熱阻</span><strong>{calc.rsink.toFixed(4)} <small>K/W</small></strong></div><div><span>晶片接觸面積</span><strong>{(calc.a*1e6).toFixed(0)} <small>mm²</small></strong></div></div><div className="warning"><b>目前計算範圍</b> 此處只計算系統熱阻預算及理想 TIM 導熱熱阻，尚未求解鰭片幾何、對流係數、鰭片效率、出口空氣溫度與壓降，因此不會顯示虛構的 Tj 預測值。</div></>:<div className="invalid">目前輸入條件無法形成正的散熱器熱阻預算。請確認功耗、溫度、晶片尺寸及 TIM 參數；若 Rjc 或 TIM 為未知值，應使用供應商資料或調整為等效熱阻輸入。</div>}
    </section>
    <section className="panel formula-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL ROADMAP</p><h3>計算模型與目前限制</h3></div></div><div className="formula-layout"><div className="equation"><span>允許總熱阻</span><strong>Rtotal = (Tj Max − Tin) / Q</strong><small>Rsink budget = Rtotal − Rjc − RTIM</small></div><div className="assumptions"><p><b>後續計算模組</b></p><ul><li>底板熱擴散：依熱源尺寸、底板厚度與材料導熱係數估算。</li><li>鰭片性能：Fin Efficiency、有效散熱面積與對流熱傳係數。</li><li>流體性能：Re、Nu、通道風速及散熱器壓降。</li><li>自動搜尋：依製程能力與空間限制產生可行幾何，再進行多目標比較。</li><li>輸出：Tj、熱阻、出口空氣溫度、重量、體積與設計裕度。</li></ul></div></div><div className="warning"><b>工程限制</b> 本版本是設計輸入與熱阻預算介面更新，尚非完整熱性能求解器。模型完成前，結果僅供前期規劃，不可取代 CFD、熱測試或風扇系統工作點驗證。</div></section>
    <footer><span>THERMAL ENGINEERING TOOLBOX</span><span>Single-source forced-air design · v0.2.0</span></footer>
  </main>;
}


export default function App() {
  const [module, setModule] = useState<"air" | "liquid">("liquid");
  return <main className="app-root">
    <nav className="module-nav" aria-label="Thermal design modules">
      <button className={module === "liquid" ? "module-tab active" : "module-tab"} onClick={() => setModule("liquid")}>液冷水冷板</button>
      <button className={module === "air" ? "module-tab active" : "module-tab"} onClick={() => setModule("air")}>風冷散熱器</button>
    </nav>
    {module === "liquid" ? <LiquidCooling /> : <AirCooling />}
  </main>;
}

