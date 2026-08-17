// main.js
document.addEventListener("DOMContentLoaded", () => {
    
    // Initialize Map
    // Coordinates roughly centered on Uberaba / Minas Gerais
    const map = L.map('map').setView([-19.74, -47.93], 8);

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

    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO'
    });

    // Set default basemap
    cartoLight.addTo(map);

    const baseMaps = {
        "Carto Positron (Claro)": cartoLight,
        "OpenStreetMap (Padrão)": osm,
        "Esri Satélite (Imagem)": esriImagery
    };

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

    const overlayMaps = {};
    const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);
    
    const loadingScreen = document.getElementById('loading');

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

        // Add layers to the control and map
        layerControl.addOverlay(uberabaLayer, "Uberaba_2025");
        layerControl.addOverlay(iruLayer, "IRU_URA_2025");
        
        // Add layers to map by default
        iruLayer.addTo(map);
        uberabaLayer.addTo(map);

        // Fit map bounds to IRU layer (which probably contains the larger extent)
        map.fitBounds(iruLayer.getBounds());

        // Hide loading
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.style.display = 'none', 300);

    }).catch(error => {
        console.error("Erro no carregamento dos dados: ", error);
        loadingScreen.innerHTML = `<div style="color: #ef4444; font-weight: bold; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Erro ao carregar os dados geográficos: ${error.message}.<br><br>Para carregar os arquivos GeoJSON, este portal precisa ser executado por um servidor local (ex: extensão Live Server do VSCode) e não apenas abrindo o arquivo index.html.</div>`;
    });

});
