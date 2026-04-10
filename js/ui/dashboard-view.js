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
                        <div class="nav-section-title">Main</div>
                        <div class="nav-item" data-panel="datainput">
                            <span class="nav-icon">📂</span>
                            <span class="nav-label">Data Input</span>
                        </div>
                        <div class="nav-item active" data-panel="overview">
                            <span class="nav-icon">📊</span>
                            <span class="nav-label">Dashboard</span>
                        </div>
                        <div class="nav-item" data-panel="vessels">
                            <span class="nav-icon">🚢</span>
                            <span class="nav-label">Vessel Tracker</span>
                            <span class="nav-badge" id="delayedBadge"></span>
                        </div>
                        <div class="nav-item" data-panel="vesselplan">
                            <span class="nav-icon">⚓</span>
                            <span class="nav-label">Vessel Planning</span>
                        </div>
                        <div class="nav-item" data-panel="inventory">
                            <span class="nav-icon">📦</span>
                            <span class="nav-label">Inventory</span>
                        </div>
                    </div>

                    <div class="nav-section">
                        <div class="nav-section-title">Intelligence</div>
                        <div class="nav-item" data-panel="mlstudio">
                            <span class="nav-icon">🧠</span>
                            <span class="nav-label">ML Studio</span>
                        </div>
                        <div class="nav-item" data-panel="optimizer">
                            <span class="nav-icon">⚙️</span>
                            <span class="nav-label">Optimizer</span>
                        </div>
                        <div class="nav-item" data-panel="predictions">
                            <span class="nav-icon">🤖</span>
                            <span class="nav-label">ML Predictions</span>
                        </div>
                        <div class="nav-item" data-panel="costs">
                            <span class="nav-icon">💰</span>
                            <span class="nav-label">Cost Analytics</span>
                        </div>
                        <div class="nav-item" data-panel="whatif">
                            <span class="nav-icon">🔮</span>
                            <span class="nav-label">What-If Sim</span>
                        </div>
                    </div>

                    <div class="nav-section">
                        <div class="nav-section-title">Actions</div>
                        <div class="nav-item" id="presentationBtn">
                            <span class="nav-icon">🎬</span>
                            <span class="nav-label">Presentation</span>
                        </div>
                        <div class="nav-item" id="logoutBtn">
                            <span class="nav-icon">🚪</span>
                            <span class="nav-label">Logout</span>
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
                    <div class="card" style="max-width:280px;margin:0 auto;text-align:center"><h4 class="card-title" style="margin-bottom:12px">Supply Reliability</h4><div id="reliabilityGauge"></div></div>
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
                    <div class="page-header"><div class="page-header-left"><h1 class="page-title">ML Predictions</h1><p class="page-subtitle">Random Forest delay prediction model analysis</p></div></div>
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
                <button class="btn btn-ghost btn-sm" id="closePresentationBtn" style="margin-left:12px">✕ Close</button>
            </div>
        </div>
    `;
}
