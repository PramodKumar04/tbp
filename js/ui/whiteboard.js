// ============================================================
// SteelSync-Opt — Network Whiteboard (Visual Network Designer)
// ============================================================
// DOM-based nodes + SVG edges for polished SC Navigator look
//
// Features:
//   - Drag & drop node types from palette onto canvas
//   - Click-to-link nodes, drag to reposition
//   - Inline-editable transport data table
//   - Download as Excel (.xlsx) via SheetJS
//   - Double-click node to edit properties

import { uid } from '../utils/helpers.js';

// ── Node Type Definitions ───────────────────────────────
const NODE_TYPES = {
    supplier_port: {
        label: 'Supplier Port',
        shortLabel: 'Port',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="2"><path d="M3 17h4V7L12 2l5 5v10h4"/><circle cx="12" cy="14" r="3"/><path d="M12 17v4"/></svg>`,
        color: '#991b1b',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    plant: {
        label: 'Plant',
        shortLabel: 'Plant',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><path d="M3 21h18M3 7v14m4-14v14m4-8v8m4-12v12m4-16v16"/></svg>`,
        color: '#1e40af',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    supplier: {
        label: 'Supplier',
        shortLabel: 'Supplier',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9a3412" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>`,
        color: '#9a3412',
        bgColor: '#fff7ed',
        borderColor: '#fed7aa',
    },
    production: {
        label: 'Production',
        shortLabel: 'Prod',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5b21b6" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/><path d="M12 11v4"/></svg>`,
        color: '#5b21b6',
        bgColor: '#f5f3ff',
        borderColor: '#ddd6fe',
    },
    warehouse: {
        label: 'Warehouse',
        shortLabel: 'WH',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/></svg>`,
        color: '#065f46',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0',
    },
    customer: {
        label: 'Customer',
        shortLabel: 'Cust',
        iconSVG: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#155e75" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
        color: '#155e75',
        bgColor: '#ecfeff',
        borderColor: '#a5f3fc',
    },
};

const EDGE_LABELS = {
    supplier_port_plant: 'Inbound_RM',
    supplier_port_production: 'Inbound_RM',
    supplier_port_warehouse: 'Inbound_RM',
    supplier_plant: 'Inbound_RM',
    supplier_production: 'Inbound',
    supplier_warehouse: 'Inbound',
    plant_warehouse: 'Interresource',
    plant_customer: 'FTL',
    production_warehouse: 'Interresource',
    production_customer: 'Outbound',
    warehouse_customer: 'FTL',
    production_production: 'Interresource',
    warehouse_warehouse: 'Interresource',
    plant_plant: 'Interresource',
    warehouse_plant: 'Interresource',
    production_plant: 'Interresource',
    supplier_port_customer: 'Inbound_FG',
};

const TRANSPORT_MODES = ['Inbound', 'Inbound_RM', 'Inbound_FG', 'Interresource', 'FTL', 'LTL', 'Rail', 'Road', 'Sea'];
const PRODUCT_GROUPS = [
    'Raw Material Group',
    'Finished Product Group',
    'Coking Coal',
    'Iron Ore',
    'Limestone',
    'Dolomite',
    'Semi-Finished',
];

// ── Whiteboard Class ────────────────────────────────────
export class NetworkWhiteboard {
    constructor(containerId) {
        this.containerId = containerId;
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.linkingFrom = null;
        this.onDataChange = null;
        this.onClose = null;
        this._container = null;
        this._svgEl = null;
        this._nodesLayer = null;

        // Drag state — managed at class level
        this._dragNode = null;
        this._dragEl = null;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._dragOrigX = 0;
        this._dragOrigY = 0;
        this._didDrag = false;

        // Palette drag state
        this._paletteDragType = null;
        this._paletteDragGhost = null;

        // Bound handlers (so we can remove them later)
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onPaletteDragMove = this._onPaletteDragMove.bind(this);
        this._onPaletteDragEnd = this._onPaletteDragEnd.bind(this);
    }

    init(container) {
        this._container = container;
        container.innerHTML = this._buildHTML();
        this._svgEl = container.querySelector('#wbEdgeSVG');
        this._nodesLayer = container.querySelector('#wbNodesLayer');
        this._bindEvents(container);
        return this;
    }

    // ═══════════════════════════════════════════════════════
    // HTML Template
    // ═══════════════════════════════════════════════════════
    _buildHTML() {
        return `
            <div class="nw-layout">
                <div class="nw-header">
                    <div class="nw-header-left">
                        <button class="nw-close-btn" id="nwCloseBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        <div>
                            <h3 class="nw-title">Network Whiteboard</h3>
                            <span class="nw-design-badge">Design Mode</span>
                        </div>
                    </div>
                    <div class="nw-header-right">
                        <span class="nw-hint" id="nwHint">Drag nodes from palette below, then click to link</span>
                        <button class="nw-btn nw-btn-ghost" id="nwClearBtn">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Clear
                        </button>
                        <button class="nw-btn nw-btn-success" id="nwDownloadBtn">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download Excel
                        </button>
                        <button class="nw-btn nw-btn-primary" id="nwApplyBtn">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
                            Apply Data
                        </button>
                    </div>
                </div>

                <div class="nw-canvas-wrap" id="nwCanvasWrap">
                    <svg class="nw-edge-svg" id="wbEdgeSVG"></svg>
                    <div class="nw-nodes-layer" id="wbNodesLayer"></div>
                    <svg class="nw-link-preview" id="nwLinkPreview" style="display:none">
                        <line id="nwPreviewLine" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6,4"/>
                    </svg>

                    <div class="nw-palette" id="nwPalette">
                        <div class="nw-palette-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
                            <span>Drag to add</span>
                        </div>
                        <div class="nw-palette-items">
                            ${Object.entries(NODE_TYPES).map(([type, cfg]) => `
                                <div class="nw-palette-item" data-node-type="${type}" draggable="true">
                                    <div class="nw-palette-icon" style="background:${cfg.bgColor};border-color:${cfg.borderColor}">${cfg.iconSVG}</div>
                                    <span class="nw-palette-label">${cfg.shortLabel || cfg.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="nw-canvas-empty" id="nwCanvasEmpty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        <p>Drag & drop nodes from the palette below to design your supply chain network</p>
                        <span>Then click nodes to create connections</span>
                    </div>
                </div>

                <div class="nw-data-section">
                    <div class="nw-data-header">
                        <div class="nw-data-title-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                            <span class="nw-data-title">Transport Product Data</span>
                        </div>
                        <div class="nw-data-actions">
                            <span class="nw-data-count" id="nwEdgeCount">0 connections</span>
                            <button class="nw-btn nw-btn-ghost nw-btn-sm" id="nwAddRowBtn">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
                                Add Row
                            </button>
                        </div>
                    </div>
                    <div class="nw-table-wrap">
                        <table class="nw-table" id="nwDataTable">
                            <thead>
                                <tr>
                                    <th>Mode of Transport</th>
                                    <th>From Location</th>
                                    <th>To Location</th>
                                    <th>Product</th>
                                    <th>Period</th>
                                    <th class="nw-th-center">Available</th>
                                    <th>Min Capacity</th>
                                    <th>Max Capacity</th>
                                    <th>Cost Per Distance</th>
                                    <th>Cost Per UOM</th>
                                    <th class="nw-th-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="nwTableBody">
                                <tr><td colspan="11" class="nw-table-empty">Add nodes and connect them to generate transport data</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="nw-modal-overlay" id="nwNodeModal" style="display:none">
                <div class="nw-modal">
                    <div class="nw-modal-header">
                        <h4>Edit Node</h4>
                        <button class="nw-close-btn" id="nwModalCloseBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div id="nwModalContent"></div>
                    <div class="nw-modal-footer">
                        <button class="nw-btn nw-btn-danger" id="nwModalDeleteBtn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Delete
                        </button>
                        <button class="nw-btn nw-btn-primary" id="nwModalSaveBtn">Save</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════
    // EVENT BINDING — single delegated approach
    // ═══════════════════════════════════════════════════════
    _bindEvents(container) {
        const wrap = container.querySelector('#nwCanvasWrap');

        // ── Palette DRAG to canvas ──────────────────────
        container.querySelectorAll('.nw-palette-item').forEach(item => {
            // Click fallback: add node at center (only if no drag happened)
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._paletteClickSuppressed) {
                    this._paletteClickSuppressed = false;
                    return;
                }
                const type = item.dataset.nodeType;
                const rect = wrap.getBoundingClientRect();
                const cx = rect.width / 2 + (Math.random() - 0.5) * 260;
                const cy = rect.height / 2 + (Math.random() - 0.5) * 100 - 40;
                this._addNode(type, Math.max(80, Math.min(cx, rect.width - 80)), Math.max(60, Math.min(cy, rect.height - 100)));
            });

            // Drag start from palette
            item.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                this._paletteDragType = item.dataset.nodeType;
                this._paletteDragStartX = e.clientX;
                this._paletteDragStartY = e.clientY;
                this._paletteDidDrag = false;

                // Create ghost element
                const cfg = NODE_TYPES[this._paletteDragType];
                const ghost = document.createElement('div');
                ghost.className = 'nw-drag-ghost';
                ghost.innerHTML = `
                    <div class="nw-palette-icon" style="background:${cfg.bgColor};border-color:${cfg.borderColor}">${cfg.iconSVG}</div>
                    <span style="font-size:0.72rem;font-weight:600;color:${cfg.color}">${cfg.label}</span>
                `;
                ghost.style.cssText = `position:fixed;left:${e.clientX - 30}px;top:${e.clientY - 30}px;z-index:1000;pointer-events:none;opacity:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;background:var(--bg-card);border-radius:10px;border:2px solid ${cfg.borderColor};box-shadow:var(--shadow-lg);transition:opacity 0.15s;`;
                document.body.appendChild(ghost);
                this._paletteDragGhost = ghost;

                document.addEventListener('mousemove', this._onPaletteDragMove);
                document.addEventListener('mouseup', this._onPaletteDragEnd);
            });
        });

        // ── Toolbar buttons ─────────────────────────────
        container.querySelector('#nwCloseBtn')?.addEventListener('click', () => {
            if (this.onClose) this.onClose();
        });
        container.querySelector('#nwClearBtn')?.addEventListener('click', () => {
            this.nodes = [];
            this.edges = [];
            this.selectedNode = null;
            this.linkingFrom = null;
            this._renderAll();
        });
        container.querySelector('#nwApplyBtn')?.addEventListener('click', () => {
            if (this.onDataChange) this.onDataChange(this.getNetworkData());
        });
        container.querySelector('#nwDownloadBtn')?.addEventListener('click', () => {
            this._downloadExcel();
        });
        container.querySelector('#nwAddRowBtn')?.addEventListener('click', () => {
            this._addManualRow();
        });

        // ── Modal buttons ───────────────────────────────
        container.querySelector('#nwModalCloseBtn')?.addEventListener('click', () => {
            container.querySelector('#nwNodeModal').style.display = 'none';
        });
        container.querySelector('#nwModalDeleteBtn')?.addEventListener('click', () => {
            if (this.selectedNode) {
                this.edges = this.edges.filter(e => e.from !== this.selectedNode.id && e.to !== this.selectedNode.id);
                this.nodes = this.nodes.filter(n => n.id !== this.selectedNode.id);
                this.selectedNode = null;
                container.querySelector('#nwNodeModal').style.display = 'none';
                this._renderAll();
            }
        });
        container.querySelector('#nwModalSaveBtn')?.addEventListener('click', () => {
            this._saveModal();
            container.querySelector('#nwNodeModal').style.display = 'none';
            this._renderAll();
        });

        // ══════════════════════════════════════════════════
        // CANVAS — SINGLE DELEGATED POINTER HANDLER
        // ══════════════════════════════════════════════════
        wrap.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const nodeEl = e.target.closest('.nw-node');

            if (nodeEl) {
                // ── Mousedown on a NODE ─────────────────
                const nodeId = nodeEl.dataset.nodeId;
                const node = this.nodes.find(n => n.id === nodeId);
                if (!node) return;

                this._dragNode = node;
                this._dragEl = nodeEl;
                this._dragStartX = e.clientX;
                this._dragStartY = e.clientY;
                this._dragOrigX = node.x;
                this._dragOrigY = node.y;
                this._didDrag = false;

                document.addEventListener('mousemove', this._onPointerMove);
                document.addEventListener('mouseup', this._onPointerUp);
            } else {
                // ── Mousedown on BLANK canvas ───────────
                const isPalette = e.target.closest('.nw-palette');
                if (isPalette) return;

                this.selectedNode = null;
                this.linkingFrom = null;
                this._hidePreview();
                this._updateHint();
                this._refreshNodeStyles();
            }
        });

        // ── Link-preview line follows mouse ─────────────
        wrap.addEventListener('mousemove', (e) => {
            if (!this.linkingFrom) return;
            if (this._dragNode) return;
            const rect = wrap.getBoundingClientRect();
            this._showPreviewLine(
                this.linkingFrom.x,
                this.linkingFrom.y,
                e.clientX - rect.left,
                e.clientY - rect.top
            );
        });

        // ── Double-click on node → edit modal ───────────
        wrap.addEventListener('dblclick', (e) => {
            const nodeEl = e.target.closest('.nw-node');
            if (!nodeEl) return;
            const nodeId = nodeEl.dataset.nodeId;
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                this.selectedNode = node;
                this._showModal(node);
            }
        });
    }

    // ══════════════════════════════════════════════════════
    // PALETTE DRAG HANDLERS
    // ══════════════════════════════════════════════════════
    _onPaletteDragMove(e) {
        if (!this._paletteDragType) return;

        // Check if mouse moved enough to be a real drag
        const dx = e.clientX - (this._paletteDragStartX || 0);
        const dy = e.clientY - (this._paletteDragStartY || 0);
        if (!this._paletteDidDrag && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            this._paletteDidDrag = true;
            // Show the ghost
            if (this._paletteDragGhost) {
                this._paletteDragGhost.style.opacity = '0.9';
            }
        }

        if (this._paletteDragGhost && this._paletteDidDrag) {
            this._paletteDragGhost.style.left = (e.clientX - 30) + 'px';
            this._paletteDragGhost.style.top = (e.clientY - 30) + 'px';
        }
    }

    _onPaletteDragEnd(e) {
        document.removeEventListener('mousemove', this._onPaletteDragMove);
        document.removeEventListener('mouseup', this._onPaletteDragEnd);

        if (this._paletteDragGhost) {
            this._paletteDragGhost.remove();
            this._paletteDragGhost = null;
        }

        if (!this._paletteDragType) return;
        const type = this._paletteDragType;
        const didDrag = this._paletteDidDrag;
        this._paletteDragType = null;
        this._paletteDidDrag = false;

        if (didDrag) {
            // Suppress the click that follows mouseup
            this._paletteClickSuppressed = true;

            // Check if dropped on canvas
            const wrap = this._container.querySelector('#nwCanvasWrap');
            const rect = wrap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
                this._addNode(type, Math.max(60, Math.min(x, rect.width - 60)), Math.max(40, Math.min(y, rect.height - 80)));
            }
        }
        // If no drag happened, the click handler will fire and add the node
    }

    // ══════════════════════════════════════════════════════
    // POINTER MOVE / UP — called from document listeners
    // ══════════════════════════════════════════════════════
    _onPointerMove(e) {
        if (!this._dragNode) return;
        const dx = e.clientX - this._dragStartX;
        const dy = e.clientY - this._dragStartY;

        if (!this._didDrag && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            this._didDrag = true;
        }

        if (this._didDrag) {
            this._dragNode.x = this._dragOrigX + dx;
            this._dragNode.y = this._dragOrigY + dy;
            if (this._dragEl) {
                this._dragEl.style.left = (this._dragNode.x - 55) + 'px';
                this._dragEl.style.top = (this._dragNode.y - 32) + 'px';
            }
            this._renderEdges();
        }
    }

    _onPointerUp(e) {
        document.removeEventListener('mousemove', this._onPointerMove);
        document.removeEventListener('mouseup', this._onPointerUp);

        const node = this._dragNode;
        const didDrag = this._didDrag;

        this._dragNode = null;
        this._dragEl = null;
        this._didDrag = false;

        if (!node) return;

        if (didDrag) {
            this.selectedNode = node;
            this._refreshNodeStyles();
            this._renderEdges();
        } else {
            this._handleNodeClick(node);
        }
    }

    // ══════════════════════════════════════════════════════
    // NODE CLICK → LINKING LOGIC
    // ══════════════════════════════════════════════════════
    _handleNodeClick(node) {
        if (this.linkingFrom) {
            if (this.linkingFrom.id !== node.id) {
                this._addEdge(this.linkingFrom, node);
                this.linkingFrom = null;
                this.selectedNode = node;
                this._hidePreview();
            } else {
                this.linkingFrom = null;
                this._hidePreview();
            }
        } else {
            this.linkingFrom = node;
            this.selectedNode = node;
        }

        this._updateHint();
        this._refreshNodeStyles();
    }

    // ══════════════════════════════════════════════════════
    // NODE & EDGE OPERATIONS
    // ══════════════════════════════════════════════════════
    _addNode(type, x, y) {
        const cfg = NODE_TYPES[type];
        const count = this.nodes.filter(n => n.type === type).length + 1;
        const label = type === 'supplier_port'
            ? `Supplier-Port-${count}`
            : type === 'plant'
                ? `Plant-${count}`
                : `${cfg.label}-${count}`;
        this.nodes.push({
            id: uid('nd'),
            type,
            label,
            x, y,
            material: (type === 'supplier' || type === 'supplier_port')
                ? 'Raw Material Group'
                : type === 'customer'
                    ? 'Finished Product Group'
                    : 'Raw Material Group',
            capacity: 1000,
            units: 1,
        });
        this.linkingFrom = null;
        this._hidePreview();
        this._renderAll();
    }

    _addEdge(fromNode, toNode) {
        // Prevent duplicates
        if (this.edges.some(e =>
            (e.from === fromNode.id && e.to === toNode.id) ||
            (e.from === toNode.id && e.to === fromNode.id)
        )) return;

        const key = `${fromNode.type}_${toNode.type}`;
        const product = this._inferProduct(fromNode, toNode);
        this.edges.push({
            id: uid('eg'),
            from: fromNode.id,
            to: toNode.id,
            label: EDGE_LABELS[key] || 'Inbound',
            mode: EDGE_LABELS[key] || 'LTL',
            material: product,
            minCapacity: 0,
            maxCapacity: 1000,
            costPerDistance: 1.50,
            costPerUOM: 0,
            available: true,
            period: new Date().getFullYear(),
        });
        this._renderAll();
    }

    _inferProduct(from, to) {
        if (from.type === 'supplier_port' || from.type === 'supplier') {
            return from.material || 'Raw Material Group';
        }
        if (to.type === 'customer') return 'Finished Product Group';
        if (from.type === 'production' || from.type === 'plant') return 'Finished Product Group';
        return 'Raw Material Group';
    }

    _addManualRow() {
        // Add a virtual edge (not connected to nodes) for manual data entry
        this.edges.push({
            id: uid('eg'),
            from: null,
            to: null,
            label: 'Manual',
            mode: 'LTL',
            material: 'Raw Material Group',
            minCapacity: 0,
            maxCapacity: 1000,
            costPerDistance: 0,
            costPerUOM: 0,
            available: true,
            period: new Date().getFullYear(),
            manualFrom: '',
            manualTo: '',
        });
        this._updateTable();
    }

    // ══════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════
    _renderAll() {
        this._renderNodes();
        this._renderEdges();
        this._updateTable();
        this._updateHint();
        this._toggleEmptyState();
    }

    _toggleEmptyState() {
        const empty = this._container?.querySelector('#nwCanvasEmpty');
        if (empty) {
            empty.style.display = this.nodes.length === 0 ? 'flex' : 'none';
        }
    }

    _renderNodes() {
        const layer = this._nodesLayer;
        if (!layer) return;
        layer.innerHTML = '';

        for (const node of this.nodes) {
            const cfg = NODE_TYPES[node.type];
            if (!cfg) continue;
            const isSelected = this.selectedNode?.id === node.id;
            const isLinking = this.linkingFrom?.id === node.id;

            const el = document.createElement('div');
            el.className = `nw-node${isSelected ? ' nw-node--selected' : ''}${isLinking ? ' nw-node--linking' : ''}`;
            el.style.cssText = `
                left: ${node.x - 55}px;
                top: ${node.y - 32}px;
                border-color: ${(isSelected || isLinking) ? cfg.color : cfg.borderColor};
                background: ${cfg.bgColor};
            `;
            el.dataset.nodeId = node.id;

            const truncLabel = node.label.length > 14 ? node.label.substring(0, 13) + '…' : node.label;
            el.innerHTML = `
                <div class="nw-node-icon" style="background:${cfg.bgColor}">${cfg.iconSVG}</div>
                <div class="nw-node-label" style="color:${cfg.color}">${truncLabel}</div>
                <div class="nw-node-units">${node.units || 1}×</div>
            `;

            layer.appendChild(el);
        }
    }

    _refreshNodeStyles() {
        if (!this._nodesLayer) return;
        this._nodesLayer.querySelectorAll('.nw-node').forEach(el => {
            const id = el.dataset.nodeId;
            const node = this.nodes.find(n => n.id === id);
            if (!node) return;
            const cfg = NODE_TYPES[node.type];
            if (!cfg) return;
            const isSelected = this.selectedNode?.id === id;
            const isLinking = this.linkingFrom?.id === id;
            el.classList.toggle('nw-node--selected', isSelected);
            el.classList.toggle('nw-node--linking', isLinking);
            el.style.borderColor = (isSelected || isLinking) ? cfg.color : cfg.borderColor;
        });
    }

    _renderEdges() {
        const svg = this._svgEl;
        if (!svg) return;
        const wrap = this._container.querySelector('#nwCanvasWrap');
        svg.setAttribute('width', wrap.clientWidth);
        svg.setAttribute('height', wrap.clientHeight);
        svg.innerHTML = '';

        for (const edge of this.edges) {
            const from = this.nodes.find(n => n.id === edge.from);
            const to = this.nodes.find(n => n.id === edge.to);
            if (!from || !to) continue;

            const cx = (from.x + to.x) / 2;
            const cy = (from.y + to.y) / 2 - Math.abs(to.x - from.x) * 0.15;

            // Curved path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${from.x} ${from.y} Q ${cx} ${cy}, ${to.x} ${to.y}`);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#cbd5e1');
            path.setAttribute('stroke-width', '2');
            svg.appendChild(path);

            // Arrowhead
            const angle = Math.atan2(to.y - cy, to.x - cx);
            const a1x = to.x - 12 * Math.cos(angle) - 6 * Math.cos(angle - Math.PI / 5);
            const a1y = to.y - 12 * Math.sin(angle) - 6 * Math.sin(angle - Math.PI / 5);
            const a2x = to.x - 12 * Math.cos(angle) - 6 * Math.cos(angle + Math.PI / 5);
            const a2y = to.y - 12 * Math.sin(angle) - 6 * Math.sin(angle + Math.PI / 5);
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            arrow.setAttribute('points', `${to.x},${to.y} ${a1x},${a1y} ${a2x},${a2y}`);
            arrow.setAttribute('fill', '#94a3b8');
            svg.appendChild(arrow);

            // Label pill
            const lx = cx, ly = cy - 8;
            const tw = (edge.mode || edge.label || '').length * 6 + 14;
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', lx - tw / 2);
            bg.setAttribute('y', ly - 10);
            bg.setAttribute('width', tw);
            bg.setAttribute('height', 20);
            bg.setAttribute('rx', '10');
            bg.setAttribute('fill', '#f1f5f9');
            bg.setAttribute('stroke', '#e2e8f0');
            svg.appendChild(bg);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#64748b');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-weight', '500');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.textContent = edge.mode || edge.label;
            svg.appendChild(text);
        }
    }

    // ══════════════════════════════════════════════════════
    // PREVIEW LINE & HINT
    // ══════════════════════════════════════════════════════
    _showPreviewLine(x1, y1, x2, y2) {
        const wrap = this._container.querySelector('#nwCanvasWrap');
        const preview = this._container.querySelector('#nwLinkPreview');
        const line = this._container.querySelector('#nwPreviewLine');
        if (!preview || !line) return;
        preview.style.display = 'block';
        preview.setAttribute('width', wrap.clientWidth);
        preview.setAttribute('height', wrap.clientHeight);
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
    }

    _hidePreview() {
        const preview = this._container?.querySelector('#nwLinkPreview');
        if (preview) preview.style.display = 'none';
    }

    _updateHint() {
        const hint = this._container?.querySelector('#nwHint');
        if (!hint) return;
        if (this.linkingFrom) {
            const cfg = NODE_TYPES[this.linkingFrom.type];
            hint.innerHTML = `<span style="color:${cfg.color};font-weight:600">● ${this.linkingFrom.label}</span> → Click target node to connect`;
            hint.style.borderColor = cfg.color;
            hint.style.background = cfg.bgColor;
        } else {
            hint.textContent = 'Drag nodes from palette below, then click to link';
            hint.style.borderColor = '#e2e8f0';
            hint.style.background = '#f8fafc';
        }
    }

    // ══════════════════════════════════════════════════════
    // MODAL
    // ══════════════════════════════════════════════════════
    _showModal(node) {
        const modal = this._container.querySelector('#nwNodeModal');
        const content = this._container.querySelector('#nwModalContent');
        const cfg = NODE_TYPES[node.type];
        content.innerHTML = `
            <div class="nw-form-group">
                <label class="nw-form-label">Name</label>
                <input class="nw-form-input" id="nwNodeName" value="${node.label}">
            </div>
            <div class="nw-form-group">
                <label class="nw-form-label">Type</label>
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
                    ${cfg.iconSVG}
                    <span style="font-weight:600;color:${cfg.color}">${cfg.label}</span>
                </div>
            </div>
            <div class="nw-form-group">
                <label class="nw-form-label">Product Group</label>
                <select class="nw-form-input" id="nwNodeMaterial">
                    ${PRODUCT_GROUPS.map(pg => `<option ${node.material === pg ? 'selected' : ''}>${pg}</option>`).join('')}
                </select>
            </div>
            <div class="nw-form-group">
                <label class="nw-form-label">Max Capacity</label>
                <input class="nw-form-input" type="number" id="nwNodeCapacity" value="${node.capacity}">
            </div>
            <div class="nw-form-group">
                <label class="nw-form-label">Units</label>
                <input class="nw-form-input" type="number" id="nwNodeUnits" value="${node.units || 1}" min="1">
            </div>
        `;
        modal.style.display = 'flex';
    }

    _saveModal() {
        if (!this.selectedNode) return;
        const c = this._container;
        const v = (id) => c.querySelector('#' + id)?.value;
        this.selectedNode.label = v('nwNodeName') || this.selectedNode.label;
        this.selectedNode.material = v('nwNodeMaterial') || this.selectedNode.material;
        this.selectedNode.capacity = parseFloat(v('nwNodeCapacity')) || 1000;
        this.selectedNode.units = parseInt(v('nwNodeUnits')) || 1;
    }

    // ══════════════════════════════════════════════════════
    // EDITABLE TABLE
    // ══════════════════════════════════════════════════════
    _updateTable() {
        const tbody = this._container?.querySelector('#nwTableBody');
        const countEl = this._container?.querySelector('#nwEdgeCount');
        if (!tbody) return;

        if (countEl) countEl.textContent = `${this.edges.length} connection${this.edges.length !== 1 ? 's' : ''}`;

        if (this.edges.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="nw-table-empty">Add nodes and connect them to generate transport data</td></tr>';
            return;
        }

        tbody.innerHTML = this.edges.map((edge, idx) => {
            const from = this.nodes.find(n => n.id === edge.from);
            const to = this.nodes.find(n => n.id === edge.to);
            const fromLabel = from ? from.label : (edge.manualFrom || '—');
            const toLabel = to ? to.label : (edge.manualTo || '—');
            const fromCfg = from ? NODE_TYPES[from.type] : null;
            const toCfg = to ? NODE_TYPES[to.type] : null;

            return `<tr data-edge-idx="${idx}">
                <td>
                    <select class="nw-inline-select" data-field="mode" data-idx="${idx}">
                        ${TRANSPORT_MODES.map(m => `<option value="${m}" ${edge.mode === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </td>
                <td>${from ? `<span style="color:${fromCfg?.color || '#333'};font-weight:500">${fromLabel}</span>` : `<input class="nw-inline-input nw-inline-text" data-field="manualFrom" data-idx="${idx}" value="${edge.manualFrom || ''}" placeholder="Location...">`}</td>
                <td>${to ? `<span style="color:${toCfg?.color || '#333'};font-weight:500">${toLabel}</span>` : `<input class="nw-inline-input nw-inline-text" data-field="manualTo" data-idx="${idx}" value="${edge.manualTo || ''}" placeholder="Location...">`}</td>
                <td>
                    <select class="nw-inline-select" data-field="material" data-idx="${idx}">
                        ${PRODUCT_GROUPS.map(pg => `<option value="${pg}" ${edge.material === pg ? 'selected' : ''}>${pg}</option>`).join('')}
                    </select>
                </td>
                <td><input class="nw-inline-input nw-inline-num" data-field="period" data-idx="${idx}" value="${edge.period || new Date().getFullYear()}" style="width:60px"></td>
                <td class="nw-td-center">
                    <label class="nw-checkbox-wrap">
                        <input type="checkbox" class="nw-checkbox" data-field="available" data-idx="${idx}" ${edge.available ? 'checked' : ''}>
                        <span class="nw-checkbox-custom"></span>
                    </label>
                </td>
                <td><input class="nw-inline-input nw-inline-num" data-field="minCapacity" data-idx="${idx}" type="number" step="0.01" value="${(edge.minCapacity || 0).toFixed(2)}"></td>
                <td><input class="nw-inline-input nw-inline-num" data-field="maxCapacity" data-idx="${idx}" type="number" step="0.01" value="${(edge.maxCapacity || 1000).toFixed(2)}"></td>
                <td><input class="nw-inline-input nw-inline-num nw-highlight-val" data-field="costPerDistance" data-idx="${idx}" type="number" step="0.01" value="${(edge.costPerDistance || 0).toFixed(2)}"></td>
                <td><input class="nw-inline-input nw-inline-num" data-field="costPerUOM" data-idx="${idx}" type="number" step="0.01" value="${(edge.costPerUOM || 0).toFixed(2)}"></td>
                <td class="nw-td-center">
                    <button class="nw-row-delete" data-idx="${idx}" title="Remove row">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </td>
            </tr>`;
        }).join('');

        // Bind inline editing events
        this._bindTableEvents(tbody);
    }

    _bindTableEvents(tbody) {
        // Handle input changes
        tbody.querySelectorAll('.nw-inline-input, .nw-inline-select').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                const edge = this.edges[idx];
                if (!edge) return;

                if (field === 'minCapacity' || field === 'maxCapacity' || field === 'costPerDistance' || field === 'costPerUOM') {
                    edge[field] = parseFloat(e.target.value) || 0;
                } else if (field === 'period') {
                    edge[field] = e.target.value;
                } else {
                    edge[field] = e.target.value;
                }
            });
        });

        // Handle checkbox changes
        tbody.querySelectorAll('.nw-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const edge = this.edges[idx];
                if (edge) edge.available = e.target.checked;
            });
        });

        // Handle row delete
        tbody.querySelectorAll('.nw-row-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                this.edges.splice(idx, 1);
                this._renderAll();
            });
        });
    }

    // ══════════════════════════════════════════════════════
    // EXCEL DOWNLOAD
    // ══════════════════════════════════════════════════════
    async _downloadExcel() {
        const data = this._buildExcelData();

        if (data.length === 0) {
            this._showNotification('No data to download. Add connections first.', 'warning');
            return;
        }

        // Try to use SheetJS if available; otherwise fall back to CSV
        try {
            await this._downloadXLSX(data);
        } catch (err) {
            console.warn('[Whiteboard] SheetJS not available, falling back to CSV:', err);
            this._downloadCSV(data);
        }
    }

    _buildExcelData() {
        return this.edges.map(edge => {
            const from = this.nodes.find(n => n.id === edge.from);
            const to = this.nodes.find(n => n.id === edge.to);
            return {
                'Mode of Transport': edge.mode || 'LTL',
                'Product': edge.material || 'Raw Material Group',
                'From Location': from ? from.label : (edge.manualFrom || ''),
                'To Location': to ? to.label : (edge.manualTo || ''),
                'Period': edge.period || new Date().getFullYear(),
                'UOM': '',
                'Available': edge.available ? 1 : 0,
                'Retrieve Distance': '',
                'Average Load Size': '',
                'Cost Per Distance': edge.costPerDistance || 0,
                'Cost Per UOM': edge.costPerUOM || 0,
                'Minimum Capacity': edge.minCapacity || 0,
                'Maximum Capacity': edge.maxCapacity || 1000,
            };
        });
    }

    async _downloadXLSX(data) {
        // Load SheetJS dynamically
        if (!window.XLSX) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        const XLSX = window.XLSX;
        const wb = XLSX.utils.book_new();

        // Transport Product Data sheet
        const wsTransport = XLSX.utils.json_to_sheet(data);

        // Set column widths
        wsTransport['!cols'] = [
            { wch: 20 }, // Mode of Transport
            { wch: 22 }, // Product
            { wch: 22 }, // From Location
            { wch: 22 }, // To Location
            { wch: 10 }, // Period
            { wch: 8 },  // UOM
            { wch: 10 }, // Available
            { wch: 18 }, // Retrieve Distance
            { wch: 18 }, // Average Load Size
            { wch: 18 }, // Cost Per Distance
            { wch: 14 }, // Cost Per UOM
            { wch: 18 }, // Minimum Capacity
            { wch: 18 }, // Maximum Capacity
        ];

        XLSX.utils.book_append_sheet(wb, wsTransport, 'Transport Product Data');

        // Nodes sheet
        if (this.nodes.length > 0) {
            const nodeData = this.nodes.map(n => ({
                'Node Name': n.label,
                'Type': NODE_TYPES[n.type]?.label || n.type,
                'Product Group': n.material,
                'Max Capacity': n.capacity,
                'Units': n.units || 1,
            }));
            const wsNodes = XLSX.utils.json_to_sheet(nodeData);
            wsNodes['!cols'] = [
                { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 8 },
            ];
            XLSX.utils.book_append_sheet(wb, wsNodes, 'Network Nodes');
        }

        const filename = `SteelSync_Network_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        this._showNotification(`Downloaded ${filename}`, 'success');
    }

    _downloadCSV(data) {
        if (data.length === 0) return;
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(h => {
                const val = String(row[h] ?? '');
                return val.includes(',') ? `"${val}"` : val;
            }).join(','))
        ];
        const csvContent = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SteelSync_Network_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this._showNotification('Downloaded as CSV (install SheetJS for Excel format)', 'success');
    }

    _showNotification(msg, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `nw-notification nw-notification-${type}`;
        notif.innerHTML = `
            <span>${type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span>${msg}</span>
        `;
        this._container.appendChild(notif);
        setTimeout(() => notif.classList.add('nw-notification-show'), 10);
        setTimeout(() => {
            notif.classList.remove('nw-notification-show');
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    // ══════════════════════════════════════════════════════
    // DATA EXPORT
    // ══════════════════════════════════════════════════════
    getNetworkData() {
        return {
            nodes: this.nodes.map(n => ({ id: n.id, type: n.type, label: n.label, material: n.material, capacity: n.capacity, units: n.units })),
            edges: this.edges.map(e => {
                const from = this.nodes.find(n => n.id === e.from);
                const to = this.nodes.find(n => n.id === e.to);
                return {
                    from: from?.label || e.manualFrom || '',
                    fromType: from?.type || '',
                    to: to?.label || e.manualTo || '',
                    toType: to?.type || '',
                    mode: e.mode,
                    costPerDistance: e.costPerDistance,
                    costPerUOM: e.costPerUOM,
                    minCapacity: e.minCapacity,
                    maxCapacity: e.maxCapacity,
                    material: e.material,
                    available: e.available,
                    period: e.period,
                };
            }),
        };
    }

    destroy() {
        document.removeEventListener('mousemove', this._onPointerMove);
        document.removeEventListener('mouseup', this._onPointerUp);
        document.removeEventListener('mousemove', this._onPaletteDragMove);
        document.removeEventListener('mouseup', this._onPaletteDragEnd);
    }
}
