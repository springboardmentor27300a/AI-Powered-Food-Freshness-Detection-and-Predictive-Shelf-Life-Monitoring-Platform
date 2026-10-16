import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_BASE } from '../../api';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, formData);
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #e6394622, #457b9d22)',
          top: '-20%',
          left: '-10%',
          filter: 'blur(80px)',
          zIndex: 0
        }}
      />
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #1d355722, #2a9d8f22)',
          bottom: '-10%',
          right: '-10%',
          filter: 'blur(80px)',
          zIndex: 0
        }}
      />

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ 
          width: '100%', 
          maxWidth: '500px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '32px',
          padding: '48px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
          zIndex: 10,
          color: '#000'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: '1.5rem', color: '#000', letterSpacing: '-0.5px' }}>FreshMonitor.</Link>
          <h2 style={{ fontSize: '2rem', marginTop: '24px', marginBottom: '8px' }}>Welcome Back</h2>
          <p style={{ color: '#666' }}>Sign in to your account</p>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ 
              backgroundColor: '#fee2e2', 
              color: '#dc2626', 
              padding: '12px 16px', 
              borderRadius: '12px',
              marginBottom: '24px', 
              textAlign: 'center',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            {error}
          </motion.div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem', fontWeight: 600 }}>Username</label>
            <input 
              type="text" 
              name="username" 
              placeholder="Enter your username"
              value={formData.username}
              onChange={handleChange}
              required 
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid #e5e5e5',
                backgroundColor: '#fff',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#000'; e.target.style.boxShadow = '0 0 0 4px rgba(0,0,0,0.05)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e5e5'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem', fontWeight: 600 }}>Password</label>
            <input 
              type="password" 
              name="password" 
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required 
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid #e5e5e5',
                backgroundColor: '#fff',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => { e.target.style.borderColor = '#000'; e.target.style.boxShadow = '0 0 0 4px rgba(0,0,0,0.05)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e5e5e5'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </motion.button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '0.95rem', color: '#666' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#000', fontWeight: 700, textDecoration: 'none' }}>Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
