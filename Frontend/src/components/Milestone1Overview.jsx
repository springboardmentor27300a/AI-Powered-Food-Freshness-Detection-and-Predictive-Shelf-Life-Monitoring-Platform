import React from 'react';

export default function Milestone1Overview() {
  const slides = [
    { title: "Slide 1: Title & Vision", content: "FreshSense AI: AI-Powered Food Freshness Monitoring & Multi-Warehouse Supply Chain Platform." },
    { title: "Slide 2: Problem Statement", content: "Food spoilage and opacity across cold chains lead to huge financial waste ($1.3B/year) and delayed freshness tracking." },
    { title: "Slide 3: Architecture & Tech Stack", content: "FastAPI Async Microservices, Cloud MongoDB Atlas document DB, Vite + React dynamic frontend, JWT Role-based Security." },
    { title: "Slide 4: Role-Based Access Control", content: "5 specialized user personas: Consumer, Retail Manager, Warehouse Operator, Quality Inspector, Administrator." },
    { title: "Slide 5: Food Batch & Inventory Workflow", content: "Batch ID tracking (BATCH-YYYYMMDD-XXX), harvest & expiry dates, multi-warehouse location tracking, storage environmental parameters." },
    { title: "Slide 6: Retail Procurement & Transaction Lock", content: "Retail Managers view live freshness score, click 'Buy Batch' -> atomically updates status to 'SOLD', locks double-purchase." },
    { title: "Slide 7: Computer Vision Datasets & AI Scoring", content: "Freshness weighted scoring matrix: Visual 40%, Storage 25%, Shelf-life 20%, Age 15%. Datasets: Fruits Freshness, Kaggle, Food-101." },
    { title: "Slide 8: Cloud MongoDB Atlas Schema", content: "Document collections for Users, Warehouses, Categories, Food Batches, and Transaction logs." },
    { title: "Slide 9: Milestone 1 Accomplishments", content: "Full environment setup, dynamic auth, database schema, multi-warehouse inventory workflow, and API integration operational." },
    { title: "Slide 10: Next Steps (Milestone 2 Roadmap)", content: "Integrating CNN Computer Vision models (PyTorch / YOLO) for automated visual mold & bruising detection." }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Banner */}
      <div className="linear-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.8rem' }}>📊</span>
          <h2 className="linear-text-gradient" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
            Milestone 1 Implementation & Datasets Guide
          </h2>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--linear-fg-muted)', fontWeight: 400 }}>
          Comprehensive summary of Milestone 1 technical execution, dataset organization, and 10-slide presentation framework.
        </p>
      </div>

      {/* Grid of Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Section 1: Milestone 1 Accomplishments */}
        <div className="linear-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#34D399', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span> Milestone 1 Accomplishments
          </h3>
          <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--linear-fg)' }}>
            <li><strong>Dynamic Auth Pages:</strong> Created role-based login & registration supporting all 5 PRD roles with custom metadata.</li>
            <li><strong>Cloud MongoDB Integration:</strong> Deployed document schemas for <code>users</code>, <code>warehouses</code>, <code>categories</code>, <code>food_batches</code> on Cloud MongoDB Atlas.</li>
            <li><strong>FastAPI Microservice APIs:</strong> Endpoints for registration, JWT login, batch tagging, inventory search, and retail purchasing.</li>
            <li><strong>Multi-Warehouse Food Workflow:</strong> Support for registering produce batches with Batch ID tags, harvest/expiry dates, and environmental storage metrics.</li>
            <li><strong>Retail Purchasing & Double-Buy Prevention:</strong> Atomically updates status to <code>"SOLD - Purchased by Retail Store"</code> and prevents re-buying.</li>
          </ul>
        </div>

        {/* Section 2: Datasets Collection */}
        <div className="linear-card">
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--linear-accent)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🖼️</span> Food Freshness Image Datasets
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div style={{ background: '#09090C', padding: '10px', borderRadius: '8px', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--linear-accent)', marginBottom: 2 }}>1. Fruits Freshness Dataset (Kaggle)</div>
              <p style={{ color: 'var(--linear-fg-muted)' }}>Contains 13,500+ images of fresh vs. spoiled apples, bananas, and oranges. Used for computer vision binary classification and freshness scoring.</p>
            </div>

            <div style={{ background: '#09090C', padding: '10px', borderRadius: '8px', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, color: '#34D399', marginBottom: 2 }}>2. Vegetable Freshness Dataset</div>
              <p style={{ color: 'var(--linear-fg-muted)' }}>Includes fresh and wilted spinach, tomatoes, carrots, and potatoes with mold and surface defect annotations.</p>
            </div>

            <div style={{ background: '#09090C', padding: '10px', borderRadius: '8px', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontWeight: 600, color: '#FBBF24', marginBottom: 2 }}>3. Food-101 Multi-Category Dataset</div>
              <p style={{ color: 'var(--linear-fg-muted)' }}>101 food categories with 101,000 images for broad product taxonomy and multi-category identification support.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Section 3: 10-Slide PPT Presentation Structure */}
      <div className="linear-card">
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#C084FC', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📽️</span> Milestone 1 Presentation Outline
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {slides.map((s, idx) => (
            <div key={idx} style={{ background: '#09090C', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--linear-border-default)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--linear-accent)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                {s.title}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--linear-fg)', lineHeight: 1.4 }}>
                {s.content}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
