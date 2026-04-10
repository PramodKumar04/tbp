// ============================================================
// SteelSync-Opt — ML Delay Prediction Engine
// ============================================================
// XGBoost-style Gradient Boosting with proper feature engineering

import { avg } from '../utils/helpers.js';
import { DELAY_FACTORS } from '../data/constants.js';

// ── Feature Normalization Ranges (learned from domain knowledge) ──────────────
// These allow the gradient boosting trees to compare features on a common scale.
const FEATURE_RANGES = {
    originDistance: { min: 10, max: 28 },
    seasonIdx:      { min: 0,  max: 3  },
    vesselAge:      { min: 0,  max: 30 },
    portCongestion: { min: 0,  max: 1  },
    weatherScore:   { min: 0,  max: 1  },
};

function normalizeFeature(key, value) {
    const range = FEATURE_RANGES[key];
    if (!range || range.max === range.min) return value;
    return (value - range.min) / (range.max - range.min);
}

function normalizeFeatures(f) {
    const out = {};
    for (const key of Object.keys(f)) {
        out[key] = normalizeFeature(key, f[key]);
    }
    return out;
}

/**
 * A single decision tree node
 */
class DecisionNode {
    constructor(feature, threshold, left, right, value = null) {
        this.feature   = feature;
        this.threshold = threshold;
        this.left      = left;
        this.right     = right;
        this.value     = value;
    }

    predict(features) {
        if (this.value !== null) return this.value;
        return features[this.feature] <= this.threshold
            ? this.left.predict(features)
            : this.right.predict(features);
    }

    serialize() {
        return {
            f: this.feature,
            t: this.threshold,
            l: this.left  ? this.left.serialize()  : null,
            r: this.right ? this.right.serialize() : null,
            v: this.value,
        };
    }

    static deserialize(obj) {
        if (!obj) return null;
        return new DecisionNode(
            obj.f, obj.t,
            obj.l ? DecisionNode.deserialize(obj.l) : null,
            obj.r ? DecisionNode.deserialize(obj.r) : null,
            obj.v,
        );
    }
}

/**
 * Build a regression tree on (normalized) feature data.
 * maxDepth ≥ 5 lets the tree capture interaction effects.
 */
function buildTree(data, features, depth = 0, maxDepth = 6) {
    // Leaf condition
    if (data.length < 4 || depth >= maxDepth) {
        return new DecisionNode(null, null, null, null,
            avg(data.map(d => d.actualDelay)));
    }

    let bestFeature = null, bestThreshold = null;
    let bestScore   = Infinity;
    let bestLeft    = [], bestRight = [];

    for (const feature of features) {
        // Use normalized values for splitting
        const values = [...new Set(data.map(d => d._norm[feature]))]
            .filter(v => typeof v === 'number' && !isNaN(v))
            .sort((a, b) => a - b);

        if (values.length < 2) continue;

        // Candidate thresholds: midpoints between consecutive distinct values
        for (let i = 0; i < values.length - 1; i++) {
            const threshold = (values[i] + values[i + 1]) / 2;
            const left  = data.filter(d => d._norm[feature] <= threshold);
            const right = data.filter(d => d._norm[feature] >  threshold);

            if (left.length < 2 || right.length < 2) continue;

            const leftMean  = avg(left.map(d  => d.actualDelay));
            const rightMean = avg(right.map(d => d.actualDelay));

            const score =
                left.reduce((s, d)  => s + (d.actualDelay - leftMean)  ** 2, 0) +
                right.reduce((s, d) => s + (d.actualDelay - rightMean) ** 2, 0);

            if (score < bestScore) {
                bestScore     = score;
                bestFeature   = feature;
                bestThreshold = threshold;
                bestLeft      = left;
                bestRight     = right;
            }
        }
    }

    if (!bestFeature) {
        return new DecisionNode(null, null, null, null,
            avg(data.map(d => d.actualDelay)));
    }

    return new DecisionNode(
        bestFeature,
        bestThreshold,
        buildTree(bestLeft,  features, depth + 1, maxDepth),
        buildTree(bestRight, features, depth + 1, maxDepth),
    );
}

