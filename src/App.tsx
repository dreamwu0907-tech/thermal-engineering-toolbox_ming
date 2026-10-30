import { useMemo, useState } from "react";

type NumInputProps = {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  step?: number;
};

function NumInput({ label, value, unit, onChange, step = 1 }: NumInputProps) {
  return <label className="field">
    <span>{label}</span>
    <div className="input-wrap">
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(Number(e.target.value))} />
      <small>{unit}</small>
    </div>
  </label>;
}

export default function App() {
  const [power, setPower] = useState(500);
  const [ambient, setAmbient] = useState(40);
  const [surface, setSurface] = useState(70);
  const [h, setH] = useState(500);
  const [margin, setMargin] = useState(1.25);

  const result = useMemo(() => {
    const deltaT = Math.max(surface - ambient, 0);
    const areaM2 = deltaT > 0 && h > 0 ? power / (h * deltaT) : 0;
    const designArea = areaM2 * margin;
    return {
      deltaT,
      areaCm2: areaM2 * 10000,
      designAreaCm2: designArea * 10000,
      equivalentSide: Math.sqrt(designArea) * 1000,
      rth: power > 0 ? deltaT / power : 0,
    };
  }, [power, ambient, surface, h, margin]);

  const valid = power > 0 && h > 0 && surface > ambient && margin >= 1;

  return <main className="shell">
    <header className="topbar">
      <div className="brand-mark">TE</div>
      <div><p className="eyebrow">ENGINEERING WORKBENCH / 01</p><h1>Thermal Engineering Toolbox</h1></div>
      <span className="version">PRELIMINARY</span>
    </header>

    <section className="intro">
      <div>
        <p className="eyebrow accent">THERMAL DESIGN · QUICK ESTIMATION</p>
        <h2>從熱負載開始，<br />快速估算所需散熱面積。</h2>
        <p className="muted">第一階段工具：以簡化熱對流模型估算散熱面積，協助前期方案比較與尺寸抓估。</p>
      </div>
      <div className="intro-stat"><span>MODULE</span><strong>01</strong><small>Heat transfer area</small></div>
    </section>

    <section className="workspace">
      <div className="panel input-panel">
        <div className="panel-heading"><div><p className="eyebrow">INPUT PARAMETERS</p><h3>設計條件</h3></div><span className="step">01 / 02</span></div>
        <div className="field-grid">
          <NumInput label="熱功耗 Power" value={power} unit="W" onChange={setPower} />
          <NumInput label="環境 / 入口溫度" value={ambient} unit="°C" onChange={setAmbient} />
          <NumInput label="目標散熱表面溫度" value={surface} unit="°C" onChange={setSurface} />
          <NumInput label="等效對流熱傳係數 h" value={h} unit="W/m²·K" onChange={setH} step={10} />
          <NumInput label="設計裕度" value={margin} unit="×" onChange={setMargin} step={0.05} />
        </div>
        <div className="hint"><span className="hint-icon">i</span><span>h 值需依散熱型式、流速、流道與實際邊界條件選定；此處提供初估輸入，不代表固定材料常數。</span></div>
      </div>

      <div className="panel result-panel">
        <div className="panel-heading"><div><p className="eyebrow">CALCULATION OUTPUT</p><h3>估算結果</h3></div><span className="live"><i /> LIVE</span></div>
        {valid ? <>
          <div className="hero-result"><span>建議初估散熱面積</span><div><strong>{result.designAreaCm2.toFixed(1)}</strong><em>cm²</em></div><small>已套用 {margin.toFixed(2)}× 設計裕度</small></div>
          <div className="result-grid">
            <div><span>理論需求面積</span><strong>{result.areaCm2.toFixed(1)} <small>cm²</small></strong></div>
            <div><span>等效正方形邊長</span><strong>{result.equivalentSide.toFixed(1)} <small>mm</small></strong></div>
            <div><span>可用溫差 ΔT</span><strong>{result.deltaT.toFixed(1)} <small>K</small></strong></div>
            <div><span>整體等效熱阻</span><strong>{result.rth.toFixed(4)} <small>K/W</small></strong></div>
          </div>
        </> : <div className="invalid">請確認輸入條件：功耗與 h 必須大於 0，目標表面溫度需高於環境溫度，設計裕度至少為 1。</div>}
      </div>
    </section>

    <section className="panel formula-panel">
      <div className="panel-heading"><div><p className="eyebrow">MODEL & ASSUMPTIONS</p><h3>計算模型與適用範圍</h3></div></div>
      <div className="formula-layout">
        <div className="equation"><span>基本熱對流方程式</span><strong>Q = h · A · ΔT</strong><small>A = Q / (h · ΔT)</small></div>
        <div className="assumptions">
          <p><b>目前模型假設</b></p>
          <ul>
            <li>以穩態、單一等效對流熱傳係數估算。</li>
            <li>忽略輻射、接觸熱阻、材料內部導熱熱阻與熱擴散效應。</li>
            <li>假設輸入的目標溫度可代表有效散熱表面溫度。</li>
            <li>設計裕度僅用於面積初估，不等同完整系統安全係數。</li>
          </ul>
        </div>
      </div>
      <div className="warning"><b>工程提醒</b> 此工具適用於概念設計與初步尺寸估算，不能取代 CFD、熱測試或完整熱阻網路分析。實際冷板設計仍須評估 TIM、底板擴散熱阻、流量分配、壓降與泵浦工作點。</div>
    </section>
    <footer><span>THERMAL ENGINEERING TOOLBOX</span><span>Built for preliminary engineering estimation · v0.1.0</span></footer>
  </main>;
}