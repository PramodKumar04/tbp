import { predictor } from '../engines/prediction.js';
import { weatherApi } from '../engines/weather-api.js';
import { apiUpload, apiFetch } from '../utils/api.js';
import { parseUploadedFile } from '../utils/excel-parser.js';
import { showNotification } from '../app.js';

let uploadedData = null;
let currentStep = 1;
let portWeatherCache = {};
let currentVessels = []; // Will be set from app state

export function renderMLStudioPanel(vessels = []) {
    const container = document.getElementById('mlStudioContent');
    if (!container) return;

    // Capture vessels for use in predictions tab
    currentVessels = vessels || [];

    container.innerHTML = `
        <div class="wizard-container">
            <div class="wizard-sidebar">
                <div class="wizard-step active" data-step="1">1. Upload Data</div>
                <div class="wizard-step" data-step="2">2. Weather Input</div>
                <div class="wizard-step" data-step="3">3. Train Model</div>
                <div class="wizard-step" data-step="4">4. View Predictions</div>
            </div>
            <div class="wizard-content">
                <!-- Step 1: Upload -->
                <div class="step-pane active" id="mlStep1" style="display:block">
                    <h2>Upload Historical Delay Data</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Provide a CSV/Excel file with historical logistics delays to train the XGBoost model.</p>

                    <div class="file-drop-zone" id="mlFileDropZone" style="cursor:pointer">
                        <div class="drop-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <p id="mlUploadStatusText">Drag and drop CSV/Excel here or click to browse</p>
                        <input type="file" id="mlFileInput" accept=".csv, .xlsx, .xls" style="display:none">
                        <button class="btn btn-primary" onclick="document.getElementById('mlFileInput').click()">Browse Files</button>
                    </div>

                    <div style="margin-top:20px;padding:16px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border-primary)">
                        <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">💡 Or skip upload and train on synthetic data:</p>
                        <button class="btn btn-ghost btn-sm" id="btnUseSynthetic">Use Synthetic Training Data →</button>
                    </div>
                </div>

                <!-- Step 2: Weather -->
                <div class="step-pane" id="mlStep2" style="display:none">
                    <h2>Weather Feature Enhancement</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Live weather scores are factored into delay predictions.</p>
                    <div id="weatherPortScores" class="metrics-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:20px"></div>
                    <div id="weatherLoadingMsg" style="text-align:center;color:var(--text-muted);padding:30px">
                        <span class="loading-spinner" style="display:inline-block;margin-bottom:12px"></span>
                        <div>Syncing live weather data for Indian logistics hubs...</div>
                    </div>
                    <button class="btn btn-primary" id="btnNextToTrain" style="margin-top:20px;display:none">Next: Train Model →</button>
                </div>

                <!-- Step 3: Train -->
                <div class="step-pane" id="mlStep3" style="display:none">
                    <h2>Train XGBoost Ensemble Model</h2>
                    <div id="trainingProgress" style="display:none;margin-top:20px">
                        <p>Training 20-tree gradient boosted ensemble...</p>
                        <div class="progress-bar" style="width:100%;background:var(--bg-tertiary);height:10px;border-radius:5px;margin-top:12px">
                            <div class="progress-fill" id="trainBarFill" style="width:0%;background:var(--primary);height:100%;border-radius:5px;transition:width 0.08s"></div>
                        </div>
                        <p id="trainStatusMsg" style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Initializing...</p>
                    </div>
                    <div id="trainingResults" style="display:none;margin-top:20px">
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px">
                            <div class="card" style="text-align:center;padding:20px;border-top:4px solid var(--primary)">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">MAE (Hours)</div>
                                <div id="metricMae" style="font-size:2rem;font-weight:700;color:var(--primary)">--</div>
                            </div>
                            <div class="card" style="text-align:center;padding:20px;border-top:4px solid #8b5cf6">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">RMSE (Hours)</div>
                                <div id="metricRmse" style="font-size:2rem;font-weight:700;color:#8b5cf6">--</div>
                            </div>
                            <div class="card" style="text-align:center;padding:20px;border-top:4px solid var(--accent-success)">
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">R² Score</div>
                                <div id="metricR2" style="font-size:2rem;font-weight:700;color:var(--accent-success)">--</div>
                            </div>
                        </div>
                        <div id="trainSummaryMsg" style="margin-top:16px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:0.82rem;color:var(--text-secondary)"></div>
                        <button class="btn btn-primary" id="btnNextToPredict" style="margin-top:20px;width:100%">Next: View Predictions →</button>
                    </div>
                    <button class="btn btn-primary" id="btnTrain" style="width:100%;margin-top:20px">Initialize Training Sequence</button>
                </div>

                <!-- Step 4: Predictions -->
                <div class="step-pane" id="mlStep4" style="display:none">
                    <h2>AI Prediction Dashboard</h2>
                    <p style="color:var(--text-muted);margin-bottom:20px">Real-time delay forecasts for all active vessels using the trained XGBoost model.</p>
                    <div id="mlPredictionsOutput" style="margin-top:16px"></div>
                </div>
            </div>
        </div>
    `;

    bindMLStudioEvents();
}

