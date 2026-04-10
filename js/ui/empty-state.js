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
                <div class="empty-state-features">
                    <div class="feature-badge"><span>🚢</span> Vessel Tracking</div>
                    <div class="feature-badge"><span>🧠</span> AI-Delay Prediction</div>
                    <div class="feature-badge"><span>⚙️</span> MILP Optimization</div>
                </div>
            </div>
        </div>
    `;
}
