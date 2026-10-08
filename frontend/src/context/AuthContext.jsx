import {createContext,useContext,useEffect,useState} from "react";
import api from "../api";
const C=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{const t=localStorage.getItem("freshguard_token");if(!t){setLoading(false);return}
  api.get("/api/auth/me").then(r=>setUser(r.data)).catch(()=>{localStorage.removeItem("freshguard_token");setUser(null)}).finally(()=>setLoading(false))
 },[]);
 const login=async(email,password)=>{const r=await api.post("/api/auth/login",{email,password});localStorage.setItem("freshguard_token",r.data.access_token);setUser(r.data.user);return r.data.user};
 const register=async(data)=>{const r=await api.post("/api/auth/register",data);localStorage.setItem("freshguard_token",r.data.access_token);setUser(r.data.user);return r.data.user};
 const logout=()=>{localStorage.removeItem("freshguard_token");setUser(null)};
 return <C.Provider value={{user,loading,login,register,logout}}>{children}</C.Provider>
}
export const useAuth=()=>useContext(C);
