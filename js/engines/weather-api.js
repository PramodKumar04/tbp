// ============================================================
// SteelSync-Opt — Weather API Integration
// ============================================================
// Integration with Open-Meteo for Indian port locations

const PORT_COORDINATES = {
    'paradip': { lat: 20.26, lon: 86.67 },
    'haldia': { lat: 22.03, lon: 88.06 },
    'vizag': { lat: 17.68, lon: 83.21 },
    'dhamra': { lat: 20.78, lon: 86.96 }
};

export class WeatherAPI {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    async getWeather(portId) {
        const portIdLower = portId.toLowerCase();
        if (this.cache.has(portIdLower)) {
            const cached = this.cache.get(portIdLower);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        const coords = PORT_COORDINATES[portIdLower];
        if (!coords) {
            throw new Error(`Unknown port: ${portId}`);
        }

        // Open-Meteo free API
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=auto`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('API fetch failed');

            const data = await response.json();
            // Log raw response for debugging property names
            console.debug('[Weather API] Open-Meteo response:', data);

            // Open-Meteo may use either `wind_speed_10m` or `windspeed_10m` depending on endpoint
            const current = data.current || {};
            const windSpeed = current.wind_speed_10m ?? current.windspeed_10m ?? (data.hourly && data.hourly.windspeed_10m && data.hourly.windspeed_10m[0]) ?? 0;
            const precipitation = current.precipitation ?? (data.hourly && data.hourly.precipitation && data.hourly.precipitation[0]) ?? 0;
            const weatherCode = current.weather_code ?? current.weathercode ?? (data.current && data.current.weathercode) ?? 0;

            const weatherData = {
                windSpeed, // km/h
                precipitation, // mm
                weatherCode,
                score: this.calculateWeatherScore(windSpeed, precipitation, weatherCode),
                timestamp: Date.now(),
                raw: current,
            };

            this.cache.set(portIdLower, { timestamp: Date.now(), data: weatherData });
            return weatherData;

        } catch (error) {
            console.warn(`[Weather API] Failed to fetch for ${portId}:`, error);
            // Fallback
            return {
                windSpeed: 20,
                precipitation: 0,
                score: 0.7,
                error: true
            };
        }
    }

    calculateWeatherScore(windSpeed, precipitation, weatherCode) {
        // More sensitive scoring for moderate wind/rain
        let score = 1.0;

        if (windSpeed > 40) score -= 0.5;
        else if (windSpeed > 25) score -= 0.3;
        else if (windSpeed > 15) score -= 0.15;

        if (precipitation > 10) score -= 0.4;
        else if (precipitation > 5) score -= 0.25;
        else if (precipitation > 0) score -= 0.1;

        if (weatherCode >= 95) score -= 0.6; // Thunderstorm
        else if (weatherCode >= 80) score -= 0.35; // Heavy rain/showers
        else if (weatherCode >= 60) score -= 0.25; // Rain

        return Math.max(0.05, Math.min(1.0, score));
    }
}

export const weatherApi = new WeatherAPI();
