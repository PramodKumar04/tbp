// ============================================================
// SteelSync-Opt — ML Predictions Dashboard UI
// ============================================================
import { formatDuration, formatPercent } from '../utils/formatters.js';

/**
 * Render ML Predictions Dashboard
 */
export function renderPredictionsPanel(vessels, predictions) {
    const container = document.getElementById('predictionsContent');
    if (!container) return;

    if (!vessels || vessels.length === 0) {
        container.innerHTML = `
            <div class="chart-empty" style="min-height:300px">
                <span class="chart-empty-icon">🤖</span>
                <div>No active vessels to predict</div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
                    Upload vessel data in the Optimizer to see AI predictions
                </div>
            </div>
        `;
        return;
    }

    const averageConfidence = predictions.length > 0 ? 
        predictions.reduce((acc, p) => acc + (p.confidence || 0), 0) / predictions.length : 0;

    container.innerHTML = `
        <div class="card-header">
            <div>
                <h3 class="card-title">🤖 XGBoost Delay Predictions</h3>
                <p class="card-subtitle">AI-powered logistics arrival forecasting (Confidence: ${formatPercent(averageConfidence)})</p>
            </div>
        </div>

        <div class="predictions-grid">
            ${vessels.map((v, i) => {
                const pred = predictions[i];
                if (!pred) return '';
                
                const isHighRisk = pred.predictedDelay > 24;
                const riskColor = isHighRisk ? 'var(--accent-danger)' : 'var(--accent-success)';
                
                return `
                    <div class="prediction-card card hover-lift">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px">
                            <div>
                                <h4 style="font-size:1rem;font-weight:700">${v.name}</h4>
                                <div style="font-size:0.72rem;color:var(--text-muted)">ETA: ${new Date(v.scheduledETA).toLocaleDateString()} at ${v.destinationPortName}</div>
                            </div>
                            <div class="risk-badge" style="background:${isHighRisk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color:${riskColor}; padding:4px 8px; border-radius:4px; font-size:0.65rem; font-weight:700; text-transform:uppercase">
                                ${isHighRisk ? 'High Risk' : 'On Track'}
                            </div>
                        </div>

                        <div class="prediction-main">
                            <div class="prediction-value-group">
                                <div class="prediction-label">Predicted Delay</div>
                                <div class="prediction-value" style="color:${riskColor}">${pred.predictedDelay > 0 ? '+' : ''}${pred.predictedDelay}h</div>
                            </div>
                            <div class="prediction-confidence-group">
                                <div class="prediction-label">AI Confidence</div>
                                <div class="confidence-bar-container">
                                    <div class="confidence-bar-fill" style="width:${pred.confidence * 100}%; background:${riskColor}"></div>
                                </div>
                                <div style="font-size:0.65rem;text-align:right;margin-top:4px">${Math.round(pred.confidence * 100)}%</div>
                            </div>
                        </div>

                        <div class="prediction-factors">
                            <div class="prediction-label" style="margin-bottom:8px">Impact Factors</div>
                            ${pred.factors && pred.factors.length > 0 ? pred.factors.map(f => `
                                <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
                                    <span style="color:var(--text-secondary)">${f.name}</span>
                                    <span style="color:${f.direction === 'increase' ? 'var(--accent-danger)' : 'var(--accent-success)'}">${f.impact === 'high' ? 'High ↑' : 'Med ↑'}</span>
                                </div>
                            `).join('') : '<div style="font-size:0.72rem;color:var(--text-muted)">No significant disruption factors</div>'}
                        </div>

                        <div style="margin-top:15px;padding-top:15px;border-top:1px solid var(--border-primary)">
                            <div style="display:flex;gap:4px">
                                ${pred.treeOutputs ? pred.treeOutputs.slice(0, 8).map(out => `
                                    <div style="height:12px;width:12px;border-radius:2px;background:${out > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};opacity:${Math.abs(out) / 10};" title="Tree output: ${out}h"></div>
                                `).join('') : ''}
                                <span style="font-size:0.6rem;color:var(--text-muted);margin-left:auto">XGBoost Ensemble Paths</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
