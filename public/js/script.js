const socket = io();

const deviceName = prompt("Enter your device name:") || "Unknown Device";

const map = L.map("map").setView([0, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const markers = {};
const devices = {};
const routes = {};

let firstLocation = true;
let selectedDevice = null;
let followDevice = false;

const onlineCount = document.getElementById("onlineCount");

const deviceList = document.getElementById("deviceList");

const detailsPanel = document.getElementById("detailsPanel");

const detailsContent = document.getElementById("detailsContent");

const closeDetails = document.getElementById("closeDetails");

const followButton = document.getElementById("followButton");

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, speed } = position.coords;

      console.log("My location:", latitude, longitude);

      if (firstLocation) {
        map.setView([latitude, longitude], 15);

        firstLocation = false;
      }

      socket.emit("send-location", {
        latitude,
        longitude,

        accuracy,

        speed,

        timestamp: Date.now(),

        deviceName,
      });
    },

    (error) => {
      console.error("Location error:", error);
    },

    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    }
  );
} else {
  console.error("Geolocation is not supported.");
}

socket.on("receive-location", (data) => {
  const { id, latitude, longitude, accuracy, speed, timestamp, deviceName } =
    data;

  const position = [latitude, longitude];

  if (!devices[id]) {
    devices[id] = {
      id,

      latitude,

      longitude,

      accuracy,

      speed: 0,

      distance: 0,

      lastTimestamp: timestamp,

      deviceName,
    };
  } else {
    const previous = devices[id];

    const distance = calculateDistance(
      previous.latitude,
      previous.longitude,
      latitude,
      longitude
    );

    devices[id].distance += distance;

    if (timestamp && previous.lastTimestamp) {
      const timeDifference = (timestamp - previous.lastTimestamp) / 1000;

      if (timeDifference > 0) {
        devices[id].speed = (distance / timeDifference) * 3600;
      }
    }

    if (speed !== null && speed !== undefined && speed >= 0) {
      devices[id].speed = speed * 3.6;
    }

    devices[id].latitude = latitude;

    devices[id].longitude = longitude;

    devices[id].accuracy = accuracy;

    devices[id].lastTimestamp = timestamp;
  }

  // Marker

  if (markers[id]) {
    markers[id].setLatLng(position);
  } else {
    markers[id] = L.marker(position)
      .addTo(map)
      .bindPopup(`<b>${deviceName}</b>`);
  }

  // Route

  if (!routes[id]) {
    routes[id] = L.polyline([position], {
      weight: 4,
    }).addTo(map);
  } else {
    const points = routes[id].getLatLngs();

    points.push(L.latLng(latitude, longitude));

    routes[id].setLatLngs(points);
  }

  // Follow selected device

  if (followDevice && selectedDevice === id) {
    map.panTo(position, {
      animate: true,
    });
  }

  updateDeviceList();

  if (selectedDevice === id) {
    showDeviceDetails(id);
  }
});

socket.on("user-disconnected", (id) => {
  console.log("Device disconnected:", id);

  if (markers[id]) {
    map.removeLayer(markers[id]);

    delete markers[id];
  }

  if (routes[id]) {
    map.removeLayer(routes[id]);

    delete routes[id];
  }

  delete devices[id];

  if (selectedDevice === id) {
    selectedDevice = null;

    followDevice = false;

    detailsPanel.classList.add("hidden");
  }

  updateDeviceList();
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = toRadians(lat2 - lat1);

  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function updateDeviceList() {
  const deviceIds = Object.keys(devices);

  onlineCount.textContent = deviceIds.length;

  if (deviceIds.length === 0) {
    deviceList.innerHTML = `<p class="no-devices">
        No devices connected
      </p>`;

    return;
  }

  deviceList.innerHTML = "";

  deviceIds.forEach((id) => {
    const device = devices[id];

    const deviceElement = document.createElement("div");

    deviceElement.className = "device";

    if (selectedDevice === id) {
      deviceElement.classList.add("selected");
    }

    deviceElement.innerHTML = `

        <div class="device-name">
          🟢 ${device.deviceName}
        </div>

        <div class="device-status">
          Online
        </div>

        <div class="device-coordinates">
          ${device.latitude.toFixed(5)},
          ${device.longitude.toFixed(5)}
        </div>

        <div class="device-stat">
          Accuracy:
          ${Math.round(device.accuracy || 0)} m
        </div>

        <div class="device-stat">
          Distance:
          ${device.distance.toFixed(3)}
          km
        </div>

        <div class="device-stat">
          Speed:
          ${device.speed.toFixed(1)}
          km/h
        </div>

      `;

    deviceElement.addEventListener("click", () => {
      selectDevice(id);
    });

    deviceList.appendChild(deviceElement);
  });
}

function selectDevice(id) {
  selectedDevice = id;

  followDevice = false;

  const device = devices[id];

  if (!device) {
    return;
  }

  map.setView([device.latitude, device.longitude], 17);

  if (markers[id]) {
    markers[id].openPopup();
  }

  showDeviceDetails(id);

  updateDeviceList();
}

function showDeviceDetails(id) {
  const device = devices[id];

  if (!device) {
    return;
  }

  detailsPanel.classList.remove("hidden");

  detailsContent.innerHTML = `

    <div class="detail-name">
      🟢 ${device.deviceName}
    </div>

    <div class="detail-row">

      <span class="detail-label">
        Latitude
      </span>

      <span class="detail-value">
        ${device.latitude.toFixed(6)}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Longitude
      </span>

      <span class="detail-value">
        ${device.longitude.toFixed(6)}
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Accuracy
      </span>

      <span class="detail-value">
        ${Math.round(device.accuracy || 0)} m
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Speed
      </span>

      <span class="detail-value">
        ${device.speed.toFixed(1)}
        km/h
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Distance
      </span>

      <span class="detail-value">
        ${device.distance.toFixed(3)}
        km
      </span>

    </div>


    <div class="detail-row">

      <span class="detail-label">
        Last Update
      </span>

      <span class="detail-value">
        ${getLastUpdate(device.lastTimestamp)}
      </span>

    </div>

  `;

  updateFollowButton();
}

function getLastUpdate(timestamp) {
  if (!timestamp) {
    return "Unknown";
  }

  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) {
    return "Just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  return `${minutes}m ago`;
}

followButton.addEventListener("click", () => {
  if (!selectedDevice) {
    return;
  }

  followDevice = !followDevice;

  updateFollowButton();

  if (followDevice) {
    const device = devices[selectedDevice];

    if (device) {
      map.panTo([device.latitude, device.longitude]);
    }
  }
});

function updateFollowButton() {
  if (followDevice) {
    followButton.textContent = "Stop Following";

    followButton.classList.add("active");
  } else {
    followButton.textContent = "Follow Device";

    followButton.classList.remove("active");
  }
}

closeDetails.addEventListener("click", () => {
  selectedDevice = null;

  followDevice = false;

  detailsPanel.classList.add("hidden");

  updateDeviceList();
});
