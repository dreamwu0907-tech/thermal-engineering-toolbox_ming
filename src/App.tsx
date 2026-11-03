import { useState } from "react";
import LiquidCooling from "./LiquidCooling";
import AirCooling from "./AirCooling";

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
