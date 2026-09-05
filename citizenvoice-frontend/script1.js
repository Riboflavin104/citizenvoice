// ============================================================
// CitizenVoice — Complaint submission + GPS location capture
// ============================================================

const complaintForm = document.getElementById("complaintForm");

if (complaintForm) {
    requireLogin();

    const message = document.getElementById("message");
    const gpsBtn = document.getElementById("gpsBtn");
    const latitudeInput = document.getElementById("latitude");
    const longitudeInput = document.getElementById("longitude");
    const locationInput = document.getElementById("location");
    const gpsStatus = document.getElementById("gpsStatus");
    const gpsMapPreview = document.getElementById("gpsMapPreview");

    let gpsMap = null;
    let gpsMarker = null;

    function setGpsButton(text, disabled = false) {
        if (!gpsBtn) return;
        gpsBtn.textContent = text;
        gpsBtn.disabled = disabled;
    }

    async function reverseGeocode(latitude, longitude) {
        // Converts GPS coordinates into a readable address.
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", latitude);
        url.searchParams.set("lon", longitude);
        url.searchParams.set("zoom", "18");
        url.searchParams.set("addressdetails", "1");

        const response = await fetch(url.toString(), {
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) throw new Error("Could not convert GPS coordinates to an address.");

        const data = await response.json();
        return data.display_name || "";
    }

    function showMap(latitude, longitude) {
        if (!gpsMapPreview || typeof L === "undefined") return;

        gpsMapPreview.style.display = "block";

        if (!gpsMap) {
            gpsMap = L.map("gpsMapPreview");

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
            }).addTo(gpsMap);
        }

        const latLng = [latitude, longitude];
        gpsMap.setView(latLng, 17);

        if (gpsMarker) {
            gpsMarker.setLatLng(latLng);
        } else {
            gpsMarker = L.marker(latLng).addTo(gpsMap);
        }

        gpsMarker.bindPopup("Complaint location").openPopup();

        // Leaflet needs this after a previously hidden map becomes visible.
        setTimeout(() => gpsMap.invalidateSize(), 100);
    }

    async function captureLocation() {
        if (!navigator.geolocation) {
            gpsStatus.textContent = "Geolocation is not supported by this browser.";
            return;
        }

        // Geolocation requires HTTPS in production (localhost is also allowed).
        if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
            gpsStatus.textContent = "Location requires HTTPS. Open the deployed site using https://.";
            return;
        }

        setGpsButton("📍 Getting location...", true);
        gpsStatus.textContent = "Requesting your current location...";

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                latitudeInput.value = String(latitude);
                longitudeInput.value = String(longitude);

                showMap(latitude, longitude);

                gpsStatus.textContent =
                    `GPS captured (${latitude.toFixed(6)}, ${longitude.toFixed(6)}). Getting readable address...`;

                try {
                    const address = await reverseGeocode(latitude, longitude);
                    if (address) locationInput.value = address;

                    gpsStatus.textContent =
                        `Location captured successfully (accuracy approximately ${Math.round(accuracy)} m).`;
                } catch (error) {
                    // Coordinates are still valid even when reverse geocoding fails.
                    gpsStatus.textContent =
                        `GPS coordinates captured successfully (accuracy approximately ${Math.round(accuracy)} m). You can enter the address manually.`;
                }

                setGpsButton("📍 Location captured", false);
            },
            (error) => {
                const messages = {
                    [error.PERMISSION_DENIED]: "Location permission was denied. Allow location access in your browser settings and try again.",
                    [error.POSITION_UNAVAILABLE]: "Your current location is unavailable. Check that device location services are enabled.",
                    [error.TIMEOUT]: "The location request timed out. Please try again."
                };

                gpsStatus.textContent = messages[error.code] || "Unable to get your current location.";
                setGpsButton("📍 Use my current location", false);
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 30000
            }
        );
    }

    gpsBtn?.addEventListener("click", captureLocation);

    complaintForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const title = document.getElementById("title").value.trim();
        const description = document.getElementById("description").value.trim();
        const locationText = locationInput.value.trim();
        const photo = document.getElementById("photo").files[0];
        const latitude = latitudeInput.value.trim();
        const longitude = longitudeInput.value.trim();

        const token = await getAccessToken();
        if (!token) {
            message.textContent = "You must be logged in to submit a complaint.";
            window.location.href = "index.html";
            return;
        }

        const formData = new FormData();
        formData.append("title", title);
        formData.append("description", description);
        formData.append("location", locationText);

        if (latitude && longitude) {
            formData.append("latitude", latitude);
            formData.append("longitude", longitude);
        }

        if (photo) formData.append("photo", photo);

        const submitButton = complaintForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        message.textContent = "Submitting complaint...";

        try {
            const response = await fetch(`${API_BASE_URL}/complaints`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.detail || result.message || "Complaint submission failed.");
            }

            message.textContent =
                `Complaint submitted successfully! Category: ${result.category || "Unclassified"} | Priority: ${result.priority_label || "N/A"}`;

            complaintForm.reset();
            latitudeInput.value = "";
            longitudeInput.value = "";
            gpsStatus.textContent = "";

            if (gpsMapPreview) gpsMapPreview.style.display = "none";
            if (gpsMap) {
                gpsMap.remove();
                gpsMap = null;
                gpsMarker = null;
            }

            setGpsButton("📍 Use my current location", false);
        } catch (error) {
            console.error("Complaint submission error:", error);
            message.textContent = `Error: ${error.message}`;
        } finally {
            submitButton.disabled = false;
        }
    });
}
