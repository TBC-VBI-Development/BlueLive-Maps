import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164/build/three.module.js";

let map;
let selectedPlace = null;

/* -----------------------------
   MAP INITIALIZATION
----------------------------- */
function initMap() {
  map = L.map("map").setView([51.0447, -114.0719], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);
}

initMap();

/* -----------------------------
   DOM ELEMENTS
----------------------------- */
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const suggestionsList = document.getElementById("suggestions");
const resultsList = document.getElementById("results");
const errorBox = document.getElementById("error");
const generateModelBtn = document.getElementById("generateModelBtn");

/* -----------------------------
   SEARCH FUNCTION
----------------------------- */
async function search() {
  errorBox.textContent = "";
  suggestionsList.innerHTML = "";
  resultsList.innerHTML = "";

  const query = searchInput.value.trim();
  if (!query) return;

  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    errorBox.textContent = "Search failed.";
    return;
  }

  const data = await res.json();

  data.suggestions.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    li.onclick = () => {
      searchInput.value = s;
      search();
    };
    suggestionsList.appendChild(li);
  });

  data.places.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.name;
    li.onclick = () => selectPlace(p);
    resultsList.appendChild(li);
  });
}

searchBtn.onclick = search;

/* -----------------------------
   SELECT PLACE
----------------------------- */
function selectPlace(place) {
  selectedPlace = place;
  generateModelBtn.disabled = false;

  map.setView([place.latitude, place.longitude], 15);
  L.marker([place.latitude, place.longitude]).addTo(map);
}

/* -----------------------------
   GENERATE 3D MODEL
----------------------------- */
generateModelBtn.onclick = async () => {
  if (!selectedPlace) return;

  const res = await fetch("/api/generate-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selectedPlace),
  });

  const data = await res.json();
  renderModel(data.modelDescription);
};

/* -----------------------------
   THREE.JS MODEL PREVIEW
----------------------------- */
function renderModel(description) {
  const canvas = document.getElementById("modelCanvas");

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(380, 380);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.z = 3;

  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);

  // Placeholder: cube model
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }

  animate();
}
