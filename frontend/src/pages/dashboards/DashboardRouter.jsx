import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import InventoryDashboard from './InventoryDashboard';
import ConsumerDashboard from './ConsumerDashboard';
import RetailManagerDashboard from './RetailManagerDashboard';
import WarehouseDashboard from './WarehouseDashboard';
import InspectorDashboard from './InspectorDashboard';
import AdminDashboard from './AdminDashboard';
import ShelfLifeDashboard from './ShelfLifeDashboard';
import StorageMonitoringDashboard from './StorageMonitoringDashboard';
import RecommendationsDashboard from './RecommendationsDashboard';
import AnalyticsDashboard from './AnalyticsDashboard';
import ReportsDashboard from './ReportsDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import NotificationBell from '../../components/NotificationBell';
import { LogOut, Home, Box, Timer, Warehouse, Lightbulb, BarChart3, FileBarChart, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardRouter = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState('');
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    if (!token) {
      navigate('/login');
    } else {
      setRole(storedRole);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  const getSidebarLinks = () => {
    const links = [
      { path: '/dashboard', label: 'Overview', icon: Home }
    ];
    
    if (role === 'Warehouse Operator' || role === 'Retail Manager' || role === 'Administrator') {
      links.push({ path: '/dashboard/inventory', label: 'Inventory', icon: Box });
    }
    
    if (role === 'Warehouse Operator' || role === 'Retail Manager' || role === 'Administrator' || role === 'Food Quality Inspector') {
      links.push(
        { path: '/dashboard/shelf-life', label: 'Shelf-Life Prediction', icon: Timer },
        { path: '/dashboard/storage', label: 'Storage Monitoring', icon: Warehouse },
        { path: '/dashboard/recommendations', label: 'Recommendations', icon: Lightbulb },
        { path: '/dashboard/analytics', label: 'Freshness Analytics', icon: BarChart3 },
      );
    }

    if (role === 'Administrator' || role === 'Retail Manager' || role === 'Warehouse Operator') {
      links.push({ path: '/dashboard/executive', label: 'Executive Analytics', icon: TrendingUp });
    }
    links.push({ path: '/dashboard/reports', label: 'Reports & Exports', icon: FileBarChart });

    return links;
  };

  const renderDashboardOverview = () => {
    switch (role) {
      case 'Consumer':
        return <ConsumerDashboard />;
      case 'Retail Manager':
        return <RetailManagerDashboard />;
      case 'Warehouse Operator':
        return <WarehouseDashboard />;
      case 'Food Quality Inspector':
        return <InspectorDashboard />;
      case 'Administrator':
        return <AdminDashboard />;
      default:
        return <div>Loading dashboard...</div>;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <aside style={{ 
        width: '280px', 
        backgroundColor: '#0a0a0a', 
        color: '#fff',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0,0,0,0.05)'
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '48px', letterSpacing: '-0.5px' }}>
          FreshMonitor.
        </div>
        
        <nav style={{ flex: 1 }}>
          {getSidebarLinks().map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px 16px', 
                color: '#a0a0a0', 
                marginBottom: '12px',
                borderRadius: '12px',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                fontWeight: 500
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a0a0a0'; }}
            >
              <link.icon size={20} style={{ marginRight: '16px' }} /> {link.label}
            </Link>
          ))}
        </nav>
        
        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #333' }}>
          <NotificationBell />
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', marginTop: '16px' }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', fontWeight: 600 }}>
               {role ? role.charAt(0) : 'U'}
             </div>
             <div>
               <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>My Account</p>
               <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>{role}</p>
             </div>
          </div>
          <button 
            onClick={handleLogout} 
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: 'transparent',
              border: '1px solid #333',
              color: '#a0a0a0',
              padding: '12px',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a1a1a'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a0a0a0'; }}
          >
            <LogOut size={16} style={{ marginRight: '8px' }} /> Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '48px', overflowY: 'auto', position: 'relative', color: '#000' }}>
        <Routes>
          <Route path="/" element={renderDashboardOverview()} />
          <Route path="/inventory" element={<InventoryDashboard role={role} />} />
          <Route path="/shelf-life" element={<ShelfLifeDashboard />} />
          <Route path="/storage" element={<StorageMonitoringDashboard />} />
          <Route path="/recommendations" element={<RecommendationsDashboard />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="/reports" element={<ReportsDashboard role={role} />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
        </Routes>
      </main>
    </div>
  );
};

export default DashboardRouter;
