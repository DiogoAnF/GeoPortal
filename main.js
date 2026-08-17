// main.js
document.addEventListener("DOMContentLoaded", () => {
    
    // Sidebar Logic
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Initialize Map
    const map = L.map('map', {
        zoomControl: false
    }).setView([-19.74, -47.93], 15);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // ==========================================
    // BASEMAPS
    // ==========================================
    
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri'
    });

    // Set OSM as default basemap
    osm.addTo(map);

    const baseMaps = {
        "OpenStreetMap (Padrão)": osm,
        "Esri Satélite (Imagem)": esriImagery
    };

    // Add only basemaps to native control
    L.control.layers(baseMaps, null, { collapsed: false }).addTo(map);

    // ==========================================
    // DRONE IMAGERY LAYER
    // ==========================================
    const droneLayer = L.tileLayer('data/drone_orto/{z}/{x}/{y}.png', {
        minZoom: 15,
        maxZoom: 22,
        zIndex: 10,
        tms: false,
        attribution: 'Orthomosaic Drone'
    });

    const toggleDrone = document.getElementById('toggle-drone');
    
    if (toggleDrone && toggleDrone.checked) {
        droneLayer.addTo(map);
    }
    
    if (toggleDrone) {
        toggleDrone.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(droneLayer);
                droneLayer.bringToFront();
            } else {
                map.removeLayer(droneLayer);
            }
        });
    }

    // ==========================================
    // LAND USE STYLES
    // ==========================================

    const styles = {
        pasto: { color: "#4ade80", weight: 2, fillColor: "#86efac", fillOpacity: 0.5 },
        reserva: { color: "#065f46", weight: 2, fillColor: "#065f46", fillOpacity: 0.5 },
        cana: { color: "#f59e0b", weight: 2, fillColor: "#fbbf24", fillOpacity: 0.5 },
        sede: { color: "#dc2626", weight: 2, fillColor: "#ef4444", fillOpacity: 0.5 },
        carreadores: { color: "#57534e", weight: 2, fillColor: "#78716c", fillOpacity: 0.5 }
    };

    const highlightFeature = (e) => {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#fef08a',
            fillOpacity: 0.8
        });
        layer.bringToFront();
    };

    const resetHighlight = (e, geojsonLayer) => {
        geojsonLayer.resetStyle(e.target);
    };

    // ==========================================
    // POPUP LOGIC & PERCENTAGE
    // ==========================================

    // Total area variable to calculate percentage
    let totalMappedArea = 0;

    const createPopupContent = (properties, title) => {
        const id = properties.id !== undefined ? properties.id : (properties.ID !== undefined ? properties.ID : "N/D");
        const areaRaw = properties.area || properties.Area || properties.AREA;
        const area = areaRaw ? parseFloat(areaRaw) : 0;
        
        let percentageText = "N/D";
        if (area > 0 && totalMappedArea > 0) {
            const perc = (area / totalMappedArea) * 100;
            percentageText = perc.toFixed(2) + "%";
        }

        return `
            <div class="popup-header">${title}</div>
            <div class="popup-body">
                <div class="popup-row">
                    <span class="popup-label">ID</span>
                    <span class="popup-value">${id}</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Área</span>
                    <span class="popup-value">${area.toFixed(2)} ha</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">% do Total Mapeado</span>
                    <span class="popup-value">${percentageText}</span>
                </div>
            </div>
        `;
    };

    const bindLayerInteractions = (feature, layer, geojsonLayer, title) => {
        layer.on({
            mouseover: highlightFeature,
            mouseout: (e) => resetHighlight(e, geojsonLayer)
        });
        if (feature.properties) {
            layer.bindPopup(createPopupContent(feature.properties, title));
        }
    };

    // ==========================================
    // FETCH AND LOAD DATA
    // ==========================================

    const loadingScreen = document.getElementById('loading');
    
    // Checkboxes
    const toggles = {
        pasto: document.getElementById('toggle-pasto'),
        reserva: document.getElementById('toggle-reserva'),
        cana: document.getElementById('toggle-cana'),
        sede: document.getElementById('toggle-sede'),
        carreadores: document.getElementById('toggle-carreadores')
    };

    // Helper to safely fetch geojson even if some files are missing
    const fetchGeoJSON = async (url) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn(`Arquivo ignorado/não encontrado: ${url}`);
            return null;
        }
    };

    Promise.all([
        fetchGeoJSON('data/pasto.geojson'),
        fetchGeoJSON('data/reserva.geojson'),
        fetchGeoJSON('data/cana.geojson'),
        fetchGeoJSON('data/sede.geojson'),
        fetchGeoJSON('data/carreadores.geojson')
    ]).then(([pastoData, reservaData, canaData, sedeData, carreadoresData]) => {
        
        const layerObjects = {
            pasto: { data: pastoData, title: "Pasto", style: styles.pasto },
            reserva: { data: reservaData, title: "Reserva", style: styles.reserva },
            cana: { data: canaData, title: "Área de Cana", style: styles.cana },
            sede: { data: sedeData, title: "Sede", style: styles.sede },
            carreadores: { data: carreadoresData, title: "Carreadores", style: styles.carreadores }
        };

        const leafletLayers = [];
        let allBounds = null;

        // 1. Calculate total mapped area across all layers
        Object.values(layerObjects).forEach(obj => {
            if (obj.data && obj.data.features) {
                obj.data.features.forEach(f => {
                    const props = f.properties;
                    if (props) {
                        const areaRaw = props.area || props.Area || props.AREA;
                        if (areaRaw) {
                            totalMappedArea += parseFloat(areaRaw);
                        }
                    }
                });
            }
        });

        // 2. Create Leaflet layers
        for (const [key, obj] of Object.entries(layerObjects)) {
            if (obj.data) {
                const geoLayer = L.geoJSON(obj.data, {
                    style: obj.style,
                    onEachFeature: (f, l) => bindLayerInteractions(f, l, geoLayer, obj.title)
                });
                
                leafletLayers.push(geoLayer);
                
                // Add to map if toggle is checked
                if (toggles[key] && toggles[key].checked) {
                    geoLayer.addTo(map);
                }

                // Attach event listeners
                if (toggles[key]) {
                    toggles[key].addEventListener('change', (e) => {
                        if (e.target.checked) map.addLayer(geoLayer);
                        else map.removeLayer(geoLayer);
                    });
                }

                // Extend total bounds safely
                const layerBounds = geoLayer.getBounds();
                if (layerBounds.isValid()) {
                    if (!allBounds) allBounds = layerBounds;
                    else allBounds.extend(layerBounds);
                }
            }
        }

        // Fit map bounds to the new layers if any were loaded successfully
        if (allBounds && allBounds.isValid()) {
            map.fitBounds(allBounds);
        }

        // Hide loading
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.style.display = 'none', 300);

    }).catch(error => {
        console.error("Erro no carregamento dos dados: ", error);
        loadingScreen.innerHTML = `<div style="color: #ef4444; font-weight: bold; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Erro crítico no carregamento das camadas.</div>`;
    });

});