/**
 * XGBoost-style Delay Predictor (Gradient Boosting Ensemble)
 */
export class DelayPredictor {
    constructor() {
        this.trees          = [];
        this.learningRate   = 0.12;  // XGBoost Eta — slightly conservative for stability
        this.features       = ['originDistance', 'seasonIdx', 'vesselAge', 'portCongestion', 'weatherScore'];
        this.basePrediction = 0;
        this.trained        = false;

        // Learned statistics — populated after training
        this._trainStats = {
            meanDelay:       0,
            stdDelay:        0,
            featureImportance: {},
            sampleCount:     0,
        };
    }

    // ── Core Training ────────────────────────────────────────────

    /**
     * Train the ensemble using Gradient Boosting (XGBoost-style)
     * @param {Array}  historicalData  - cleaned records with actualDelay + feature fields
     * @param {number} numTrees        - number of boosting rounds
     */
    train(historicalData, numTrees = 25) {
        if (!historicalData || historicalData.length === 0) return;

        // Attach normalized versions to every record
        const preparedData = historicalData.map(d => ({
            ...d,
            _norm: normalizeFeatures({
                originDistance: d.originDistance ?? 15,
                seasonIdx:      d.seasonIdx      ?? 2,
                vesselAge:      d.vesselAge      ?? 10,
                portCongestion: d.portCongestion ?? 0.5,
                weatherScore:   d.weatherScore   ?? 0.7,
            }),
        }));

        const delays = preparedData.map(d => d.actualDelay);
        this.basePrediction = avg(delays);
        this._trainStats.meanDelay   = this.basePrediction;
        this._trainStats.stdDelay    = Math.sqrt(
            avg(delays.map(d => (d - this.basePrediction) ** 2))
        );
        this._trainStats.sampleCount = preparedData.length;
        this.trees = [];

        // Gradient boosting loop
        let currentPredictions = preparedData.map(() => this.basePrediction);

        for (let t = 0; t < numTrees; t++) {
            // Residuals = negative gradient of MSE loss
            const residualData = preparedData.map((d, i) => ({
                ...d,
                actualDelay: d.actualDelay - currentPredictions[i], // residual
            }));

            // Column subsampling (80 %) — standard XGBoost trick
            const numCols     = Math.ceil(this.features.length * 0.8);
            const subFeatures = [...this.features]
                .sort(() => Math.random() - 0.5)
                .slice(0, numCols);

            // fit deeper stumps (depth 6) for better interaction capture
            const tree = buildTree(residualData, subFeatures, 0, 6);
            this.trees.push(tree);

            // Update predictions
            currentPredictions = currentPredictions.map((pred, i) => {
                const correction = tree.predict(preparedData[i]._norm);
                // Mild clipping: allow ±stdDev per tree to prevent explosion
                const clip = Math.max(1, this._trainStats.stdDelay);
                return pred + this.learningRate * Math.max(-clip, Math.min(correction, clip));
            });
        }

        // Compute feature importance (mean |residual reduction| per split feature)
        this._trainStats.featureImportance = this._computeFeatureImportance();

        this.trained = true;
        console.log(
            `[XGBoost Engine] Trained ${numTrees} trees on ${preparedData.length} records.` +
            ` Base: ${this.basePrediction.toFixed(2)}h | StdDev: ${this._trainStats.stdDelay.toFixed(2)}h`
        );
    }

    // ── Public API (used by ML Studio) ───────────────────────────

