// Global state
const state = {
  map: null,
  markers: [],
  currentPlace: null,
  allPlaces: [],
  scene: null,
  camera: null,
  renderer: null,
  darkMode: false
};

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeMap();
  initialize3DScene();
  setupEventListeners();
});

function initializeTheme() {
  const saved = localStorage.getItem('bluelive-theme');
  const prefersDark = saved ? saved === 'dark' : true;
  state.darkMode = prefersDark;
  applyTheme();
  document.getElementById('darkMode').checked = state.darkMode;
}

function applyTheme() {
  if (state.darkMode) {
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
  }
}

function initializeMap() {
  state.map = L.map('map').setView([51.0447, -114.0719], 11); // Calgary default

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(state.map);
}

function initialize3DScene() {
  const canvasContainer = document.getElementById('canvas3D');
  if (!canvasContainer) return;

  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x050816);

  state.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  state.camera.position.set(0, 2.5, 6);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  state.renderer.setSize(width, height);
  state.renderer.setPixelRatio(window.devicePixelRatio);
  canvasContainer.appendChild(state.renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  state.scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(4, 6, 4);
  state.scene.add(dir);

  animateScene();
  window.addEventListener('resize', onWindowResize);
}

function animateScene() {
  requestAnimationFrame(animateScene);

  state.scene.children.forEach((child) => {
    if (child.isMesh) {
      child.rotation.y += 0.004;
    }
  });

  if (state.renderer && state.camera) {
    state.renderer.render(state.scene, state.camera);
  }
}

function onWindowResize() {
  const canvasContainer = document.getElementById('canvas3D');
  if (!canvasContainer || !state.renderer || !state.camera) return;

  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

function setupEventListeners() {
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document
    .getElementById('searchInput')
    .addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });

  document
    .getElementById('locationBtn')
    .addEventListener('click', getUserLocation);

  document
    .getElementById('generate3DBtn')
    .addEventListener('click', generate3DModel);

  document
    .getElementById('mapViewBtn')
    .addEventListener('click', () => switchView('map'));

  document
    .getElementById('modelViewBtn')
    .addEventListener('click', () => switchView('model'));

  document.getElementById('darkMode').addEventListener('change', (e) => {
    state.darkMode = e.target.checked;
    localStorage.setItem('bluelive-theme', state.darkMode ? 'dark' : 'light');
    applyTheme();
  });
}

function showStatus(message, type = 'info') {
  const bar = document.getElementById('statusBar');
  bar.textContent = message;
  bar.className = 'status-bar';
  if (type === 'success') bar.classList.add('success');
  if (type === 'error') bar.classList.add('error');
}

function showLoading(isLoading) {
  const btn = document.getElementById('searchBtn');
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Searching…' : 'Search';
}

async function performSearch() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;

  showLoading(true);
  showStatus('Searching with AI…');

  try {
    const center = state.map.getCenter();
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        latitude: center.lat,
        longitude: center.lng
      })
    });

    const data = await res.json();

    if (data.error) {
      showStatus(`Search failed: ${data.error}`, 'error');
      showLoading(false);
      return;
    }

    state.allPlaces = data.places || [];
    renderSuggestions(data.suggestions || []);
    renderResults(state.allPlaces);
    updateMarkers(state.allPlaces);

    if (state.allPlaces.length > 0) {
      state.currentPlace = state.allPlaces[0];
      document.getElementById('generate3DBtn').disabled = false;
      flyToPlace(state.currentPlace);
    }

    showStatus(`Found ${state.allPlaces.length} places`, 'success');
  } catch (err) {
    showStatus(`Search error: ${err.message}`, 'error');
  }

  showLoading(false);
}

function renderSuggestions(suggestions) {
  const container = document.getElementById('suggestionsContainer');
  container.innerHTML = '';
  suggestions.forEach((s) => {
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.textContent = s;
    chip.addEventListener('click', () => {
      document.getElementById('searchInput').value = s;
      performSearch();
    });
    container.appendChild(chip);
  });
}

