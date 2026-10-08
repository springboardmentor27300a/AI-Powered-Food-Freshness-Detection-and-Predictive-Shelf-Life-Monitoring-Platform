import React from "react";
import {BrowserRouter,Routes,Route,Navigate,Outlet} from "react-router-dom";
import {AuthProvider,useAuth} from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Freshness from "./pages/Freshness";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import ReportDetail from "./pages/ReportDetail";
import Storage from "./pages/Storage";
import Profile from "./pages/Profile";
import Layout from "./components/Layout";

function Guard(){
  const {user,loading}=useAuth();
  if(loading) return <div className="loader"><div className="spinner"/><h2>FreshGuard</h2><p>Loading your workspace…</p></div>;
  return user ? <Outlet/> : <Navigate to="/login" replace/>;
}

export default function App(){
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Login/>}/>
    <Route element={<Guard/>}>
      <Route element={<Layout/>}>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/inventory" element={<Inventory/>}/>
        <Route path="/freshness" element={<Freshness/>}/>
        <Route path="/analytics" element={<Analytics/>}/>
        <Route path="/alerts" element={<Alerts/>}/>
        <Route path="/reports" element={<Reports/>}/>
        <Route path="/reports/:id" element={<ReportDetail/>}/>
        <Route path="/storage" element={<Storage/>}/>
        <Route path="/profile" element={<Profile/>}/>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter></AuthProvider>
}
