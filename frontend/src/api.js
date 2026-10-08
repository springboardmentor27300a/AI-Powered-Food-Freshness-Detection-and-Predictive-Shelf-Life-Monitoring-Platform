import axios from "axios";
const api=axios.create({baseURL:import.meta.env.VITE_API_URL||"http://localhost:8000"});
api.interceptors.request.use(config=>{const t=localStorage.getItem("freshguard_token");if(t)config.headers.Authorization=`Bearer ${t}`;return config});
export default api;
