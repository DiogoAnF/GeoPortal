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
    // Move zoom control to bottom-right to not conflict with the sidebar toggle
    const map = L.map('map', {
        zoomControl: false
    }).setView([-19.74, -47.93], 8);

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
    
    // Initialize drone layer based on checkbox state
    if (toggleDrone && toggleDrone.checked) {
        droneLayer.addTo(map);
    }
    
    if (toggleDrone) {
        toggleDrone.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(droneLayer);
                droneLayer.bringToFront(); // Ensure it stays visible over basemaps
            } else {
                map.removeLayer(droneLayer);
            }
        });
    }

    // ==========================================
    // LAYER STYLING & INTERACTION
    // ==========================================

    const styleUberaba = {
        color: "#3b82f6",     // Border color
        weight: 2,            // Border width
        opacity: 1,           // Border opacity
        fillColor: "#60a5fa", // Fill color
        fillOpacity: 0.4      // Fill opacity
    };

    const styleIRU = {
        color: "#10b981",     
        weight: 1.5,            
        opacity: 0.8,           
        fillColor: "#34d399", 
        fillOpacity: 0.2      
    };

    const highlightFeature = (e) => {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#f59e0b',
            dashArray: '',
            fillOpacity: 0.7
        });
        layer.bringToFront();
    };

    const resetHighlight = (e, geojsonLayer) => {
        geojsonLayer.resetStyle(e.target);
    };

    const createPopupContent = (properties, title) => {
        let content = `<div class="popup-header">${title}</div><div class="popup-body">`;
        for (const [key, value] of Object.entries(properties)) {
            if (value !== null && value !== "") {
                 content += `
                    <div class="popup-row">
                        <span class="popup-label">${key}</span>
                        <span class="popup-value">${value}</span>
                    </div>
                `;
            }
        }
        content += `</div>`;
        return content;
    };

    const onEachFeatureUberaba = (feature, layer, geojsonLayer) => {
        layer.on({
            mouseover: highlightFeature,
            mouseout: (e) => resetHighlight(e, geojsonLayer)
        });
        if (feature.properties) {
            layer.bindPopup(createPopupContent(feature.properties, "Dados - Uberaba 2025"));
        }
    };

    const onEachFeatureIRU = (feature, layer, geojsonLayer) => {
        layer.on({
            mouseover: highlightFeature,
            mouseout: (e) => resetHighlight(e, geojsonLayer)
        });
        if (feature.properties) {
            layer.bindPopup(createPopupContent(feature.properties, "Dados - IRU_URA 2025"));
        }
    };

    // ==========================================
    // FETCH AND LOAD DATA
    // ==========================================

    const loadingScreen = document.getElementById('loading');
    
    // Custom Checkboxes
    const toggleIru = document.getElementById('toggle-iru');
    const toggleUberaba = document.getElementById('toggle-uberaba');

    // Fetch both datasets simultaneously
    Promise.all([
        fetch('data/Uberaba_2025.geojson').then(response => {
            if(!response.ok) throw new Error("Erro ao carregar Uberaba_2025");
            return response.json();
        }),
        fetch('data/IRU_URA_2025.geojson').then(response => {
            if(!response.ok) throw new Error("Erro ao carregar IRU_URA_2025");
            return response.json();
        })
    ]).then(([uberabaData, iruData]) => {
        
        let uberabaLayer;
        let iruLayer;

        uberabaLayer = L.geoJSON(uberabaData, {
            style: styleUberaba,
            onEachFeature: (f, l) => onEachFeatureUberaba(f, l, uberabaLayer)
        });

        iruLayer = L.geoJSON(iruData, {
            style: styleIRU,
            onEachFeature: (f, l) => onEachFeatureIRU(f, l, iruLayer)
        });

        // Initialize layers based on checkbox state
        if (toggleIru.checked) iruLayer.addTo(map);
        if (toggleUberaba.checked) uberabaLayer.addTo(map);

        // Map Checkboxes to Layers
        toggleIru.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(iruLayer);
            } else {
                map.removeLayer(iruLayer);
            }
        });

        toggleUberaba.addEventListener('change', (e) => {
            if (e.target.checked) {
                map.addLayer(uberabaLayer);
            } else {
                map.removeLayer(uberabaLayer);
            }
        });

        // Fit map bounds to IRU layer
        map.fitBounds(iruLayer.getBounds());

        // Hide loading
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.style.display = 'none', 300);

    }).catch(error => {
        console.error("Erro no carregamento dos dados: ", error);
        loadingScreen.innerHTML = `<div style="color: #ef4444; font-weight: bold; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Erro ao carregar os dados geográficos: ${error.message}.<br><br>Para carregar os arquivos GeoJSON, este portal precisa ser executado por um servidor local.</div>`;
    });

});
