// ============================================================
// SteelSync-Opt — Industry Constants & Configuration
// ============================================================

export const PORTS = [
    {
        id: 'paradip',
        name: 'Paradip Port',
        state: 'Odisha',
        berths: 4,
        maxStockyard: 250000, // tons
        handlingRate: 12000,  // tons per day per berth
        handlingCost: 320,    // ₹ per ton
        lat: 20.2644,
        lng: 86.6085,
    },
    {
        id: 'haldia',
        name: 'Haldia Dock Complex',
        state: 'West Bengal',
        berths: 3,
        maxStockyard: 180000,
        handlingRate: 10000,
        handlingCost: 350,
        lat: 22.0257,
        lng: 88.0629,
    },
    {
        id: 'vizag',
        name: 'Visakhapatnam Port',
        state: 'Andhra Pradesh',
        berths: 5,
        maxStockyard: 300000,
        handlingRate: 14000,
        handlingCost: 300,
        lat: 17.6868,
        lng: 83.2185,
    },
    {
        id: 'dhamra',
        name: 'Dhamra Port',
        state: 'Odisha',
        berths: 2,
        maxStockyard: 200000,
        handlingRate: 15000,
        handlingCost: 280,
        lat: 20.7833,
        lng: 86.9500,
    },
];

export const PLANTS = [
    {
        id: 'bhilai',
        name: 'Bhilai Steel Plant',
        operator: 'SAIL',
        state: 'Chhattisgarh',
        dailyConsumption: { coal: 8000, iron_ore: 12000, limestone: 3000, dolomite: 1500 },
        safetyStockDays: 15,
        lat: 21.2094,
        lng: 81.3784,
    },
    {
        id: 'rourkela',
        name: 'Rourkela Steel Plant',
        operator: 'SAIL',
        state: 'Odisha',
        dailyConsumption: { coal: 6000, iron_ore: 9000, limestone: 2500, dolomite: 1200 },
        safetyStockDays: 12,
        lat: 22.2604,
        lng: 84.8536,
    },
    {
        id: 'bokaro',
        name: 'Bokaro Steel Plant',
        operator: 'SAIL',
        state: 'Jharkhand',
        dailyConsumption: { coal: 7000, iron_ore: 10000, limestone: 2800, dolomite: 1300 },
        safetyStockDays: 14,
        lat: 23.6693,
        lng: 86.1511,
    },
];

export const MATERIALS = [
    { id: 'coal', name: 'Coking Coal', color: '#374151', unit: 'MT', density: 1.1 },
    { id: 'iron_ore', name: 'Iron Ore', color: '#dc2626', unit: 'MT', density: 2.5 },
    { id: 'limestone', name: 'Limestone', color: '#d4d4d8', unit: 'MT', density: 1.6 },
    { id: 'dolomite', name: 'Dolomite', color: '#a78bfa', unit: 'MT', density: 1.5 },
];

export const VESSEL_NAMES = [
    'MV Cape Horizon', 'MV Iron Maiden', 'MV Pacific Star',
    'MV Global Carrier', 'MV Ocean Fortune', 'MV Asian Tiger',
    'MV Blue Marlin', 'MV Eastern Wind', 'MV Coal Emperor',
    'MV Golden Eagle', 'MV Sea Champion', 'MV Dragon Pearl',
    'MV Stellar Voyager', 'MV Navios Aurora', 'MV Bulk Prestige',
];

export const ORIGINS = [
    { name: 'Richards Bay', country: 'South Africa', avgDays: 14 },
    { name: 'Newcastle', country: 'Australia', avgDays: 18 },
    { name: 'Hay Point', country: 'Australia', avgDays: 20 },
    { name: 'Qinhuangdao', country: 'China', avgDays: 12 },
    { name: 'Puerto Bolivar', country: 'Colombia', avgDays: 28 },
    { name: 'Murmansk', country: 'Russia', avgDays: 22 },
    { name: 'Maputo', country: 'Mozambique', avgDays: 10 },
];

export const RAIL_ROUTES = [
    { from: 'paradip', to: 'bhilai', distance: 680, avgTime: 28, costPerTonKm: 1.8 },
    { from: 'paradip', to: 'rourkela', distance: 420, avgTime: 18, costPerTonKm: 1.9 },
    { from: 'paradip', to: 'bokaro', distance: 550, avgTime: 24, costPerTonKm: 1.7 },
    { from: 'haldia', to: 'bhilai', distance: 820, avgTime: 34, costPerTonKm: 1.6 },
    { from: 'haldia', to: 'rourkela', distance: 490, avgTime: 20, costPerTonKm: 1.8 },
    { from: 'haldia', to: 'bokaro', distance: 350, avgTime: 15, costPerTonKm: 2.0 },
    { from: 'vizag', to: 'bhilai', distance: 750, avgTime: 30, costPerTonKm: 1.7 },
    { from: 'vizag', to: 'rourkela', distance: 620, avgTime: 26, costPerTonKm: 1.8 },
    { from: 'vizag', to: 'bokaro', distance: 900, avgTime: 38, costPerTonKm: 1.6 },
    { from: 'dhamra', to: 'bhilai', distance: 720, avgTime: 30, costPerTonKm: 1.7 },
    { from: 'dhamra', to: 'rourkela', distance: 380, avgTime: 16, costPerTonKm: 1.9 },
    { from: 'dhamra', to: 'bokaro', distance: 480, avgTime: 20, costPerTonKm: 1.8 },
];

export const COST_PARAMS = {
    demurragePerDay: 25000,    // USD per day per vessel
    freightCostPerTon: 45,     // USD per ton (avg)
    usdToInr: 83.5,
    rakeCapacity: 3800,        // tons per rake (BOXN wagons × 58)
    maxRakesPerDay: 6,         // max rakes from a port per day
    berthingCost: 150000,      // ₹ per day per berth
    portStorageCost: 15,       // ₹ per ton per day
};

export const SEASONS = ['Winter', 'Pre-Monsoon', 'Monsoon', 'Post-Monsoon'];

export function getSeason(month) {
    if (month >= 11 || month <= 1) return 'Winter';
    if (month >= 2 && month <= 4) return 'Pre-Monsoon';
    if (month >= 5 && month <= 8) return 'Monsoon';
    return 'Post-Monsoon';
}

export const DELAY_FACTORS = {
    Monsoon: 1.4,
    'Post-Monsoon': 1.15,
    'Pre-Monsoon': 1.05,
    Winter: 1.0,
};

export const APP_CONFIG = {
    planningHorizon: 30,       // days
    refreshInterval: 30000,    // ms
    animationDuration: 600,    // ms
    chartColors: {
        primary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#8b5cf6',
        cyan: '#06b6d4',
        pink: '#ec4899',
        orange: '#f97316',
    },
};
