import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type FlowResult = {
  flow: number; inlet: number; velocity: number; reynolds: number; h: number; pressure: number;
  outlet: number; tj: number; rTotal: number; feasible: boolean;
};
const copperK = 390;
const frictionFactor = (re:number, aspect:number) => {
  if (re <= 0) return 0;
  if (re < 2300) {
    const a=Math.min(1,Math.max(0,aspect));
    const poiseuille=96*(1-1.3553*a+1.9467*a*a-1.7012*a*a*a+0.9564*a*a*a*a-0.2537*a*a*a*a*a);
    return poiseuille/re;
  }
  return 0.3164/Math.pow(re,0.25);
};
const nusselt = (re:number, pr:number, aspect:number) => {
  if (re < 2300) return 4.36;
  const f = frictionFactor(re,aspect);
  const numerator = (f/8)*(re-1000)*pr;
  const denominator = 1 + 12.7*Math.sqrt(f/8)*(Math.pow(pr,2/3)-1);
  return Math.max(4.36, numerator/Math.max(denominator,0.1));
};
function Field({label,value,unit,onChange,step=1,min=0}:{label:string;value:number;unit:string;onChange:(v:number)=>void;step?:number;min?:number}) {
  return <label className="lc-field"><span>{label}</span><div className="lc-input"><input type="number" min={min} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/><small>{unit}</small></div></label>;
}
function Choice({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:[string,string][]}) {
  return <label className="lc-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
}
function Card({title,kicker,children}:{title:string;kicker:string;children:ReactNode}) {
  return <section className="lc-card"><div className="lc-card-head"><div><small>{kicker}</small><h3>{title}</h3></div></div>{children}</section>;
}
export default function LiquidCooling() {
  const [power,setPower]=useState(500),[chipL,setChipL]=useState(40),[chipW,setChipW]=useState(40),[tjMax,setTjMax]=useState(85),[rjc,setRjc]=useState(0.015);
  const [contactL,setContactL]=useState(40),[contactW,setContactW]=useState(40),[coldContactL,setColdContactL]=useState(50),[coldContactW,setColdContactW]=useState(50),[timT,setTimT]=useState(0.1),[timK,setTimK]=useState(5);
  const [tin,setTin]=useState(40),[tempMode,setTempMode]=useState("fixed"),[tempMin,setTempMin]=useState(30),[tempMax,setTempMax]=useState(45),[tempStep,setTempStep]=useState(5),[flowMin,setFlowMin]=useState(0.5),[flowMax,setFlowMax]=useState(2),[flowStep,setFlowStep]=useState(0.25);
  const [rho,setRho]=useState(997),[cp,setCp]=useState(4180),[mu,setMu]=useState(0.00089),[coolantK,setCoolantK]=useState(0.6);
  const [channelType,setChannelType]=useState("parallel"),[process,setProcess]=useState("cnc");
  const [plateL,setPlateL]=useState(50),[plateW,setPlateW]=useState(50),[baseT,setBaseT]=useState(5),[channelH,setChannelH]=useState(2),[bottomWall,setBottomWall]=useState(1.5);
  const [channelW,setChannelW]=useState(1.5),[finT,setFinT]=useState(0.5),[channelCount,setChannelCount]=useState(20);
  const [systemExtra,setSystemExtra]=useState(30),[objective,setObjective]=useState("balanced"),[optimized,setOptimized]=useState(false);
  const validInputs=power>0&&chipL>0&&chipW>0&&contactL>0&&contactW>0&&coldContactL>0&&coldContactW>0&&timK>0&&rho>0&&cp>0&&mu>0&&coolantK>0&&flowMin>0&&flowMax>=flowMin&&flowStep>0&&tempMin<=tempMax&&tempStep>0&&channelW>0&&channelH>0&&channelCount>=1&&plateL>0&&plateW>0&&baseT>=0&&bottomWall>=0;
  const fitWidth=channelCount*channelW+(channelCount-1)*finT;
  const flowResults=useMemo<FlowResult[]>(()=>{
    if(!validInputs)return [];
    const flowCount=Math.min(100,Math.floor((flowMax-flowMin)/flowStep+1e-8)+1);
    const temperatures=tempMode==="fixed"?[tin]:Array.from({length:Math.min(20,Math.floor((tempMax-tempMin)/tempStep+1e-8)+1)},(_,i)=>tempMin+i*tempStep);
    const results:FlowResult[]=[];
    for(let ti=0;ti<temperatures.length;ti++) for(let i=0;i<flowCount&&results.length<100;i++){
      const flow=flowMin+i*flowStep, inlet=temperatures[ti], q=flow/60000, mass=rho*q, cpVol=mass*cp;
      const branchCount=channelType==="parallel"?channelCount:1;
      const area=channelW/1000*channelH/1000;
      const velocity=q/(branchCount*area);
      const dh=2*(channelW/1000)*(channelH/1000)/((channelW+channelH)/1000);
      const re=rho*velocity*dh/mu, pr=cp*mu/coolantK, aspect=Math.min(channelW,channelH)/Math.max(channelW,channelH);
      const nu=nusselt(re,pr,aspect), h=nu*coolantK/dh;
      const length=channelType==="parallel"?plateL/1000:(channelCount*plateL+(channelCount-1)*plateW)/1000;
      const f=frictionFactor(re,aspect);
      const straight=f*(length/dh)*(rho*velocity*velocity/2);
      const turns=channelType==="serpentine"?Math.max(0,channelCount-1):0;
      const kMinor=2+turns*1.5;
      const pressure=straight+kMinor*(rho*velocity*velocity/2);
      const wetted=branchCount*2*((channelW+channelH)/1000)*(plateL/1000);
      const chipArea=(chipL/1000)*(chipW/1000), contactArea=(contactL/1000)*(contactW/1000);
      const rTim=(timT/1000)/(timK*contactArea);
      const rBase=(baseT/1000)/(copperK*chipArea);
      const rConv=1/Math.max(h*wetted,1e-9);
      const rTotal=rjc+rTim+rBase+rConv;
      const outlet=inlet+power/Math.max(cpVol,1e-9);
      const tj=(inlet+outlet)/2+power*rTotal;
      results.push({flow,inlet,velocity,reynolds:re,h,pressure,outlet,tj,rTotal,feasible:tj<=tjMax});
    }
    return results;
  },[validInputs,flowMin,flowMax,flowStep,tempMode,tempMin,tempMax,tempStep,tin,channelType,channelCount,channelW,channelH,finT,plateL,plateW,rho,cp,mu,coolantK,power,tjMax,chipL,chipW,contactL,contactW,coldContactL,coldContactW,timT,timK,rjc,baseT]);
  const best=flowResults.filter(r=>r.feasible).sort((a,b)=>a.pressure-b.pressure)[0];
  const maxCount=Math.min(100,Math.floor((flowMax-flowMin)/flowStep+1e-8)+1);
  const optimization=useMemo(()=>{
    if(!validInputs)return [];
    const candidates:{w:number;h:number;n:number;flow:FlowResult}[]=[];
    const widths=[channelW*0.75,channelW,channelW*1.25], heights=[channelH*0.75,channelH,channelH*1.25], counts=[Math.max(2,channelCount-2),channelCount,channelCount+2];
    const testFlow=flowMin, testTin=tempMode==="fixed"?tin:tempMin;
    for(const w of widths)for(const h of heights)for(const n of counts){
      if(n*w+(n-1)*finT>plateW)continue;
      const branches=channelType==="parallel"?n:1, area=w/1000*h/1000, v=(testFlow/60000)/(branches*area), dh=2*(w/1000)*(h/1000)/((w+h)/1000);
      const re=rho*v*dh/mu,pr=cp*mu/coolantK,ht=nusselt(re,pr,Math.min(w,h)/Math.max(w,h))*coolantK/dh;
      const len=channelType==="parallel"?plateL/1000:(n*plateL+(n-1)*plateW)/1000;
      const dp=frictionFactor(re,Math.min(w,h)/Math.max(w,h))*(len/dh)*(rho*v*v/2)+(2+(channelType==="serpentine"?Math.max(0,n-1)*1.5:0))*(rho*v*v/2);
      const areaWet=branches*2*((w+h)/1000)*(plateL/1000);
      const rtim=(timT/1000)/(timK*((contactL/1000)*(contactW/1000)));
      const rbase=(baseT/1000)/(copperK*((chipL/1000)*(chipW/1000)));
      const rt=rjc+rtim+rbase+1/Math.max(ht*areaWet,1e-9);
      const out=testTin+power/(rho*(testFlow/60000)*cp);
      const tj=(testTin+out)/2+power*rt;
      candidates.push({w,h,n,flow:{flow:testFlow,inlet:testTin,velocity:v,reynolds:re,h:ht,pressure:dp,tj,outlet:out,rTotal:rt,feasible:tj<=tjMax}});
    }
    const viable=candidates.filter(c=>c.flow.feasible);
    const pool=viable.length?viable:candidates;
    return pool.sort((a,b)=>{
      if(objective==="thermal")return a.flow.tj-b.flow.tj;
      if(objective==="pressure")return a.flow.pressure-b.flow.pressure;
      if(objective==="compact")return a.h-b.h;
      const score=(x:typeof a)=>((x.flow.tj-testTin)/(Math.max(tjMax-testTin,1)))+x.flow.pressure/Math.max(systemExtra*1000,1000);
      return score(a)-score(b);
    }).slice(0,5);
  },[validInputs,channelW,channelH,channelCount,finT,plateW,flowMin,channelType,rho,mu,cp,coolantK,plateL,power,tin,tjMax,timT,timK,contactL,contactW,rjc,baseT,chipL,chipW,objective,systemExtra,tempMode,tin,tempMin]);
  const selected=flowResults.length?flowResults[Math.floor(flowResults.length/2)]:undefined;
  return <main className="lc-shell">
    <header className="lc-hero"><div><p className="lc-eyebrow">THERMAL ENGINEERING TOOLBOX / LIQUID COOLING</p><h1>水冷板初步設計工作台</h1><p>從晶片熱負載、冷板空間與冷卻液物性出發，初步評估流道配置、熱性能與系統壓降需求。</p></div><div className="lc-version">PRELIMINARY<br/>DESIGN / V1</div></header>
    <div className="lc-stage"><span>01</span><div><b>Preliminary Design</b><small>初步設計與流量掃描</small></div><span className="lc-stage-active">CURRENT</span></div>
    <div className="lc-grid">
      <Card title="熱源與接觸條件" kicker="CHIP & THERMAL INPUT"><div className="lc-fields">
        <Field label="晶片功耗" value={power} unit="W" onChange={setPower}/><Field label="Tj Max" value={tjMax} unit="°C" onChange={setTjMax}/>
        <Field label="Chip Length" value={chipL} unit="mm" onChange={setChipL}/><Field label="Chip Width" value={chipW} unit="mm" onChange={setChipW}/>
        <Field label="TIM Contact Length" value={contactL} unit="mm" onChange={setContactL}/><Field label="TIM Contact Width" value={contactW} unit="mm" onChange={setContactW}/><Field label="Cold Plate Contact Length" value={coldContactL} unit="mm" onChange={setColdContactL}/><Field label="Cold Plate Contact Width" value={coldContactW} unit="mm" onChange={setColdContactW}/>
        <Field label="TIM Thickness" value={timT} unit="mm" step={0.01} onChange={setTimT}/><Field label="TIM Conductivity" value={timK} unit="W/m·K" onChange={setTimK}/>
        <Field label="Rjc" value={rjc} unit="K/W" step={0.001} onChange={setRjc}/>
      </div><p className="lc-note">晶片尺寸、TIM 接觸區與冷板加工接觸區分開設定。TIM 熱阻以 TIM 接觸面積估算；若三者不一致，需確認實際接觸與載荷分佈。Rjc、TIM 可先用估值。</p></Card>
      <Card title="冷板幾何與製程" kicker="COLD PLATE GEOMETRY"><div className="lc-fields">
        <Field label="冷板長度" value={plateL} unit="mm" onChange={setPlateL}/><Field label="冷板寬度" value={plateW} unit="mm" onChange={setPlateW}/>
        <Field label="底板厚度（晶片至流道頂部）" value={baseT} unit="mm" step={0.5} onChange={setBaseT}/><Field label="流道高度" value={channelH} unit="mm" step={0.1} onChange={setChannelH}/>
        <Field label="流道底部壁厚" value={bottomWall} unit="mm" step={0.1} onChange={setBottomWall}/><Field label="流道寬度" value={channelW} unit="mm" step={0.1} onChange={setChannelW}/>
        <Field label="鰭片厚度／間隔壁" value={finT} unit="mm" step={0.1} onChange={setFinT}/><Field label="流道數量／蛇形通道數" value={channelCount} unit="channels" onChange={setChannelCount}/>
        <Choice label="流道形式" value={channelType} onChange={setChannelType} options={[["parallel","Parallel 並聯流道"],["serpentine","Serpentine 蛇形流道"]]}/>
        <Choice label="製程" value={process} onChange={setProcess} options={[["cnc","CNC Machining"],["skived","Skived Fin 鏟齒"]]}/>
      </div><div className={fitWidth<=plateW?"lc-fit":"lc-fit warning"}>流道配置寬度估算：{fitWidth.toFixed(1)} mm / 冷板寬度 {plateW} mm · 冷板總厚度估算：{(baseT+channelH+bottomWall).toFixed(1)} mm {fitWidth<=plateW?"· 幾何初步符合":"· 超出冷板寬度，請調整流道數或尺寸"}</div></Card>
      <Card title="冷卻液自訂物性" kicker="COOLANT PROPERTIES"><div className="lc-fields">
        <Choice label="入液溫度模式" value={tempMode} onChange={setTempMode} options={[["fixed","固定入液溫度"],["sweep","入液溫度掃描"]]}/>{tempMode==="fixed"?<Field label="Coolant Inlet Temperature" value={tin} unit="°C" onChange={setTin}/>:<><Field label="最低入液溫度" value={tempMin} unit="°C" onChange={setTempMin}/><Field label="最高入液溫度" value={tempMax} unit="°C" onChange={setTempMax}/><Field label="溫度掃描間距" value={tempStep} unit="°C" onChange={setTempStep}/></>}<Field label="Density" value={rho} unit="kg/m³" onChange={setRho}/>
        <Field label="Specific Heat Cp" value={cp} unit="J/kg·K" onChange={setCp}/><Field label="Dynamic Viscosity μ" value={mu} unit="Pa·s" step={0.00001} onChange={setMu}/>
        <Field label="Thermal Conductivity k" value={coolantK} unit="W/m·K" step={0.01} onChange={setCoolantK}/>
      </div><p className="lc-note">第一版採固定物性。輸入值應對應代表性液溫；溫度相依物性表與內插功能列為後續擴充。</p></Card>
      <Card title="流量掃描設定" kicker="FLOW RATE SWEEP"><div className="lc-fields">
        <Field label="最低流量" value={flowMin} unit="LPM" step={0.1} onChange={setFlowMin}/><Field label="最高流量" value={flowMax} unit="LPM" step={0.1} onChange={setFlowMax}/>
        <Field label="掃描間距" value={flowStep} unit="LPM" step={0.05} onChange={setFlowStep}/><Field label="系統其他元件壓降假設" value={systemExtra} unit="kPa" step={1} onChange={setSystemExtra}/>
      </div><p className="lc-note">入液溫度與流量皆可設定掃描範圍。系統其他元件壓降僅為使用者假設值，冷板壓降與系統總壓降分開呈現。</p></Card>
    </div>
    <Card title="Stage 1｜初步性能評估" kicker="PRELIMINARY PERFORMANCE"><div className="lc-summary">
      <div><small>掃描點數</small><b>{flowResults.length}</b><span>flow conditions</span></div>
      <div><small>最低壓降可行流量</small><b>{best?best.flow.toFixed(2):"—"}</b><span>LPM · Tj ≤ Tj Max</span></div>
      <div><small>中位流量預估 Tj</small><b>{selected?selected.tj.toFixed(1):"—"}</b><span>°C</span></div>
      <div><small>中位流量冷板壓降</small><b>{selected?(selected.pressure/1000).toFixed(2):"—"}</b><span>kPa</span></div>
    </div>
    {flowResults.length>0?<div className="lc-table-wrap"><table className="lc-table"><thead><tr><th>Inlet<br/>°C</th><th>Flow<br/>LPM</th><th>Velocity<br/>m/s</th><th>Re</th><th>h<br/>W/m²K</th><th>ΔP cold plate<br/>kPa</th><th>Tout<br/>°C</th><th>Tj est.<br/>°C</th><th>Status</th></tr></thead><tbody>{flowResults.map((r,i)=><tr key={i}><td>{r.inlet.toFixed(1)}</td><td>{r.flow.toFixed(2)}</td><td>{r.velocity.toFixed(2)}</td><td>{Math.round(r.reynolds)}</td><td>{Math.round(r.h)}</td><td>{(r.pressure/1000).toFixed(2)}</td><td>{r.outlet.toFixed(1)}</td><td>{r.tj.toFixed(1)}</td><td><span className={r.feasible?"lc-pass":"lc-fail"}>{r.feasible?"Within Tj":"Over Tj"}</span></td></tr>)}</tbody></table></div>:<p className="lc-note">請確認輸入值皆為正值，且流量上限大於或等於下限。</p>}
    <div className="lc-warning"><b>模型邊界：</b>目前為初步 1D 估算。蛇形流道以單一路徑及彎道 K 值近似；並聯流道假設支路均勻分流，尚未求解歧管分配。未納入入口/出口實際結構、粗糙度、接觸熱阻分佈、三維熱擴散及 CDU/Pump 曲線。Tj 是含假設 Rjc、TIM 與簡化底板導熱的趨勢估算，不是 CFD 或實測值。</div>
    </Card>
    <div className="lc-stage"><span>02</span><div><b>Design Optimization</b><small>尺寸搜尋與方案比較</small></div><span className="lc-stage-active">BETA</span></div>
    <Card title="尺寸優化" kicker="PARAMETRIC DESIGN SEARCH"><div className="lc-opt-head"><Choice label="優化目標" value={objective} onChange={v=>{setObjective(v);setOptimized(true)}} options={[["balanced","Balanced 平衡熱性能與壓降"],["thermal","Thermal Priority 熱性能優先"],["pressure","Low Pressure Drop 低壓降優先"],["compact","Compact Design 緊湊尺寸"]]}/><button className="lc-primary" onClick={()=>setOptimized(true)}>執行尺寸搜尋</button></div>
      <p className="lc-note">以目前幾何為中心，掃描流道寬、高及數量的鄰近組合；先篩選 Tj，再依所選目標排序。搜尋流量採最低掃描流量，方便檢查低流量下的設計風險。</p>
      {optimized&&optimization.length>0?<div className="lc-table-wrap"><table className="lc-table"><thead><tr><th>Rank</th><th>Channel W</th><th>Channel H</th><th>Count</th><th>Tj est.</th><th>Cold plate ΔP</th><th>Result</th></tr></thead><tbody>{optimization.map((c,i)=><tr key={i}><td>{i+1}</td><td>{c.w.toFixed(2)} mm</td><td>{c.h.toFixed(2)} mm</td><td>{c.n}</td><td>{c.flow.tj.toFixed(1)} °C</td><td>{(c.flow.pressure/1000).toFixed(2)} kPa</td><td>{c.flow.feasible?"Within Tj":"No feasible Tj"}</td></tr>)}</tbody></table></div>:optimized?<p className="lc-note">目前加工寬度限制下沒有可搜尋的幾何組合，請調整流道尺寸或冷板寬度。</p>:null}
    </Card>
    <Card title="系統壓降與泵浦選型需求" kicker="SYSTEM PRESSURE ESTIMATE"><div className="lc-summary lc-summary-three">
      <div><small>中位流量冷板壓降</small><b>{selected?(selected.pressure/1000).toFixed(2):"—"}</b><span>kPa</span></div>
      <div><small>其他元件壓降假設</small><b>{systemExtra.toFixed(1)}</b><span>kPa</span></div>
      <div><small>估算系統總壓降</small><b>{selected?((selected.pressure/1000)+systemExtra).toFixed(2):"—"}</b><span>kPa · 未含設計裕度</span></div>
    </div><p className="lc-note">此值是指定流量下的初步壓降預算。實際泵浦工作點必須將完整系統阻力曲線與泵浦 P-Q Curve 交會確認；不可僅以最大壓力或額定最大流量選泵。</p></Card>
    <footer className="lc-footer"><span>THERMAL ENGINEERING TOOLBOX</span><span>Liquid cold plate · Preliminary estimate</span></footer>
  </main>;
}
