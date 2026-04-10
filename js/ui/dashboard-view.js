export function renderDashboardView(container) {
    container.innerHTML = `
        <div class="app-layout">
            <!-- SIDEBAR -->
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <img src="js/images/logo.png" alt="BharatSupply" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">
                    </div>
                    <div class="sidebar-brand">
                        <span class="sidebar-brand-name">BharatSupply</span>
                        <span class="sidebar-brand-sub">Logistics AI Engine</span>
                    </div>
                </div>

                <nav class="sidebar-nav">
                    <div class="nav-section">
                        <div class="nav-section-title">Main Operations</div>
                        <div class="nav-item" data-panel="datainput">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
                            <span class="nav-label">Data Gateway</span>
                        </div>
                        <div class="nav-item active" data-panel="overview">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
                            <span class="nav-label">Executive View</span>
                        </div>
                        <div class="nav-item" data-panel="vessels">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/></svg></span>
                            <span class="nav-label">Strategic Tracker</span>
                            <span class="nav-badge" id="delayedBadge"></span>
                        </div>
                        <div class="nav-item" data-panel="vesselplan">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
                            <span class="nav-label">Strategic Planning</span>
                        </div>
                        <div class="nav-item" data-panel="inventory">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7l8.71 5 8.71-5"/><line x1="12" y1="22" x2="12" y2="12"/></svg></span>
                            <span class="nav-label">Inventory Control</span>
                        </div>
                    </div>

                    <div class="nav-section">
                        <div class="nav-section-title">Intelligence</div>
                        <div class="nav-item" data-panel="mlstudio">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-10 4 10"/></svg></span>
                            <span class="nav-label">ML Training Lab</span>
                        </div>
                        <div class="nav-item" data-panel="optimizer">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span>
                            <span class="nav-label">Optimization Hub</span>
                        </div>
                        <div class="nav-item" data-panel="predictions">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/><path d="m9.01 19 3-10"/><path d="m15 19-3-10"/></svg></span>
                            <span class="nav-label">Risk Forecasting</span>
                        </div>
                        <div class="nav-item" data-panel="costs">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
                            <span class="nav-label">Finance & Costs</span>
                        </div>
                        <div class="nav-item" data-panel="whatif">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                            <span class="nav-label">Simulation Lab</span>
                        </div>
                    </div>

                    <div class="nav-section">
                        <div class="nav-section-title">System</div>
                        <div class="nav-item" id="presentationBtn">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>
                            <span class="nav-label">Briefing Mode</span>
                        </div>
                        <div class="nav-item" id="logoutBtn">
                            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
                            <span class="nav-label">Sign Out</span>
                        </div>
                    </div>
                </nav>

                <div class="sidebar-footer">
                    <span class="status-dot pulse-glow"></span>
                    <span>System Operational</span>
                </div>
            </aside>

            <!-- MAIN CONTENT -->
            <main class="main-content">
                <section class="panel" id="panel-datainput">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Data Input</h1><p class="page-subtitle">Upload data or design your supply chain network</p></div></div>
                    <div id="dataInputContent"></div>
                </section>

                <section class="panel active" id="panel-overview">
                    <div class="page-header" id="overviewHeader"></div>
                    <div class="kpi-grid stagger-children" id="kpiGrid"></div>
                    <div class="dashboard-grid">
                        <div class="chart-card"><div class="card-header"><div><span class="card-title">Cost Breakdown</span><p class="card-subtitle">Optimized logistics cost distribution</p></div></div><div class="chart-container"><canvas id="costDoughnutChart"></canvas></div></div>
                        <div class="chart-card"><div class="card-header"><div><span class="card-title">Vessel Timeline</span><p class="card-subtitle">ETA schedule with predicted delays</p></div></div><div class="chart-container"><canvas id="vesselTimelineChart"></canvas></div></div>
                        <div class="chart-card"><div class="card-header"><div><span class="card-title">Inventory Projection</span><p class="card-subtitle">30-day stock forecast — Bhilai Plant</p></div></div><div class="chart-container"><canvas id="inventoryAreaChart"></canvas></div></div>
                        <div class="chart-card"><div class="card-header"><div><span class="card-title">Cost Trend</span><p class="card-subtitle">Optimized vs. baseline over 30 days</p></div></div><div class="chart-container"><canvas id="costTrendChart"></canvas></div></div>
                    </div>
                    <div class="card reliability-card"><h4 class="card-title">Supply Reliability</h4><div id="reliabilityGauge"></div></div>
                </section>

                <section class="panel" id="panel-vessels">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Vessel Tracker</h1><p class="page-subtitle">Real-time vessel monitoring with AI delay predictions</p></div></div>
                    <div class="card" id="vesselTrackerContent"></div>
                </section>

                <section class="panel" id="panel-vesselplan">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Vessel Planning</h1><p class="page-subtitle">Plan vessel discharge and optimize rail routes to plants</p></div></div>
                    <div id="vesselPlanContent"></div>
                </section>

                <section class="panel" id="panel-inventory">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Inventory Management</h1><p class="page-subtitle">Plant-wise material stock levels and projections</p></div></div>
                    <div id="inventoryContent"></div>
                </section>

                <section class="panel" id="panel-predictions">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">ML Predictions</h1><p class="page-subtitle">XGBoost delay prediction model analysis for booked vessel plans</p></div></div>
                    <div id="predictionsContent"></div>
                </section>

                <section class="panel" id="panel-costs">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Cost Analytics</h1><p class="page-subtitle">MILP optimization results and cost breakdown</p></div></div>
                    <div class="card" id="costAnalyticsContent"></div>
                </section>

                <section class="panel" id="panel-whatif">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">What-If Simulation</h1><p class="page-subtitle">Scenario-based disruption analysis with instant re-optimization</p></div></div>
                    <div class="card" id="whatifContent"></div>
                </section>

                <section class="panel" id="panel-mlstudio">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">ML Prediction Studio</h1><p class="page-subtitle">Upload historical data, fetch weather, and train the Delay Prediction model.</p></div></div>
                    <div id="mlStudioContent"></div>
                </section>

                <section class="panel" id="panel-optimizer">
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">Optimization Engine</h1><p class="page-subtitle">Upload demand, rakes, SAP data and run MILP logistics optimization.</p></div></div>
                    <div id="optimizerStudioContent"></div>
                </section>
            </main>
        </div>

        <!-- PRESENTATION OVERLAY -->
        <div class="presentation-overlay" id="presentationOverlay">
            <div class="presentation-slide" id="presentationSlideContent"></div>
            <div class="presentation-controls">
                <button class="btn btn-ghost" id="prevSlideBtn">← Previous</button>
                <span class="slide-counter" id="slideCounter">1 / 5</span>
                <button class="btn btn-primary" id="nextSlideBtn">Next →</button>
                <button class="btn btn-ghost btn-sm" id="closePresentationBtn">✕ Close</button>
            </div>
        </div>
    `;
}