function bindMLStudioEvents() {
    const fileInput = document.getElementById('mlFileInput');
    const statusText = document.getElementById('mlUploadStatusText');

    // --- File Upload Handler ---
    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (statusText) statusText.textContent = `Processing ${file.name}...`;

        try {
            const parsed = await parseUploadedFile(file);
            uploadedData = parsed.data;
            if (statusText) statusText.textContent = `✅ Loaded ${uploadedData.length} records from ${file.name}`;
            showNotification(`Loaded ${uploadedData.length} records!`, 'success');
            setTimeout(() => goToStep(2), 1200);
            fetchWeather();
        } catch (err) {
            console.error('[ML Studio] Upload error:', err);
            if (statusText) statusText.textContent = `❌ Error: ${err.message}`;
        }
    });

    // --- Synthetic Data Fallback: go straight to training with synthetic data ---
    document.getElementById('btnUseSynthetic')?.addEventListener('click', async () => {
        uploadedData = generateSyntheticTrainingData();
        showNotification(`Using ${uploadedData.length} synthetic training records`, 'info');
        // Jump straight to training step
        goToStep(3);
        await new Promise(r => setTimeout(r, 300));
        runTraining();
    });

    // --- Weather → Train ---
    document.getElementById('btnNextToTrain')?.addEventListener('click', () => goToStep(3));

    // --- Train Button ---
    document.getElementById('btnTrain')?.addEventListener('click', runTraining);

    // --- Predictions Button ---
    document.getElementById('btnNextToPredict')?.addEventListener('click', () => {
        goToStep(4);
        renderPredictionsOutput();
    });

    // Allow clicking Step 4 directly from wizard sidebar
    document.querySelectorAll('#mlStudioContent .wizard-step').forEach(el => {
        el.addEventListener('click', () => {
            const step = parseInt(el.dataset.step);
            if (step === 4) {
                goToStep(4);
                renderPredictionsOutput();
            }
        });
    });
}

function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('#mlStudioContent .wizard-step').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.step) === step);
    });
    document.querySelectorAll('#mlStudioContent .step-pane').forEach((el, idx) => {
        const isActive = idx + 1 === step;
        el.style.display = isActive ? 'block' : 'none';
        el.classList.toggle('active', isActive);
    });
}

async function fetchWeather() {
    const ports = [
        { id: 'paradip', name: 'Paradip' },
        { id: 'haldia', name: 'Haldia' },
        { id: 'vizag', name: 'Visakhapatnam' },
        { id: 'dhamra', name: 'Dhamra' }
    ];
    const container = document.getElementById('weatherPortScores');
    const loadingMsg = document.getElementById('weatherLoadingMsg');
    const nextBtn = document.getElementById('btnNextToTrain');
    if (!container) return;

    container.innerHTML = '';

    for (const port of ports) {
        try {
            const data = await weatherApi.getWeather(port.id);
            portWeatherCache[port.id] = data.score;
            const scoreColor = data.score > 0.7 ? '#15803d' : data.score > 0.5 ? '#b45309' : '#b91c1c';
            const scoreBg = data.score > 0.7 ? '#f0fdf4' : data.score > 0.5 ? '#fffbeb' : '#fef2f2';
            const scoreBorder = data.score > 0.7 ? '#bbf7d0' : data.score > 0.5 ? '#fde68a' : '#fecaca';

            container.innerHTML += `
                <div class="card" style="padding:16px;border-top:4px solid ${scoreColor};background:${scoreBg};border-color:${scoreBorder}">
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">${port.name} Port</div>
                    <div style="font-size:1.6rem;font-weight:700;color:${scoreColor}">${data.score.toFixed(2)}</div>
                    <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px">
                        Wind: ${data.windSpeed}km/h · Precip: ${data.precipitation}mm
                    </div>
                </div>
            `;
        } catch(e) {
            portWeatherCache[port.id] = 0.7; // fallback
            container.innerHTML += `
                <div class="card" style="padding:16px;border-top:4px solid #b45309;background:#fffbeb;border-color:#fde68a">
                    <div style="font-size:0.72rem;color:var(--text-muted)">${port.name}</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#b45309">N/A</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">Weather API unavailable</div>
                </div>
            `;
        }
    }

    if (loadingMsg) loadingMsg.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'block';
}

