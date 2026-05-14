/**
 * Render Empty State for Dashboard
 */
export function renderEmptyState(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state-container animate-fade-in">
            <div class="empty-state-content glass-card">
                <div class="empty-state-icon">📂</div>
                <h2 class="empty-state-title">Welcome to BharatSupply</h2>
                <p class="empty-state-text">
                    Your logistics control tower is ready. Build your supply chain intelligence by uploading your current operational data.
                </p>
                <div class="empty-state-actions">
                    <button class="btn btn-primary pulse-glow" onclick="switchPanel('datainput')">
                        🚀 Get Started: Upload Data
                    </button>
                    <button class="btn btn-ghost" onclick="window.open('https://github.com/Rohithaddela/tbp-logistics#sample-data', '_blank')">
                        📖 View Documentation
                    </button>
                </div>
                <div class="empty-state-workflow" style="margin-top: 30px; text-align: left; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 15px; color: var(--text-primary); text-align: center;">Platform Workflow</h3>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
                        
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">1️⃣</div>
                            <h4 style="font-size: 0.9rem; color: var(--text-primary);">Data Input</h4>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Upload CSV/Excel or use the Whiteboard to design your supply chain network.</p>
                        </div>

                        <div style="color: var(--text-muted); font-size: 1.5rem; margin-top: 10px;">➔</div>

                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">2️⃣</div>
                            <h4 style="font-size: 0.9rem; color: var(--text-primary);">ML Prediction</h4>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Run XGBoost models to predict delays based on weather, congestion & vessel data.</p>
                        </div>

                        <div style="color: var(--text-muted); font-size: 1.5rem; margin-top: 10px;">➔</div>

                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">3️⃣</div>
                            <h4 style="font-size: 0.9rem; color: var(--text-primary);">Optimization</h4>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Use MILP solvers to optimize routes, minimize costs, and plan inventory.</p>
                        </div>

                        <div style="color: var(--text-muted); font-size: 1.5rem; margin-top: 10px;">➔</div>

                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 2rem; margin-bottom: 8px;">4️⃣</div>
                            <h4 style="font-size: 0.9rem; color: var(--text-primary);">Analytics</h4>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Visualize costs, track vessels, and analyze performance in the Dashboard.</p>
                        </div>

                    </div>
                </div>

                <div class="empty-state-features" style="margin-top: 25px;">
                    <div class="feature-badge"><span>🚢</span> Vessel Tracking</div>
                    <div class="feature-badge"><span>🧠</span> AI-Delay Prediction</div>
                    <div class="feature-badge"><span>⚙️</span> MILP Optimization</div>
                </div>
            </div>
        </div>
    `;
}
