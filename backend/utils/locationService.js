// Simple location service copied from frontend constants for backend enrichment
const PORTS = [
    { id: 'paradip', name: 'Paradip Port' },
    { id: 'haldia', name: 'Haldia Dock Complex' },
    { id: 'vizag', name: 'Visakhapatnam Port' },
    { id: 'dhamra', name: 'Dhamra Port' },
];

const PLANTS = [
    { id: 'bhilai', name: 'Bhilai Steel Plant' },
    { id: 'rourkela', name: 'Rourkela Steel Plant' },
    { id: 'bokaro', name: 'Bokaro Steel Plant' },
];

const RAIL_ROUTES = [
    { from: 'paradip', to: 'bhilai', distance: 680 },
    { from: 'paradip', to: 'rourkela', distance: 420 },
    { from: 'paradip', to: 'bokaro', distance: 550 },
    { from: 'haldia', to: 'bhilai', distance: 820 },
    { from: 'haldia', to: 'rourkela', distance: 490 },
    { from: 'haldia', to: 'bokaro', distance: 350 },
    { from: 'vizag', to: 'bhilai', distance: 750 },
    { from: 'vizag', to: 'rourkela', distance: 620 },
    { from: 'vizag', to: 'bokaro', distance: 900 },
    { from: 'dhamra', to: 'bhilai', distance: 720 },
    { from: 'dhamra', to: 'rourkela', distance: 380 },
    { from: 'dhamra', to: 'bokaro', distance: 480 },
];

function getPortName(id) {
    const p = PORTS.find(x => x.id === id);
    return p ? p.name : id;
}

function getPlantName(id) {
    const p = PLANTS.find(x => x.id === id);
    return p ? p.name : id;
}

function getRouteAlternatives(fromId) {
    return RAIL_ROUTES.filter(r => r.from === fromId).map(r => ({
        from: r.from,
        to: r.to,
        distance: r.distance,
        fromName: getPortName(r.from),
        toName: getPlantName(r.to)
    }));
}

module.exports = { getPortName, getPlantName, getRouteAlternatives };
