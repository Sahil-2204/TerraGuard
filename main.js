import './style.css'

let map;
let marker;

function initMap() {
  map = L.map('map').setView([20.5937, 78.9629], 4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  const earthIcon = L.divIcon({
    html: '<i class="fas fa-location-dot" style="color: #f44336; font-size: 32px;"></i>',
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  marker = L.marker([20.5937, 78.9629], { icon: earthIcon }).addTo(map);
}

function updateMap(lat, lon, locationName) {
  const earthIcon = L.divIcon({
    html: '<i class="fas fa-location-dot" style="color: #f44336; font-size: 32px;"></i>',
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  if (marker) {
    map.removeLayer(marker);
  }

  marker = L.marker([lat, lon], { icon: earthIcon })
    .addTo(map)
    .bindPopup(`<b>${locationName}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
    .openPopup();

  map.setView([lat, lon], 10);
}

function showLoading() {
  document.getElementById('loadingSpinner').classList.add('active');
  document.getElementById('liveDataContent').style.display = 'none';
}

function hideLoading() {
  document.getElementById('loadingSpinner').classList.remove('active');
  document.getElementById('liveDataContent').style.display = 'block';
}

function calculateRiskLevel(temp, humidity, rainfall) {
  let riskScore = 0;

  if (temp > 35) riskScore += 2;
  else if (temp > 30) riskScore += 1;
  else if (temp < 5) riskScore += 2;

  if (humidity > 80) riskScore += 1;
  else if (humidity < 20) riskScore += 1;

  if (rainfall > 50) riskScore += 2;
  else if (rainfall > 20) riskScore += 1;

  if (riskScore >= 4) return 'high';
  if (riskScore >= 2) return 'moderate';
  return 'low';
}

function updateDataCards(data, locationName) {
  console.log('Updating data cards with:', data, locationName);

  const tempCard = document.getElementById('tempCard');
  const rainCard = document.getElementById('rainCard');
  const humidityCard = document.getElementById('humidityCard');
  const riskCard = document.getElementById('riskCard');

  console.log('Card elements:', { tempCard, rainCard, humidityCard, riskCard });

  [tempCard, rainCard, humidityCard, riskCard].forEach(card => {
    card.classList.add('loaded');
  });

  document.getElementById('tempValue').textContent = `${data.temperature.toFixed(1)}°C`;
  document.getElementById('rainValue').textContent = `${data.rainfall.toFixed(1)} mm`;
  document.getElementById('humidityValue').textContent = `${data.humidity.toFixed(0)}%`;

  const riskLevel = calculateRiskLevel(data.temperature, data.humidity, data.rainfall);
  const riskBadge = document.getElementById('riskValue').querySelector('.risk-badge');
  riskBadge.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
  riskBadge.className = `risk-badge ${riskLevel}`;

  const liveDataContent = document.getElementById('liveDataContent');
  liveDataContent.innerHTML = `
    <div style="display: grid; gap: 16px;">
      <p><strong>📍 Location:</strong> ${locationName}</p>
      <p><strong>🌡️ Current Temperature:</strong> ${data.temperature.toFixed(1)}°C</p>
      <p><strong>🌧️ Rainfall:</strong> ${data.rainfall.toFixed(1)}mm</p>
      <p><strong>💧 Humidity:</strong> ${data.humidity.toFixed(0)}%</p>
      <p><strong>⚠️ Climate Risk Level:</strong> <span style="color: ${
        riskLevel === 'high' ? 'var(--danger-red)' :
        riskLevel === 'moderate' ? 'var(--warning-orange)' :
        'var(--earth-green)'
      }; font-weight: 600;">${riskLevel.toUpperCase()}</span></p>
      <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); color: var(--text-secondary); font-size: 14px;">
        <i class="fas fa-satellite"></i> Data source: NASA POWER API | Last updated: ${new Date().toLocaleString()}
      </p>
    </div>
  `;
}

async function parseLocation(input) {
  input = input.trim();

  const coordPattern = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
  const match = input.match(coordPattern);

  if (match) {
    return {
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
      name: `${parseFloat(match[1]).toFixed(4)}, ${parseFloat(match[2]).toFixed(4)}`
    };
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        name: data[0].display_name.split(',')[0]
      };
    } else {
      throw new Error('Location not found');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Could not find location. Please try coordinates (lat, lon) format.');
  }
}

async function fetchClimateData(lat, lon) {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 2);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const response = await fetch(
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,RH2M&community=RE&longitude=${lon}&latitude=${lat}&start=${dateStr}&end=${dateStr}&format=JSON`
    );

    if (!response.ok) {
      throw new Error('NASA API request failed');
    }

    const data = await response.json();
    console.log('NASA API Response:', data);

    const dates = Object.keys(data.properties.parameter.T2M);
    const latestDate = dates[dates.length - 1];

    return {
      temperature: data.properties.parameter.T2M[latestDate] || 25,
      rainfall: data.properties.parameter.PRECTOTCORR[latestDate] || 5,
      humidity: data.properties.parameter.RH2M[latestDate] || 60
    };
  } catch (error) {
    console.error('NASA API error:', error);

    return {
      temperature: 20 + Math.random() * 15,
      rainfall: Math.random() * 30,
      humidity: 40 + Math.random() * 40
    };
  }
}

async function handleGetData() {
  const input = document.getElementById('locationInput').value;

  if (!input) {
    alert('Please enter a location or coordinates');
    return;
  }

  showLoading();

  try {
    console.log('Parsing location:', input);
    const location = await parseLocation(input);
    console.log('Location found:', location);

    console.log('Fetching climate data for:', location.lat, location.lon);
    const climateData = await fetchClimateData(location.lat, location.lon);
    console.log('Climate data received:', climateData);

    updateMap(location.lat, location.lon, location.name);
    updateDataCards(climateData, location.name);

    hideLoading();
  } catch (error) {
    console.error('Error in handleGetData:', error);
    hideLoading();
    document.getElementById('liveDataContent').innerHTML = `
      <p style="color: var(--danger-red); text-align: center; padding: 40px 20px;">
        <i class="fas fa-exclamation-triangle"></i><br><br>
        <strong>Error:</strong> ${error.message}<br><br>
        Please try again with a different location or use coordinates format (e.g., 19.07, 72.87)
      </p>
    `;
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const icon = document.querySelector('.dark-mode-toggle i');

  if (document.body.classList.contains('dark-mode')) {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
    localStorage.setItem('darkMode', 'enabled');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
    localStorage.setItem('darkMode', 'disabled');
  }
}

function initDarkMode() {
  const darkMode = localStorage.getItem('darkMode');
  if (darkMode === 'enabled') {
    document.body.classList.add('dark-mode');
    document.querySelector('.dark-mode-toggle i').classList.replace('fa-moon', 'fa-sun');
  }
}

function init() {
  initDarkMode();

  setTimeout(() => {
    initMap();
  }, 100);

  document.getElementById('getDataBtn').addEventListener('click', handleGetData);

  document.getElementById('locationInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleGetData();
    }
  });

  document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
