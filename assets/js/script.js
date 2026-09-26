// Constantes e Estado da Aplicação
const CONFIG = {
    DEFAULT_CENTER: [-14.2350, -51.9253], // Centro do Brasil
    DEFAULT_ZOOM: 4,
    DETAIL_ZOOM: 16,
    NOMINATIM_BASE: 'https://nominatim.openstreetmap.org/search',
    NOMINATIM_REVERSE: 'https://nominatim.openstreetmap.org/reverse',
    VIACEP_BASE: 'https://viacep.com.br/ws'
};

let state = {
    map: null,
    activeMarker: null,
    userLocationMarker: null,
    userCoords: null,
    currentAddressData: null,
    history: JSON.parse(localStorage.getItem('localiza_cep_history')) || []
};

// Elementos DOM
const DOM = {
    searchInput: document.getElementById('search-input'),
    btnClear: document.getElementById('btn-clear'),
    btnSearch: document.getElementById('btn-search'),
    btnUserLocation: document.getElementById('btn-user-location'),
    statusAlert: document.getElementById('status-alert'),
    resultCard: document.getElementById('result-card'),
    btnCopy: document.getElementById('btn-copy'),
    historyList: document.getElementById('history-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    distanceBox: document.getElementById('distance-box'),
    // Campos do Resultado
    resStreet: document.getElementById('res-street'),
    resNeighborhood: document.getElementById('res-neighborhood'),
    resCep: document.getElementById('res-cep'),
    resCity: document.getElementById('res-city'),
    resDdd: document.getElementById('res-ddd'),
    resIbge: document.getElementById('res-ibge'),
    resSiafi: document.getElementById('res-siafi'),
    resCoords: document.getElementById('res-coords'),
    resDistance: document.getElementById('res-distance')
};

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    renderHistory();
});

// Inicialização do Mapa Leaflet
function initMap() {
    state.map = L.map('map', {
        zoomControl: true
    }).setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);

    // Servidor Esri World Street Map (Gratuito, sem chave de API e sem marcas d'água)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    }).addTo(state.map);

    // Evento de clique no mapa para geocodificação reversa
    state.map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        await searchByCoords(lat, lng);
    });
}

// Event Listeners
function initEventListeners() {
    DOM.searchInput.addEventListener('input', (e) => {
        let value = e.target.value;
        
        // Formatação automática para entrada de CEP
        if (/^\d+$/.test(value.replace(/\D/g, '')) && value.replace(/\D/g, '').length <= 8) {
            value = value.replace(/\D/g, '');
            if (value.length > 5) {
                value = value.replace(/^(\d{5})(\d)/, '$1-$2');
            }
            e.target.value = value;
        }

        DOM.btnClear.classList.toggle('hidden', e.target.value.trim() === '');
    });

    DOM.btnClear.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.btnClear.classList.add('hidden');
        DOM.searchInput.focus();
    });

    DOM.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    DOM.btnSearch.addEventListener('click', handleSearch);
    DOM.btnUserLocation.addEventListener('click', getUserLocation);
    DOM.btnCopy.addEventListener('click', copyAddressData);
    DOM.btnClearHistory.addEventListener('click', clearHistory);
}

// Lógica de Pesquisa Principal
async function handleSearch() {
    const query = DOM.searchInput.value.trim();
    if (!query) return;

    hideAlert();
    setLoading(true);

    const cleanCep = query.replace(/\D/g, '');

    if (cleanCep.length === 8) {
        await searchByCEP(cleanCep);
    } else {
        await searchByAddressText(query);
    }

    setLoading(false);
}