    /**
     * Train on user (or synthetic) data with 80/20 train-test split.
     * Returns evaluation metrics: MAE, RMSE, R².
     */
    trainOnUserData(uploadedHistoricalData, numTrees = 25) {
        if (!uploadedHistoricalData || uploadedHistoricalData.length === 0) {
            return { mae: 0, rmse: 0, r2: 0 };
        }

        // Robust preprocessing
        const cleanData = uploadedHistoricalData
            .map(d => ({
                ...d,
                actualDelay:    isFinite(Number(d.actualDelay))    ? Number(d.actualDelay)    : 0,
                originDistance: isFinite(Number(d.originDistance)) ? Number(d.originDistance) : this._getOriginDistance(d.origin),
                portCongestion: isFinite(Number(d.portCongestion)) ? Number(d.portCongestion) : 0.5,
                weatherScore:   isFinite(Number(d.weatherScore))   ? Number(d.weatherScore)   : 0.7,
                vesselAge:      isFinite(Number(d.vesselAge))      ? Number(d.vesselAge)      : 10,
                seasonIdx:      isFinite(Number(d.seasonIdx))      ? Number(d.seasonIdx)      : 2,
            }))
            .filter(d => d.actualDelay >= 0);

        if (cleanData.length < 5) {
            console.warn('[Predictor] Insufficient data:', cleanData.length);
            return { mae: 0, rmse: 0, r2: 0 };
        }

        // Shuffle and split
        const shuffled  = [...cleanData].sort(() => Math.random() - 0.5);
        const splitIdx  = Math.max(1, Math.floor(shuffled.length * 0.8));
        const trainData = shuffled.slice(0, splitIdx);
        const testData  = shuffled.slice(splitIdx);

        this.train(trainData, numTrees);

        // Evaluate on held-out test set
        let sumAbsErr = 0, sumSqErr = 0;
        for (const record of testData) {
            let predicted = this.basePrediction;
            try {
                if (this.trained) {
                    predicted = this.predictVesselDelay(record).predictedDelay;
                }
            } catch (_) { /* keep basePrediction */ }

            const error = predicted - record.actualDelay;
            sumAbsErr  += Math.abs(error);
            sumSqErr   += error * error;
        }

        const count      = testData.length || 1;
        const meanActual = avg(testData.map(r => r.actualDelay));
        let   tss        = testData.reduce((s, r) => s + (r.actualDelay - meanActual) ** 2, 0);
        if (tss === 0) tss = 0.001;

        const mae  = sumAbsErr / count;
        const rmse = Math.sqrt(sumSqErr / count);
        const r2   = Math.max(0, Math.min(1, 1 - sumSqErr / tss));

        return {
            mae:  Math.round(mae  * 100) / 100,
            rmse: Math.round(rmse * 100) / 100,
            r2:   Math.round(r2   * 1000) / 1000,
        };
    }

    // ── Prediction Methods ───────────────────────────────────────

    /**
     * Predict delay for a single vessel record.
     * All vessel properties are used to build a rich feature vector.
     */
    predictVesselDelay(vessel) {
        if (!this.trained) throw new Error('Model not trained');

        const SEASON_MAP = { Winter: 0, 'Pre-Monsoon': 1, Monsoon: 2, 'Post-Monsoon': 3 };

        const month  = new Date(vessel.scheduledETA || Date.now()).getMonth();
        const season =
            month >= 11 || month <= 1  ? 'Winter'       :
            month >= 2  && month <= 4  ? 'Pre-Monsoon'  :
            month >= 5  && month <= 8  ? 'Monsoon'       : 'Post-Monsoon';

        // Build raw feature vector — prefer vessel-supplied fields, then defaults
        const raw = {
            originDistance: vessel.originDistance ?? this._getOriginDistance(vessel.origin),
            seasonIdx:      vessel.seasonIdx      ?? SEASON_MAP[season],
            vesselAge:      vessel.vesselAge      ?? 10,
            portCongestion: vessel.portCongestion ?? this._getPortCongestion(vessel.destinationPort),
            weatherScore:   vessel.weatherScore   ?? this._getWeatherScore(season),
        };

        // Normalize for tree prediction (same normalization used during training)
        const normFeatures = normalizeFeatures(raw);

        // Gradient boosting prediction: base + sum of all tree corrections
        let prediction = this.basePrediction;

        for (const tree of this.trees) {
            const correction = tree.predict(normFeatures);
            // Use per-tree stdDev clipping to prevent runaway predictions
            const clip = Math.max(1, this._trainStats.stdDelay);
            prediction += this.learningRate * Math.max(-clip, Math.min(correction, clip));
        }

        // Hard bounds: [0, 300] hours — physically realistic for bulk carrier routes
        prediction = Math.max(0, Math.min(prediction, 300));

        // --- 🟢 Dynamic Confidence Calculation ---
        // Instead of a static number, we calculate a "Certainty Factor"
        // 1. Base confidence from ensemble size
        const baseEnsembleConfidence = 0.65 + (this.trees.length * 0.01);
        
        // 2. Feature Outlier Penalty: Reduce confidence if features are at extreme ends
        let outlierPenalty = 0;
        for (const key in normFeatures) {
            const val = normFeatures[key];
            // If feature is at the extreme 10% on either side, apply penalty
            if (val < 0.1 || val > 0.9) {
                outlierPenalty += 0.04;
            }
        }

        // 3. Volatility Check: Confidence is lower if predictions are extremely high/low
        const volatilityPenalty = Math.abs(prediction - this.basePrediction) / (this._trainStats.stdDelay * 5 || 50);
        
        const finalConfidence = Math.max(0.60, Math.min(0.98, baseEnsembleConfidence - outlierPenalty - volatilityPenalty));

        // Build a human-readable factors list for the UI
        const factors = this._buildFactors(raw, season);

        return {
            predictedDelay: Math.round(prediction * 10) / 10,
            confidence:     Math.round(finalConfidence * 100) / 100,
            season,
            factors,
            rawFeatures: raw,
        };
    }

