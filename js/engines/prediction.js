// ============================================================
// SteelSync-Opt — ML Delay Prediction Engine
// ============================================================
// Simplified decision tree ensemble for browser-based prediction

import { avg } from '../utils/helpers.js';
import { DELAY_FACTORS } from '../data/constants.js';

/**
 * A single decision tree node
 */
class DecisionNode {
    constructor(feature, threshold, left, right, value = null) {
        this.feature = feature;
        this.threshold = threshold;
        this.left = left;
        this.right = right;
        this.value = value; // Leaf value (prediction)
    }

    predict(features) {
        if (this.value !== null) return this.value;
        return features[this.feature] <= this.threshold
            ? this.left.predict(features)
            : this.right.predict(features);
    }
}

/**
 * Build a simple decision tree from training data
 */
function buildTree(data, features, depth = 0, maxDepth = 5) {
    if (data.length < 5 || depth >= maxDepth) {
        const avgDelay = avg(data.map(d => d.actualDelay));
        return new DecisionNode(null, null, null, null, avgDelay);
    }

    let bestFeature = null, bestThreshold = null, bestScore = Infinity;
    let bestLeft = [], bestRight = [];

    for (const feature of features) {
        const values = [...new Set(data.map(d => d[feature]))].sort((a, b) => a - b);
        const thresholds = [];
        for (let i = 0; i < values.length - 1; i++) {
            thresholds.push((values[i] + values[i + 1]) / 2);
        }

        for (const threshold of thresholds) {
            const left = data.filter(d => d[feature] <= threshold);
            const right = data.filter(d => d[feature] > threshold);
            if (left.length < 2 || right.length < 2) continue;

            const leftMean = avg(left.map(d => d.actualDelay));
            const rightMean = avg(right.map(d => d.actualDelay));

            const score =
                left.reduce((s, d) => s + (d.actualDelay - leftMean) ** 2, 0) +
                right.reduce((s, d) => s + (d.actualDelay - rightMean) ** 2, 0);

            if (score < bestScore) {
                bestScore = score;
                bestFeature = feature;
                bestThreshold = threshold;
                bestLeft = left;
                bestRight = right;
            }
        }
    }

    if (!bestFeature) {
        return new DecisionNode(null, null, null, null, avg(data.map(d => d.actualDelay)));
    }

    return new DecisionNode(
        bestFeature,
        bestThreshold,
        buildTree(bestLeft, features, depth + 1, maxDepth),
        buildTree(bestRight, features, depth + 1, maxDepth),
    );
}

/**
 * Random Forest (simplified ensemble of decision trees)
 */
export class DelayPredictor {
    constructor() {
        this.trees = [];
        this.features = ['originDistance', 'seasonIdx', 'vesselAge', 'portCongestion', 'weatherScore'];
        this.trained = false;
    }

    /**
     * Train the ensemble on historical data
     */
    train(historicalData, numTrees = 7) {
        this.trees = [];

        for (let t = 0; t < numTrees; t++) {
            // Bootstrap sample (with replacement)
            const sample = [];
            for (let i = 0; i < historicalData.length; i++) {
                const idx = Math.floor(Math.random() * historicalData.length);
                sample.push(historicalData[idx]);
            }

            // Random feature subset (sqrt of total features)
            const numFeatures = Math.ceil(Math.sqrt(this.features.length));
            const shuffled = [...this.features].sort(() => Math.random() - 0.5);
            const subsetFeatures = shuffled.slice(0, numFeatures);

            const tree = buildTree(sample, subsetFeatures, 0, 4 + Math.floor(Math.random() * 2));
            this.trees.push(tree);
        }

        this.trained = true;
        console.log(`[Prediction Engine] Trained ${numTrees} decision trees on ${historicalData.length} records`);
    }