// 1. Pesquisa via CEP (ViaCEP + Geocodificação)
async function searchByCEP(cep) {
    try {
        const response = await fetch(`${CONFIG.VIACEP_BASE}/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            showAlert('CEP não encontrado na base de dados.', 'error');
            hideResultCard();
            return;
        }

        const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}, Brasil`;
        const coords = await geocodeAddress(fullAddress, `${data.localidade}, ${data.uf}, Brasil`);

        if (coords) {
            displayResults({
                cep: data.cep,
                street: data.logradouro || 'Não informado',
                neighborhood: data.bairro || 'Não informado',
                city: `${data.localidade} / ${data.uf}`,
                ddd: data.ddd || '-',
                ibge: data.ibge || '-',
                siafi: data.siafi || '-',
                lat: coords.lat,
                lon: coords.lon
            });
        } else {
            showAlert('CEP válido, mas as coordenadas exatas não foram localizadas no mapa.', 'error');
        }

    } catch (error) {
        showAlert('Erro ao consultar o serviço de CEP. Verifique a sua ligação.', 'error');
    }
}

// 2. Pesquisa por texto de Endereço (Nominatim)
async function searchByAddressText(query) {
    try {
        const url = `${CONFIG.NOMINATIM_BASE}?format=json&addressdetails=1&email=app@localizacep.com&q=${encodeURIComponent(query)}&limit=1`;
        const response = await fetch(url);
        const results = await response.json();

        if (results.length === 0) {
            showAlert('Endereço não encontrado. Tente ser mais específico.', 'error');
            hideResultCard();
            return;
        }

        const item = results[0];
        const addr = item.address;

        displayResults({
            cep: addr.postcode || 'N/A',
            street: addr.road || addr.pedestrian || addr.suburb || query,
            neighborhood: addr.neighbourhood || addr.suburb || 'N/A',
            city: `${addr.city || addr.town || addr.village || 'N/A'} / ${addr.state_code ? addr.state_code.toUpperCase() : ''}`,
            ddd: '-',
            ibge: '-',
            siafi: '-',
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        });

    } catch (error) {
        showAlert('Erro ao buscar o endereço informado.', 'error');
    }
}

// 3. Geocodificação Reversa (Clique no Mapa)
async function searchByCoords(lat, lon) {
    setLoading(true);
    hideAlert();

    try {
        const url = `${CONFIG.NOMINATIM_REVERSE}?format=json&addressdetails=1&email=app@localizacep.com&lat=${lat}&lon=${lon}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            showAlert('Nenhum endereço encontrado para este ponto no mapa.', 'error');
            setLoading(false);
            return;
        }

        const addr = data.address;

        displayResults({
            cep: addr.postcode || 'N/A',
            street: addr.road || addr.pedestrian || addr.suburb || 'Ponto selecionado',
            neighborhood: addr.neighbourhood || addr.suburb || 'N/A',
            city: `${addr.city || addr.town || addr.village || 'N/A'} / ${addr.state_code ? addr.state_code.toUpperCase() : ''}`,
            ddd: '-',
            ibge: '-',
            siafi: '-',
            lat: lat,
            lon: lon
        });

    } catch (error) {
        showAlert('Erro ao realizar geocodificação reversa.', 'error');
    } finally {
        setLoading(false);
    }
}

// Converte string de endereço em Latitude/Longitude
async function geocodeAddress(primarySearch, fallbackSearch) {
    try {
        let response = await fetch(`${CONFIG.NOMINATIM_BASE}?format=json&email=app@localizacep.com&q=${encodeURIComponent(primarySearch)}&limit=1`);
        let results = await response.json();

        if (results.length === 0 && fallbackSearch) {
            response = await fetch(`${CONFIG.NOMINATIM_BASE}?format=json&email=app@localizacep.com&q=${encodeURIComponent(fallbackSearch)}&limit=1`);
            results = await response.json();
        }

        if (results.length > 0) {
            return {
                lat: parseFloat(results[0].lat),
                lon: parseFloat(results[0].lon)
            };
        }
        return null;
    } catch {
        return null;
    }
}

// Exibição dos Resultados no Painel
function displayResults(data) {
    state.currentAddressData = data;

    DOM.resStreet.textContent = data.street;
    DOM.resNeighborhood.textContent = data.neighborhood;
    DOM.resCep.textContent = data.cep;
    DOM.resCity.textContent = data.city;
    DOM.resDdd.textContent = data.ddd;
    DOM.resIbge.textContent = data.ibge;
    DOM.resSiafi.textContent = data.siafi;
    DOM.resCoords.textContent = `${data.lat.toFixed(5)}, ${data.lon.toFixed(5)}`;

    if (state.userCoords) {
        const dist = calculateHaversineDistance(
            state.userCoords.lat, state.userCoords.lon,
            data.lat, data.lon
        );
        DOM.resDistance.textContent = `${dist.toFixed(2)} km`;
        DOM.distanceBox.classList.remove('hidden');
    } else {
        DOM.distanceBox.classList.add('hidden');
    }

    DOM.resultCard.classList.remove('hidden');

    updateMapMarker(data.lat, data.lon, `<b>${data.street}</b><br>${data.city}`);
    addToHistory(data);
}

// Atualiza Marcador do Mapa
function updateMapMarker(lat, lon, popupContent) {
    state.map.setView([lat, lon], CONFIG.DETAIL_ZOOM);

    if (state.activeMarker) {
        state.map.removeLayer(state.activeMarker);
    }

    state.activeMarker = L.marker([lat, lon]).addTo(state.map)
        .bindPopup(popupContent)
        .openPopup();
}

// Localização do Utilizador
function getUserLocation() {
    if (!navigator.geolocation) {
        showAlert('A geolocalização não é suportada pelo seu navegador.', 'error');
        return;
    }

    showAlert('A obter a sua localização...', 'info');

    navigator.geolocation.getCurrentPosition((position) => {
        hideAlert();
        state.userCoords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
        };

        if (state.userLocationMarker) {
            state.map.removeLayer(state.userLocationMarker);
        }

        state.userLocationMarker = L.circleMarker([state.userCoords.lat, state.userCoords.lon], {
            radius: 8,
            fillColor: "#1a73e8",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(state.map).bindPopup("<b>Sua Posição Atual</b>");

        state.map.setView([state.userCoords.lat, state.userCoords.lon], CONFIG.DETAIL_ZOOM);

        if (state.currentAddressData) {
            displayResults(state.currentAddressData);
        }
    }, () => {
        showAlert('Não foi possível obter a sua localização. Permissão negada.', 'error');
    });
}

// Cálculo da Fórmula de Haversine (Distância Exata em KM)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Gestão de Histórico
function addToHistory(item) {
    const historyItem = {
        title: item.cep !== 'N/A' ? item.cep : item.street,
        city: item.city,
        lat: item.lat,
        lon: item.lon,
        fullData: item
    };

    state.history = state.history.filter(h => h.title !== historyItem.title);
    state.history.unshift(historyItem);

    if (state.history.length > 5) {
        state.history.pop();
    }

    localStorage.setItem('localiza_cep_history', JSON.stringify(state.history));
    renderHistory();
}

function renderHistory() {
    DOM.historyList.innerHTML = '';

    if (state.history.length === 0) {
        DOM.historyList.innerHTML = '<li class="empty-history">Nenhum histórico recente.</li>';
        return;
    }

    state.history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <span><strong>${item.title}</strong> - ${item.city}</span>
            <i class="fa-solid fa-chevron-right" style="font-size:10px; color:#a0aec0;"></i>
        `;
        li.addEventListener('click', () => displayResults(item.fullData));
        DOM.historyList.appendChild(li);
    });
}