    /**
     * Heuristic train delay predictor (no ML training required).
     * Uses distance, time-of-day and day-of-week signals.
     */
    predictTrainDelay(rake) {
        const distance   = rake.distance || 500;
        const timeOfDay  = new Date(rake.departure || Date.now()).getHours();
        const dayOfWeek  = new Date(rake.departure || Date.now()).getDay();

        // Base: 1 hour per 100 km at average rail speed
        let delay = distance / 100;

        // Peak-hour multipliers
        if (timeOfDay >= 7  && timeOfDay <= 10) delay *= 1.30;
        if (timeOfDay >= 17 && timeOfDay <= 20) delay *= 1.25;

        // Weekends have less congestion
        if (dayOfWeek === 0 || dayOfWeek === 6) delay *= 0.85;

        // Add stochastic noise proportional to distance
        delay += (Math.random() - 0.5) * (distance / 200);

        delay = Math.max(0, delay);

        return {
            predictedDelay: Math.round(delay * 10) / 10,
            confidence:     0.75,
            factors:        [],
        };
    }

    // ── Serialization ─────────────────────────────────────────────

    serialize() {
        return {
            trees:          this.trees.map(t => t.serialize()),
            basePrediction: this.basePrediction,
            learningRate:   this.learningRate,
            trained:        this.trained,
            trainStats:     this._trainStats,
        };
    }

    deserialize(data) {
        if (!data || !data.trees) return false;
        try {
            this.trees          = data.trees.map(t => DecisionNode.deserialize(t));
            this.basePrediction = data.basePrediction || 0;
            this.learningRate   = data.learningRate   || 0.12;
            this.trained        = data.trained        || false;
            this._trainStats    = data.trainStats     || this._trainStats;
            return true;
        } catch (e) {
            console.error('[Predictor] Deserialization failed', e);
            return false;
        }
    }

    // ── Model Constraints (DYNAMIC — derived from trained model) ─────────────

