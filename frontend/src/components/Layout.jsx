import {NavLink,useNavigate,Outlet} from "react-router-dom";
import {LayoutDashboard,Package,ScanLine,BarChart3,Bell,FileText,UserCircle,LogOut,Leaf,Thermometer} from "lucide-react";
import {useAuth} from "../context/AuthContext";
const links=[["/","Dashboard",LayoutDashboard],["/inventory","Food Inventory",Package],["/freshness","Freshness Analysis",ScanLine],["/analytics","Analytics",BarChart3],["/alerts","Alerts",Bell],["/reports","Reports",FileText],["/storage","Storage Monitor",Thermometer]];
export default function Layout(){const {user,logout}=useAuth();const nav=useNavigate();return <div className="shell">
 <aside className="sidebar"><div className="logo"><span className="logo-mark"><Leaf/></span><span><b>FreshGuard</b><small>Food Intelligence</small></span></div>
 <div className="nav-label">WORKSPACE</div><nav>{links.map(([p,n,I])=><NavLink key={p} to={p} end={p==="/"} className={({isActive})=>isActive?"nav active":"nav"}><I size={19}/>{n}</NavLink>)}</nav>
 <div className="nav-label">QUICK ACTIONS</div>
 <button className="side-action" onClick={()=>nav("/inventory")}><Package/> Add Food Batch</button>
 <button className="side-action alt" onClick={()=>nav("/freshness")}><ScanLine/> Analyze Freshness</button>
 <div className="side-bottom"><NavLink to="/profile" className="user-card"><span className="avatar"><UserCircle/></span><span><b>{user?.name}</b><small>{user?.role?.replaceAll("_"," ")}</small></span></NavLink><button className="logout" onClick={()=>{logout();nav("/login")}}><LogOut/> Logout</button></div>
 </aside>
 <main className="main"><header className="top"><div><h3>Food Freshness Monitoring</h3><span>Monitor, analyze and reduce food waste</span></div><NavLink to="/profile" className="top-user"><span className="avatar small"><UserCircle/></span><span><b>{user?.name}</b><small>{user?.role?.replaceAll("_"," ")}</small></span></NavLink></header><section className="content"><Outlet/></section></main>
 </div>}