function clearHistory() {
    state.history = [];
    localStorage.removeItem('localiza_cep_history');
    renderHistory();
}

// Copiar Informações do Endereço
function copyAddressData() {
    if (!state.currentAddressData) return;
    const d = state.currentAddressData;
    const text = `Endereço: ${d.street}, ${d.neighborhood}\nCidade: ${d.city}\nCEP: ${d.cep}\nCoordenadas: ${d.lat}, ${d.lon}`;

    navigator.clipboard.writeText(text).then(() => {
        showAlert('Informações copiadas para a área de transferência!', 'info');
        setTimeout(hideAlert, 3000);
    });
}

// Utilitários de Interface
function setLoading(isLoading) {
    if (isLoading) {
        DOM.btnSearch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Pesquisar...';
        DOM.btnSearch.disabled = true;
    } else {
        DOM.btnSearch.innerHTML = '<i class="fa-solid fa-search"></i> Buscar';
        DOM.btnSearch.disabled = false;
    }
}

function showAlert(message, type = 'error') {
    DOM.statusAlert.textContent = message;
    DOM.statusAlert.className = `alert ${type}`;
    DOM.statusAlert.classList.remove('hidden');
}

function hideAlert() {
    DOM.statusAlert.classList.add('hidden');
}

function hideResultCard() {
    DOM.resultCard.classList.add('hidden');
}