    /**
     * Extract digestible constraints from the *trained* model.
     * These feed into the optimizer for realistic cost calculations.
     */
    getConstraints() {
        if (!this.trained) return null;

        const stats = this._trainStats;

        // monsoonPenalty: how much the model increases delay in Monsoon vs Winter
        // Approximated by predicting a median Monsoon vs Winter vessel
        const monsoonPrediction = this._predictNormalized({
            originDistance: 0.45, seasonIdx: 1.0, vesselAge: 0.33,
            portCongestion: 0.65, weatherScore: 0.2,         // bad weather = low score
        });
        const winterPrediction = this._predictNormalized({
            originDistance: 0.45, seasonIdx: 0.0, vesselAge: 0.33,
            portCongestion: 0.35, weatherScore: 0.85,
        });
        const monsoonPenalty = winterPrediction > 0
            ? Math.max(1.0, Math.min(2.5, monsoonPrediction / winterPrediction))
            : 1.4;

        // weatherRiskFactor: sensitivity to a 1-std-dev worse weather score
        const goodWeather = this._predictNormalized({
            originDistance: 0.45, seasonIdx: 0.5, vesselAge: 0.33,
            portCongestion: 0.5,  weatherScore: 0.8,
        });
        const badWeather = this._predictNormalized({
            originDistance: 0.45, seasonIdx: 0.5, vesselAge: 0.33,
            portCongestion: 0.5,  weatherScore: 0.3,
        });
        const weatherRiskFactor = goodWeather > 0
            ? Math.max(1.0, Math.min(2.0, badWeather / goodWeather))
            : 1.3;

        return {
            monsoonPenalty:        Math.round(monsoonPenalty    * 100) / 100,
            congestionWeight:      Math.round(
                (this._trainStats.featureImportance?.portCongestion || 0.25) * 100
            ) / 100,
            weatherRiskFactor:     Math.round(weatherRiskFactor * 100) / 100,
            vesselAgeThreshold:    15,
            confidenceLevel:       Math.min(0.95, 0.60 + this.trees.length * 0.013),
            meanTrainedDelay:      Math.round(stats.meanDelay * 10) / 10,
            stdTrainedDelay:       Math.round(stats.stdDelay  * 10) / 10,
            lastTrained:           new Date().toISOString(),
        };
    }

    // ── Private Helpers ───────────────────────────────────────────

    /**
     * Predict using already-normalized features (used internally for getConstraints).
     */
    _predictNormalized(normFeatures) {
        let prediction = this.basePrediction;
        for (const tree of this.trees) {
            const correction = tree.predict(normFeatures);
            const clip = Math.max(1, this._trainStats.stdDelay);
            prediction += this.learningRate * Math.max(-clip, Math.min(correction, clip));
        }
        return Math.max(0, Math.min(prediction, 300));
    }

    _getOriginDistance(originName) {
        const distances = {
            'Richards Bay':   14,
            'Newcastle':      18,
            'Hay Point':      20,
            'Qinhuangdao':    12,
            'Puerto Bolivar': 28,
            'Murmansk':       22,
            'Maputo':         10,
        };
        return distances[originName] ?? 15;
    }

    _getPortCongestion(portId) {
        const congestion = {
            paradip: 0.65,
            haldia:  0.78,
            vizag:   0.55,
            dhamra:  0.45,
        };
        return congestion[portId] ?? 0.5;
    }

    _getWeatherScore(season) {
        const scores = {
            'Winter':      0.85,
            'Pre-Monsoon': 0.70,
            'Monsoon':     0.35,
            'Post-Monsoon': 0.72,
        };
        return scores[season] ?? 0.70;
    }

    _buildFactors(raw, season) {
        const factors = [];
        if (raw.seasonIdx >= 2) {
            factors.push({ label: `${season} season`, impact: 'high', direction: 'negative' });
        }
        if (raw.portCongestion > 0.65) {
            factors.push({ label: 'Port congestion', impact: 'medium', direction: 'negative' });
        }
        if (raw.weatherScore < 0.5) {
            factors.push({ label: 'Poor weather conditions', impact: 'high', direction: 'negative' });
        }
        if (raw.vesselAge > 15) {
            factors.push({ label: 'Older vessel', impact: 'low', direction: 'negative' });
        }
        if (raw.originDistance > 20) {
            factors.push({ label: 'Long haul route', impact: 'medium', direction: 'negative' });
        }
        return factors;
    }

    /**
     * Compute crude feature importance: count how many tree splits use each feature.
     */
    _computeFeatureImportance() {
        const counts = {};
        for (const feat of this.features) counts[feat] = 0;
        let total = 0;

        const countNode = (node) => {
            if (!node || node.value !== null) return;
            if (node.feature && counts[node.feature] !== undefined) {
                counts[node.feature]++;
                total++;
            }
            countNode(node.left);
            countNode(node.right);
        };

        for (const tree of this.trees) countNode(tree);

        const importance = {};
        for (const feat of this.features) {
            importance[feat] = total > 0 ? Math.round((counts[feat] / total) * 1000) / 1000 : 0;
        }
        return importance;
    }
}

// Singleton instance
export const predictor = new DelayPredictor();