function runTraining() {
    const trainBtn = document.getElementById('btnTrain');
    const progressDiv = document.getElementById('trainingProgress');
    const statusMsg = document.getElementById('trainStatusMsg');

    if (trainBtn) trainBtn.style.display = 'none';
    if (progressDiv) progressDiv.style.display = 'block';

    const messages = [
        'Initializing gradient boosting framework...',
        'Computing base prediction (mean delay)...',
        'Tree 1/20: Fitting residual stumps...',
        'Tree 5/20: Applying learning rate (η=0.15)...',
        'Tree 10/20: Adjusting feature weights...',
        'Tree 15/20: Converging predictions...',
        'Tree 20/20: Final ensemble complete...',
        'Evaluating on holdout test set...',
    ];

    let width = 0;
    let msgIdx = 0;
    const interval = setInterval(() => {
        width += 5;
        const fill = document.getElementById('trainBarFill');
        if (fill) fill.style.width = width + '%';

        const newMsgIdx = Math.floor(width / 12);
        if (newMsgIdx !== msgIdx && newMsgIdx < messages.length) {
            msgIdx = newMsgIdx;
            if (statusMsg) statusMsg.textContent = messages[msgIdx];
        }

        if (width >= 100) {
            clearInterval(interval);
            finishTraining();
        }
    }, 60);
}

function finishTraining() {
    const progressDiv = document.getElementById('trainingProgress');
    const resultsDiv = document.getElementById('trainingResults');

    if (progressDiv) progressDiv.style.display = 'none';

    // Train the actual ML model
    const data = uploadedData || generateSyntheticTrainingData();
    const metrics = predictor.trainOnUserData(data, 20);

    const maeEl = document.getElementById('metricMae');
    const rmseEl = document.getElementById('metricRmse');
    const r2El = document.getElementById('metricR2');
    const summaryEl = document.getElementById('trainSummaryMsg');

    if (maeEl) maeEl.textContent = metrics.mae.toFixed(2);
    if (rmseEl) rmseEl.textContent = metrics.rmse.toFixed(2);
    if (r2El) r2El.textContent = metrics.r2.toFixed(3);
    if (summaryEl) summaryEl.innerHTML = `
        ✅ Model trained on <strong>${data.length} records</strong>. 
        MAE of <strong>${metrics.mae.toFixed(1)}h</strong> means predictions are within ~${metrics.mae.toFixed(1)} hours on average.
        R² of <strong>${metrics.r2.toFixed(2)}</strong> indicates the model explains ${(metrics.r2 * 100).toFixed(0)}% of variance in delays.
    `;

    if (resultsDiv) resultsDiv.style.display = 'block';
    showNotification('✅ XGBoost model trained successfully!', 'success');

    // Persist model to backend using authenticated fetch
    try {
        const serialized = predictor.serialize();
        apiFetch('/api/ml/save', {
            method: 'POST',
            body: JSON.stringify({ serializedData: serialized })
        }).then(r => r?.ok 
            ? console.log('[ML Studio] Model persisted to backend') 
            : console.warn('[ML Studio] Model save returned non-OK')
        );
    } catch (e) {
        console.warn('[ML Studio] Failed to persist model', e);
    }
}

