const fs = require('fs');

function generateSyntheticTrainingData() {
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

    const SEASON_CONFIGS = [
        { idx: 0, weatherMin: 0.70, weatherMax: 0.98, congMin: 0.25, congMax: 0.60, base: 8  },
        { idx: 1, weatherMin: 0.55, weatherMax: 0.85, congMin: 0.35, congMax: 0.70, base: 14 },
        { idx: 2, weatherMin: 0.20, weatherMax: 0.55, congMin: 0.55, congMax: 0.90, base: 30 },
        { idx: 3, weatherMin: 0.60, weatherMax: 0.80, congMin: 0.30, congMax: 0.65, base: 11 },
    ];

    function rand(min, max) { return min + Math.random() * (max - min); }

    for (let i = 0; i < 300; i++) {
        const origin  = ORIGINS[Math.floor(Math.random() * ORIGINS.length)];
        const season  = SEASON_CONFIGS[Math.floor(Math.random() * 4)];
        const vesselAge = Math.floor(rand(1, 30));

        const weatherScore   = rand(season.weatherMin, season.weatherMax);
        const portCongestion = rand(season.congMin,    season.congMax);

        let delay = season.base;
        delay += portCongestion > 0.70 ? rand(8, 28)   : rand(-2, 8);
        delay += weatherScore   < 0.50 ? rand(12, 40)  : rand(-4, 6);
        delay += origin.dist > 20      ? rand(4, 16)   : rand(-2, 6);
        delay += vesselAge > 18        ? rand(4, 14)   : rand(-2, 4);
        delay += rand(-8, 8);

        data.push({
            originDistance: origin.dist,
            seasonIdx:      season.idx,
            vesselAge:      vesselAge,
            portCongestion: Math.round(portCongestion * 100) / 100,
            weatherScore:   Math.round(weatherScore   * 100) / 100,
            origin:         origin.name,
            port:           PORTS[Math.floor(Math.random() * PORTS.length)],
            actualDelay:    Math.max(0, Math.round(delay)),
        });
    }
    return data;
}

const data = generateSyntheticTrainingData();
// Using nice headers so it simulates a real world file
const headers = ["Origin Distance", "Season Idx", "Vessel Age", "Port Congestion", "Weather Score", "Origin", "Port", "Actual Delay"];
const rows = data.map(d => Object.values(d).join(',')).join('\n');
fs.writeFileSync('synthetic_ml_data.csv', headers.join(',') + '\n' + rows);
console.log('Done');