function renderResults(places) {
  const list = document.getElementById('resultsList');
  list.innerHTML = '';

  places.forEach((place, index) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <h4>${place.name}</h4>
      <p>${place.description || 'No description'}</p>
      <small>Lat: ${place.latitude?.toFixed(4)}, Lng: ${place.longitude?.toFixed(
        4
      )}</small>
    `;
    item.addEventListener('click', () => {
      state.currentPlace = place;
      document.getElementById('generate3DBtn').disabled = false;
      flyToPlace(place);
    });
    list.appendChild(item);
  });
}

function updateMarkers(places) {
  state.markers.forEach((m) => m.remove());
  state.markers = [];

  places.forEach((place) => {
    if (
      typeof place.latitude === 'number' &&
      typeof place.longitude === 'number'
    ) {
      const marker = L.marker([place.latitude, place.longitude]).addTo(
        state.map
      );
      marker.bindPopup(
        `<strong>${place.name}</strong><br>${place.description || ''}`
      );
      state.markers.push(marker);
    }
  });
}

function flyToPlace(place) {
  if (
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number'
  ) {
    state.map.flyTo([place.latitude, place.longitude], 14, {
      duration: 1.2
    });
  }
}

function getUserLocation() {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported in this browser.', 'error');
    return;
  }

  showStatus('Locating…');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.map.flyTo([latitude, longitude], 14, { duration: 1.2 });
      showStatus('Centered on your location.', 'success');
    },
    () => {
      showStatus('Unable to retrieve your location.', 'error');
    }
  );
}

function switchView(view) {
  const mapContainer = document.getElementById('mapContainer');
  const modelContainer = document.getElementById('modelContainer');
  const mapBtn = document.getElementById('mapViewBtn');
  const modelBtn = document.getElementById('modelViewBtn');

  if (view === 'map') {
    mapContainer.classList.remove('hidden');
    modelContainer.classList.add('hidden');
    mapBtn.classList.add('active');
    modelBtn.classList.remove('active');
  } else {
    mapContainer.classList.add('hidden');
    modelContainer.classList.remove('hidden');
    mapBtn.classList.remove('active');
    modelBtn.classList.add('active');
  }
}

async function generate3DModel() {
  if (!state.currentPlace) return;

  showStatus('Generating 3D model idea…');

  try {
    const res = await fetch('/api/generate-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeName: state.currentPlace.name,
        description: state.currentPlace.description
      })
    });

    const data = await res.json();
    if (data.error) {
      showStatus(`Model generation failed: ${data.error}`, 'error');
      return;
    }

    document.getElementById('modelDescription').textContent =
      data.modelDescription || 'Model generated.';

    buildSimpleModel();
    switchView('model');
    showStatus('3D model generated.', 'success');
  } catch (err) {
    showStatus(`Model error: ${err.message}`, 'error');
  }
}

function buildSimpleModel() {
  if (!state.scene) return;

  // Clear old meshes
  const toRemove = [];
  state.scene.children.forEach((child) => {
    if (child.isMesh) toRemove.push(child);
  });
  toRemove.forEach((m) => state.scene.remove(m));

  const baseGeom = new THREE.BoxGeometry(4, 0.2, 4);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.2,
    roughness: 0.8
  });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = -1;
  state.scene.add(base);

  const mainGeom = new THREE.BoxGeometry(1.4, 2.2, 1.4);
  const mainMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.4,
    metalness: 0.4,
    roughness: 0.4
  });
  const main = new THREE.Mesh(mainGeom, mainMat);
  main.position.y = 0.3;
  state.scene.add(main);

  const towerGeom = new THREE.CylinderGeometry(0.25, 0.25, 2.4, 24);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.5
  });
  const tower = new THREE.Mesh(towerGeom, towerMat);
  tower.position.set(-1.1, 0.7, 0.4);
  state.scene.add(tower);

  const sphereGeom = new THREE.SphereGeometry(0.45, 24, 24);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.6
  });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.set(1.1, 1.1, -0.3);
  state.scene.add(sphere);
}
