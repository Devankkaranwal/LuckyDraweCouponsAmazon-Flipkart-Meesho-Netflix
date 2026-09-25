// ============================================
// CONFIG
// ============================================
const API_URL = 'https://locationtrackbackend.onrender.com';
// Local test ke liye: 'http://localhost:5001'

// ============================================
// STATE
// ============================================
let map = null;
let miniMap = null;
let mapMarkers = [];
let currentMiniMarker = null;
let allLocations = [];

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  bindEvents();
  checkServerStatus();
  loadAllLocations();
  loadStats();
  
  // Auto refresh every 30 seconds
  setInterval(() => {
    loadAllLocations();
    loadStats();
  }, 30000);
});

// ============================================
// MAP INITIALIZATION
// ============================================
function initMap() {
  map = L.map('map').setView([20.5937, 78.9629], 4);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);
}

function initMiniMap(lat, lng) {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
  
  miniMap = L.map('miniMap').setView([lat, lng], 16);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(miniMap);
  
  L.marker([lat, lng]).addTo(miniMap)
    .bindPopup('📍 You are here')
    .openPopup();
}

// ============================================
// EVENT BINDINGS
// ============================================
function bindEvents() {
  document.getElementById('btnIPLocation').addEventListener('click', getIPLocation);
  document.getElementById('btnGPSLocation').addEventListener('click', getGPSLocation);
  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadAllLocations();
    loadStats();
    showToast('Refreshed!', 'info');
  });
  document.getElementById('btnDeleteAll').addEventListener('click', deleteAllLocations);
  document.getElementById('closeCurrent').addEventListener('click', () => {
    document.getElementById('currentLocationSection').style.display = 'none';
  });
}

// ============================================
// SERVER STATUS
// ============================================
async function checkServerStatus() {
  const badge = document.getElementById('statusBadge');
  const text = document.getElementById('statusText');
  
  try {
    const res = await fetch(API_URL, { method: 'GET' });
    if (res.ok) {
      badge.classList.remove('offline');
      text.textContent = 'Online';
    } else {
      throw new Error('Offline');
    }
  } catch (err) {
    badge.classList.add('offline');
    text.textContent = 'Offline';
  }
}

