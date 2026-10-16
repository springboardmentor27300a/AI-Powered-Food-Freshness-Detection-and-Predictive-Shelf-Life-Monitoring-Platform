import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { Activity, ShieldCheck, Box, Apple, ArrowRight, Clock, Leaf } from 'lucide-react';

const LandingPage = () => {
  const controls = useAnimation();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        controls.start("visible");
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [controls]);

  return (
    <div style={{ backgroundColor: '#ffffff', color: '#000000', minHeight: '100vh', overflowX: 'hidden' }}>
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 48px',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>FreshMonitor.</div>
        <div>
          <Link to="/login" style={{ 
            marginRight: '24px', 
            fontWeight: 600, 
            color: '#000', 
            textDecoration: 'none' 
          }}>Sign In</Link>
          <Link to="/signup" className="button" style={{ 
            backgroundColor: '#000', 
            color: '#fff',
            padding: '10px 24px'
          }}>Get Started</Link>
        </div>
      </nav>

      <section style={{ 
        display: 'flex', 
        minHeight: '100vh', 
        alignItems: 'center',
        position: 'relative',
        paddingTop: '80px'
      }}>
        <div style={{ flex: 1, padding: '0 80px', zIndex: 10 }}>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p style={{ color: '#e63946', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>
              Freshness Monitoring
            </p>
            <h1 style={{ 
              fontSize: '4.5rem', 
              fontWeight: 800, 
              lineHeight: 1.1, 
              marginBottom: '24px', 
              letterSpacing: '-1px' 
            }}>
              Freshness<br/>in every bite.
            </h1>
            <p style={{ 
              fontSize: '1.2rem', 
              color: '#555', 
              maxWidth: '450px', 
              marginBottom: '40px', 
              lineHeight: 1.6 
            }}>
              Intelligent food freshness monitoring and shelf-life prediction platform for consumers, retailers, and supply chain operators.
            </p>
            
            <Link to="/signup" className="button" style={{ 
              backgroundColor: '#000', 
              color: '#fff', 
              fontSize: '1.1rem', 
              padding: '16px 32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              Start Monitoring <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>

        <div style={{ 
          flex: 1, 
          height: '100vh',
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          backgroundColor: '#0a0a0a',
          borderBottomLeftRadius: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible'
        }}>
          <motion.img 
            src="/hero.jpg" 
            alt="Fresh Food Platter" 
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2, type: 'spring' }}
            style={{ 
              width: '120%', 
              maxWidth: '800px',
              borderRadius: '50%',
              boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
              position: 'absolute',
              left: '-20%'
            }} 
          />
        </div>
      </section>

      <section style={{ padding: '120px 48px', backgroundColor: '#fafafa', position: 'relative', zIndex: 20 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <motion.div 
            initial="hidden"
            animate={controls}
            variants={{
              visible: { opacity: 1, y: 0 },
              hidden: { opacity: 0, y: 50 }
            }}
            transition={{ duration: 0.8 }}
          >
            <h2 style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '80px', letterSpacing: '-1px' }}>Unique Features</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px' }}>
              
              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#f0f4ff', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#2563eb' }}>
                  <Activity size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Real-time Analytics</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Monitor environmental conditions and storage compliance seamlessly across all facilities.</p>
              </motion.div>
              
              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#fff1f2', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#e11d48' }}>
                  <Apple size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>AI Quality Scoring</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Advanced AI algorithms to estimate freshness scores and detect spoilage indicators early.</p>
              </motion.div>

              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#f0fdf4', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#16a34a' }}>
                  <Box size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Smart Inventory</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Efficiently manage food batches, minimize waste, and receive proactive shelf-life alerts.</p>
              </motion.div>

              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#fdf4ff', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#c026d3' }}>
                  <ShieldCheck size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Role-based Access</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Tailored secure dashboards for consumers, retail managers, and food quality inspectors.</p>
              </motion.div>

              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#fffbeb', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#d97706' }}>
                  <Clock size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Shelf-Life Prediction</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Accurately forecast remaining shelf life using image analysis and storage condition data.</p>
              </motion.div>

              <motion.div whileHover={{ y: -15, scale: 1.02 }} style={{ 
                backgroundColor: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', textAlign: 'center' 
              }}>
                <div style={{ backgroundColor: '#ecfccb', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#65a30d' }}>
                  <Leaf size={40} />
                </div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Waste Reduction</h3>
                <p style={{ color: '#666', lineHeight: 1.6 }}>Get proactive consumption and rotation recommendations to significantly reduce food waste.</p>
              </motion.div>

            </div>
          </motion.div>
        </div>
      </section>

      <footer style={{ padding: '64px 48px', backgroundColor: '#0a0a0a', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '24px' }}>FreshMonitor.</div>
        <p style={{ color: '#888' }}>&copy; 2026 FreshMonitor Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