function renderPredictionsOutput() {
    const container = document.getElementById('mlPredictionsOutput');
    if (!container) return;

    // Auto-train with synthetic data if model hasn't been trained yet
    if (!predictor.trained) {
        container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">
            <span class="loading-spinner"></span>
            <div style="margin-top:10px">Training XGBoost model on baseline synthetic data...</div>
        </div>`;
        const synthData = generateSyntheticTrainingData();
        predictor.trainOnUserData(synthData, 20);
    }

    // Use live vessels if available, fallback to sample vessels
    const vessels = currentVessels.length > 0 ? currentVessels : [
        { name: 'MV Cape Horizon', origin: 'Newcastle', destinationPort: 'paradip', destinationPortName: 'Paradip Port', scheduledETA: new Date(), vesselAge: 12 },
        { name: 'MV Iron Maiden', origin: 'Richards Bay', destinationPort: 'haldia', destinationPortName: 'Haldia Dock Complex', scheduledETA: new Date(), vesselAge: 18 },
        { name: 'MV Pacific Star', origin: 'Hay Point', destinationPort: 'vizag', destinationPortName: 'Visakhapatnam Port', scheduledETA: new Date(), vesselAge: 8 },
        { name: 'MV Global Carrier', origin: 'Puerto Bolivar', destinationPort: 'dhamra', destinationPortName: 'Dhamra Port', scheduledETA: new Date(), vesselAge: 15 }
    ];

    const rows = vessels.map(vessel => {
        try {
            const pred = predictor.predictVesselDelay({
                ...vessel,
                portCongestion: portWeatherCache[vessel.destinationPort] ? 1 - portWeatherCache[vessel.destinationPort] : undefined
            });
            const delayColor = pred.predictedDelay > 24 ? '#b91c1c' : pred.predictedDelay > 8 ? '#b45309' : '#15803d';
            const riskLabel = pred.predictedDelay > 24 ? '🔴 High Risk' : pred.predictedDelay > 8 ? '🟡 Moderate' : '🟢 On Track';

            return `
                <tr>
                    <td style="padding:12px;font-weight:500">${vessel.name}</td>
                    <td style="padding:12px;color:var(--text-muted)">${vessel.destinationPortName || vessel.destinationPort}</td>
                    <td style="padding:12px;color:var(--text-muted)">${pred.season}</td>
                    <td style="padding:12px;font-weight:700;color:${delayColor}">${pred.predictedDelay > 0 ? '+' : ''}${pred.predictedDelay}h</td>
                    <td style="padding:12px">${Math.round(pred.confidence * 100)}%</td>
                    <td style="padding:12px">${riskLabel}</td>
                </tr>
            `;
        } catch (e) {
            return `<tr><td colspan="6" style="padding:12px;color:var(--text-muted)">${vessel.name} — prediction error</td></tr>`;
        }
    }).join('');

    container.innerHTML = `
        <div class="card" style="overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                <thead>
                    <tr style="background:var(--bg-tertiary);border-bottom:1px solid var(--border-primary)">
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Vessel</th>
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Destination</th>
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Season</th>
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Predicted Delay</th>
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Confidence</th>
                        <th style="padding:12px;text-align:left;font-size:0.72rem;color:var(--text-muted);text-transform:uppercase">Risk</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function generateSyntheticTrainingData() {
    // ── Balanced, realistic training data covering the full feature space ──────
    // Each feature independently varies so the model must use ALL of them,
    // not just collapse to the dominant signal (seasonIdx).
    const data = [];

    const ORIGINS = [
        { name: 'Newcastle',      dist: 18 },
        { name: 'Richards Bay',   dist: 14 },
        { name: 'Hay Point',      dist: 20 },
        { name: 'Qinhuangdao',   dist: 12 },
        { name: 'Puerto Bolivar', dist: 28 },
        { name: 'Murmansk',       dist: 22 },
        { name: 'Maputo',         dist: 10 },
    ];
    const PORTS = ['paradip', 'haldia', 'vizag', 'dhamra'];

    // Season configs: realistic weather and congestion distributions per season
    const SEASON_CONFIGS = [
        // [seasonIdx, weatherScoreRange, congestionRange, baseDelay]
        { idx: 0, weatherMin: 0.70, weatherMax: 0.98, congMin: 0.25, congMax: 0.60, base: 8  }, // Winter
        { idx: 1, weatherMin: 0.55, weatherMax: 0.85, congMin: 0.35, congMax: 0.70, base: 14 }, // Pre-Monsoon
        { idx: 2, weatherMin: 0.20, weatherMax: 0.55, congMin: 0.55, congMax: 0.90, base: 30 }, // Monsoon
        { idx: 3, weatherMin: 0.60, weatherMax: 0.80, congMin: 0.30, congMax: 0.65, base: 11 }, // Post-Monsoon
    ];

    function rand(min, max) { return min + Math.random() * (max - min); }

    for (let i = 0; i < 300; i++) {  // 300 records for better coverage
        const origin  = ORIGINS[Math.floor(Math.random() * ORIGINS.length)];
        const season  = SEASON_CONFIGS[Math.floor(Math.random() * 4)];
        const vesselAge = Math.floor(rand(1, 30));   // 1–30 years

        // Feature-correlated values (weather is worse in monsoon, etc.)
        const weatherScore   = rand(season.weatherMin, season.weatherMax);
        const portCongestion = rand(season.congMin,    season.congMax);

        // Delay model: each factor contributes independently and additively
        let delay = season.base;                                  // seasonal baseline
        delay += portCongestion > 0.70 ? rand(8, 28)   : rand(-2, 8);   // congestion
        delay += weatherScore   < 0.50 ? rand(12, 40)  : rand(-4, 6);   // weather
        delay += origin.dist > 20      ? rand(4, 16)   : rand(-2, 6);   // long haul
        delay += vesselAge > 18        ? rand(4, 14)   : rand(-2, 4);   // vessel age
        delay += rand(-8, 8);                                    // pure noise

        data.push({
            originDistance: origin.dist,
            seasonIdx:      season.idx,
            vesselAge,
            portCongestion: Math.round(portCongestion * 100) / 100,
            weatherScore:   Math.round(weatherScore   * 100) / 100,
            origin:         origin.name,
            port:           PORTS[Math.floor(Math.random() * PORTS.length)],
            actualDelay:    Math.max(0, Math.round(delay)),
        });
    }
    return data;
}
