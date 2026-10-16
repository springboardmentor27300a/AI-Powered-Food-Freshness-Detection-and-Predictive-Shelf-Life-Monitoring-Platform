import { useState } from "react";
import "./AnalysisUI.css";
import { API } from "./api";
const defs=[
  ["freshness","Freshness Report","Freshness score, classifications, spoilage probability and assessment coverage."],
  ["shelf-life","Shelf-Life Report","Recorded vs predicted expiry, effective expiry, current status and days remaining."],
  ["inventory-quality","Inventory Quality Report","Availability, stock quantity and quality-risk flags."],
  ["waste-reduction","Waste Reduction Report","Waste-risk prioritization and actions to reduce avoidable loss."],
  ["storage-compliance","Storage Compliance Report","Temperature, humidity, air circulation, light exposure and compliance history."],
  ["fefo-rotation","FEFO Rotation Report","First Expired, First Out priority, effective expiry and inventory rotation actions."],
];
export default function ReportsCenter({role}){
 const [active,setActive]=useState("freshness"),[data,setData]=useState(null),[loading,setLoading]=useState(false);
 const load=async type=>{setActive(type);setLoading(true);try{const r=await fetch(`${API}/reports/${type}`);setData(await r.json())}finally{setLoading(false)}};
 return <div className="analysis-page"><div className="analysis-head"><div><p className="eyebrow">REPORTS & EXPORT SYSTEM</p><h2>Operational reports for {role}</h2><p>View live report data and export professional PDF or Excel files for presentation, audit and decision support.</p></div></div>
 <div className="report-card-grid">{defs.map(([id,title,desc])=><article className={`report-card ${active===id?"active":""}`} key={id}><span>{title}</span><p>{desc}</p><div><button onClick={()=>load(id)}>View Report</button><button className="secondary" onClick={()=>window.open(`${API}/reports/${id}/pdf`,"_blank")}>PDF</button><button className="secondary" onClick={()=>window.open(`${API}/reports/${id}/excel`,"_blank")}>Excel</button></div></article>)}</div>
 {loading&&<section className="analysis-panel">Loading report...</section>}
 {data&&!loading&&<section className="analysis-panel"><div className="panel-title"><div><p className="eyebrow">LIVE REPORT</p><h3>{data.report}</h3></div><span className="status-pill good">Generated {data.generated_on}</span></div><div className="report-summary-grid">{Object.entries(data.summary||{}).map(([k,v])=><article key={k}><span>{k.replaceAll("_"," ")}</span><strong>{v??"-"}</strong></article>)}</div>{data.records?.length>0&&<div className="report-table-scroll"><table className="report-table"><thead><tr>{Object.keys(data.records[0]).map(h=><th key={h}>{h.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{data.records.slice(0,50).map((r,i)=><tr key={i}>{Object.keys(data.records[0]).map(h=><td key={h}>{r[h]===null||r[h]===undefined?"-":String(r[h])}</td>)}</tr>)}</tbody></table></div>}</section>}
 </div>
}