    /**
     * Predict vessel delay
     */
    predictVesselDelay(vessel) {
        if (!this.trained) throw new Error('Model not trained');

        const SEASON_MAP = { Winter: 0, 'Pre-Monsoon': 1, Monsoon: 2, 'Post-Monsoon': 3 };

        const month = new Date(vessel.scheduledETA).getMonth();
        const season = month >= 11 || month <= 1 ? 'Winter' :
            month >= 2 && month <= 4 ? 'Pre-Monsoon' :
            month >= 5 && month <= 8 ? 'Monsoon' : 'Post-Monsoon';

        const features = {
            originDistance: this._getOriginDistance(vessel.origin),
            seasonIdx: SEASON_MAP[season],
            vesselAge: vessel.vesselAge || 10,
            portCongestion: this._getPortCongestion(vessel.destinationPort),
            weatherScore: this._getWeatherScore(season),
        };

        const predictions = this.trees.map(tree => tree.predict(features));
        const predicted = avg(predictions);

        // Confidence based on tree agreement
        const stdDev = Math.sqrt(avg(predictions.map(p => (p - predicted) ** 2)));
        const confidence = Math.max(0, Math.min(1, 1 - stdDev / (Math.abs(predicted) + 10)));

        // Key factors
        const factors = [];
        if (season === 'Monsoon') factors.push({ name: 'Monsoon Season', impact: 'high', direction: 'increase' });
        if (vessel.vesselAge > 15) factors.push({ name: 'Aging Vessel', impact: 'medium', direction: 'increase' });
        if (features.portCongestion > 0.7) factors.push({ name: 'Port Congestion', impact: 'high', direction: 'increase' });
        if (features.weatherScore < 0.5) factors.push({ name: 'Adverse Weather', impact: 'high', direction: 'increase' });
        if (features.originDistance > 18) factors.push({ name: 'Long Voyage', impact: 'medium', direction: 'increase' });

        return {
            predictedDelay: Math.round(predicted * 10) / 10,
            confidence: Math.round(confidence * 100) / 100,
            season,
            factors,
            treeOutputs: predictions.map(p => Math.round(p * 10) / 10),
        };
    }

    /**
     * Predict train delay (simpler model)
     */
    predictTrainDelay(rake) {
        const baseDelay = rake.distance / 100; // longer distance = more delay
        const timeOfDay = new Date(rake.departure).getHours();
        const dayOfWeek = new Date(rake.departure).getDay();

        // Peak hours and weekend effects
        let delay = baseDelay;
        if (timeOfDay >= 7 && timeOfDay <= 10) delay *= 1.3;
        if (timeOfDay >= 17 && timeOfDay <= 20) delay *= 1.25;
        if (dayOfWeek === 0 || dayOfWeek === 6) delay *= 0.85;

        // Add noise
        delay += (Math.random() - 0.3) * 3;
        delay = Math.max(-2, delay);

        const confidence = 0.75 + Math.random() * 0.2;

        return {
            predictedDelay: Math.round(delay * 10) / 10,
            confidence: Math.round(confidence * 100) / 100,
            factors: [
                ...(delay > 4 ? [{ name: 'Section Congestion', impact: 'medium', direction: 'increase' }] : []),
                ...(timeOfDay >= 7 && timeOfDay <= 10 ? [{ name: 'Peak Hours', impact: 'low', direction: 'increase' }] : []),
            ],
        };
    }

    _getOriginDistance(originName) {
        const distances = {
            'Richards Bay': 14, Newcastle: 18, 'Hay Point': 20,
            Qinhuangdao: 12, 'Puerto Bolivar': 28, Murmansk: 22, Maputo: 10,
        };
        return distances[originName] || 15;
    }

    _getPortCongestion(portId) {
        // Simulated congestion levels
        const congestion = { paradip: 0.65, haldia: 0.78, vizag: 0.55, dhamra: 0.45 };
        return congestion[portId] || 0.5;
    }

    _getWeatherScore(season) {
        const scores = { Winter: 0.85, 'Pre-Monsoon': 0.7, Monsoon: 0.4, 'Post-Monsoon': 0.75 };
        return scores[season] || 0.7;
    }
}

// Singleton instance
export const predictor = new DelayPredictor();