// ============================================
// GET IP LOCATION
// ============================================
async function getIPLocation() {
  const btn = document.getElementById('btnIPLocation');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Getting...';
  
  try {
    const res = await fetch(`${API_URL}/api/location/ip`);
    const data = await res.json();
    
    if (data.success) {
      showToast(`📍 Location saved: ${data.data.city || 'Unknown'}`, 'success');
      showCurrentLocation(data.data);
      loadAllLocations();
      loadStats();
    } else {
      showToast(data.message || 'Failed to get location', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error — server might be sleeping (30s wait)', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🌐</span> Get IP Location';
  }
}

// ============================================
// GET GPS LOCATION
// ============================================
async function getGPSLocation() {
  const btn = document.getElementById('btnGPSLocation');
  
  if (!navigator.geolocation) {
    showToast('GPS not supported by your browser', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Locating...';
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        const res = await fetch(`${API_URL}/api/location/coords`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude })
        });
        
        const data = await res.json();
        
        if (data.success) {
          showToast(`📍 GPS location saved!`, 'success');
          showCurrentLocation(data.data);
          loadAllLocations();
          loadStats();
        } else {
          showToast(data.message || 'Failed to save GPS location', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Network error while saving GPS', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📡</span> Get GPS Location';
      }
    },
    (error) => {
      btn.disabled = false;
      btn.innerHTML = '<span>📡</span> Get GPS Location';
      
      let msg = 'GPS access denied';
      if (error.code === 1) msg = 'Permission denied. Please allow location.';
      if (error.code === 2) msg = 'Position unavailable';
      if (error.code === 3) msg = 'Request timeout';
      
      showToast(msg, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// ============================================
// SHOW CURRENT LOCATION CARD (Full Address ke saath)
// ============================================
function showCurrentLocation(loc) {
  const section = document.getElementById('currentLocationSection');
  section.style.display = 'block';
  
  const details = document.getElementById('currentDetails');
  
  // Full address section - agar available hai
  const fullAddressHtml = loc.fullAddress ? `
    <div class="detail-item full-width">
      <div class="detail-label">📮 Full Address</div>
      <div class="detail-value address-text">${escapeHtml(loc.fullAddress)}</div>
    </div>
  ` : '';
  
  // House number - agar hai
  const houseHtml = loc.houseNumber ? `
    <div class="detail-item">
      <div class="detail-label">🏠 House / Building</div>
      <div class="detail-value">${escapeHtml(loc.houseNumber)}</div>
    </div>
  ` : '';
  
  // Road - agar hai
  const roadHtml = loc.road ? `
    <div class="detail-item">
      <div class="detail-label">🛣️ Street / Road</div>
      <div class="detail-value">${escapeHtml(loc.road)}</div>
    </div>
  ` : '';
  
  // Area - agar hai
  const areaHtml = loc.area ? `
    <div class="detail-item">
      <div class="detail-label">📍 Area / Locality</div>
      <div class="detail-value">${escapeHtml(loc.area)}</div>
    </div>
  ` : '';
  
  details.innerHTML = `
    ${fullAddressHtml}
    ${houseHtml}
    ${roadHtml}
    ${areaHtml}
    <div class="detail-item">
      <div class="detail-label">🏙️ City</div>
      <div class="detail-value">${escapeHtml(loc.city || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">🗺️ State</div>
      <div class="detail-value">${escapeHtml(loc.state || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">🌍 Country</div>
      <div class="detail-value">${escapeHtml(loc.country || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">📮 Pincode</div>
      <div class="detail-value">${escapeHtml(loc.pincode || 'N/A')}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">🧭 Latitude</div>
      <div class="detail-value">${loc.latitude || 'N/A'}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">🧭 Longitude</div>
      <div class="detail-value">${loc.longitude || 'N/A'}</div>
    </div>
  `;
  
  if (loc.latitude && loc.longitude) {
    setTimeout(() => {
      initMiniMap(loc.latitude, loc.longitude);
    }, 100);
  }
  
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// LOAD ALL LOCATIONS
// ============================================
async function loadAllLocations() {
  try {
    const res = await fetch(`${API_URL}/api/location/all`);
    const data = await res.json();
    
    if (data.success) {
      allLocations = data.data;
      renderLocationsList(data.data);
      renderMapMarkers(data.data);
      document.getElementById('listCount').textContent = data.data.length;
    }
  } catch (err) {
    console.error('Failed to load locations:', err);
  }
}

// ============================================
// RENDER LOCATIONS LIST (Full Address ke saath)
// ============================================
function renderLocationsList(locations) {
  const list = document.getElementById('locationsList');
  
  if (!locations || locations.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span>📭</span>
        <p>No locations yet</p>
        <small>Click "Get IP Location" to start</small>
      </div>
    `;
    return;
  }
  
  list.innerHTML = locations.map(loc => {
    const city = loc.city || 'Unknown';
    const state = loc.state || '';
    const country = loc.country || '';
    const method = loc.method || 'IP-based';
    const methodClass = method === 'GPS-based' ? 'method-gps' : 'method-ip';
    
    const timeAgo = loc.createdAt?._seconds 
      ? getTimeAgo(loc.createdAt._seconds * 1000)
      : 'Just now';
    
    // Full address ya city/state/country fallback
    const addressLine = loc.fullAddress || 
      [city, state, country].filter(Boolean).join(', ');
    
    return `
      <div class="location-item" onclick="focusLocation(${loc.latitude}, ${loc.longitude})">
        <div class="location-icon">📍</div>
        <div class="location-info">
          <div class="location-city">${escapeHtml(city)}${state ? ', ' + escapeHtml(state) : ''}</div>
          <div class="location-meta">
            ${escapeHtml(addressLine)}
          </div>
          <div class="location-meta" style="opacity:0.7;">
            🕐 ${timeAgo}
          </div>
          <span class="location-method ${methodClass}">${method}</span>
        </div>
        <button class="delete-loc-btn" onclick="event.stopPropagation(); deleteLocation('${loc.id}')" title="Delete">✕</button>
      </div>
    `;
  }).join('');
}

// ============================================
// RENDER MAP MARKERS (Full Address ke saath)
// ============================================
function renderMapMarkers(locations) {
  mapMarkers.forEach(m => map.removeLayer(m));
  mapMarkers = [];
  
  if (!locations || locations.length === 0) {
    document.getElementById('mapCount').textContent = '0 pins';
    return;
  }
  
  const bounds = [];
  
  locations.forEach(loc => {
    if (!loc.latitude || !loc.longitude) return;
    
    const addressLine = loc.fullAddress || 
      [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
    
    const marker = L.marker([loc.latitude, loc.longitude])
      .addTo(map)
      .bindPopup(`
        <div style="font-family: Inter, sans-serif; max-width: 250px;">
          <strong style="font-size:14px;">📍 ${escapeHtml(loc.city || 'Unknown')}</strong><br>
          <span style="color:#666;font-size:12px;line-height:1.4;">${escapeHtml(addressLine)}</span><br>
          <span style="font-size:11px;color:#999;margin-top:4px;display:inline-block;">${loc.method}</span>
        </div>
      `);
    
    mapMarkers.push(marker);
    bounds.push([loc.latitude, loc.longitude]);
  });
  
  document.getElementById('mapCount').textContent = `${mapMarkers.length} pins`;
  
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }
}

// ============================================
// FOCUS ON LOCATION
// ============================================
window.focusLocation = function(lat, lng) {
  if (!lat || !lng) return;
  map.setView([lat, lng], 16);
  document.querySelector('.map-container').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// ============================================
// DELETE SINGLE LOCATION
// ============================================
window.deleteLocation = async function(id) {
  if (!confirm('Delete this location?')) return;
  
  try {
    const res = await fetch(`${API_URL}/api/location/${id}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (data.success) {
      showToast('Location deleted', 'success');
      loadAllLocations();
      loadStats();
    }
  } catch (err) {
    showToast('Delete failed', 'error');
  }
};

// ============================================
// DELETE ALL LOCATIONS
// ============================================
async function deleteAllLocations() {
  if (!confirm('⚠️ Delete ALL locations? This cannot be undone.')) return;
  
  try {
    for (const loc of allLocations) {
      await fetch(`${API_URL}/api/location/${loc.id}`, { method: 'DELETE' });
    }
    showToast('All locations deleted', 'success');
    loadAllLocations();
    loadStats();
  } catch (err) {
    showToast('Failed to delete all', 'error');
  }
}

// ============================================
// LOAD STATS
// ============================================
async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/api/location/stats/summary`);
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('totalLocations').textContent = data.total || 0;
      
      const cities = data.topCities?.length || 0;
      document.getElementById('totalCities').textContent = cities;
      
      const countries = new Set(allLocations.map(l => l.country).filter(Boolean));
      document.getElementById('totalCountries').textContent = countries.size;
      
      renderTopCities(data.topCities || []);
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ============================================
// RENDER TOP CITIES
// ============================================
function renderTopCities(cities) {
  const container = document.getElementById('topCities');
  
  if (!cities || cities.length === 0) {
    container.innerHTML = '<div class="empty-state small"><p>No data yet</p></div>';
    return;
  }
  
  container.innerHTML = cities.map(c => `
    <div class="city-chip">
      <span class="city-name">${escapeHtml(c.city || 'Unknown')}</span>
      <span class="city-count">${c.count}</span>
    </div>
  `).join('');
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ============================================
// HELPERS
// ============================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}