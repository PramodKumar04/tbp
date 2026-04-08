// ============================================================
// SteelSync-Opt — Utility Helpers
// ============================================================

/**
 * Seeded pseudo-random number generator (Mulberry32)
 */
export function createRNG(seed) {
    let s = seed | 0;
    return function () {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Random integer in [min, max] inclusive
 */
export function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Random float in [min, max)
 */
export function randFloat(rng, min, max) {
    return rng() * (max - min) + min;
}

/**
 * Pick random element from array
 */
export function randPick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

/**
 * Shuffle array (Fisher-Yates) using seeded RNG
 */
export function shuffle(rng, arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Add days to a date
 */
export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

/**
 * Add hours to a date
 */
export function addHours(date, hours) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

/**
 * Difference between two dates in days
 */
export function diffDays(a, b) {
    return (new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24);
}

/**
 * Difference between two dates in hours
 */
export function diffHours(a, b) {
    return (new Date(a) - new Date(b)) / (1000 * 60 * 60);
}

/**
 * Clamp value between min and max
 */
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Generate a unique ID
 */
let _idCounter = 0;
export function uid(prefix = 'id') {
    return `${prefix}_${++_idCounter}_${Date.now().toString(36)}`;
}

/**
 * Sum of array values
 */
export function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
}

/**
 * Average of array values
 */
export function avg(arr) {
    return arr.length ? sum(arr) / arr.length : 0;
}

/**
 * Group by key
 */
export function groupBy(arr, keyFn) {
    const map = {};
    for (const item of arr) {
        const key = typeof keyFn === 'string' ? item[keyFn] : keyFn(item);
        if (!map[key]) map[key] = [];
        map[key].push(item);
    }
    return map;
}

/**
 * Deep clone (simple)
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function
 */
export function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Generate date range array
 */
export function dateRange(start, days) {
    const dates = [];
    for (let i = 0; i < days; i++) {
        dates.push(addDays(start, i));
    }
    return dates;
}
