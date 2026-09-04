// ============================================================
// CitizenVoice — Complaint submission + GPS location capture
// ============================================================

const form = document.getElementById("complaintForm");

// script1.js is loaded on every page, but the complaint form only
// exists on index1.html — skip everything below on other pages.
if (form) {
    requireLogin(); // bounce to login page if not signed in

    const message = document.getElementById("message");

    // ========================================================
    // GPS ELEMENTS
    // ========================================================

    const gpsBtn = document.getElementById("gpsBtn");
    const latitudeInput = document.getElementById("latitude");
    const longitudeInput = document.getElementById("longitude");
    const gpsStatus = document.getElementById("gpsStatus");
    const gpsMapPreview = document.getElementById("gpsMapPreview");

    // ========================================================
    // USE CURRENT LOCATION
    // ========================================================

    if (gpsBtn) {
        gpsBtn.addEventListener("click", function () {
            if (!navigator.geolocation) {
                gpsStatus.textContent =
                    "Geolocation is not supported by this browser.";
                return;
            }

            gpsBtn.disabled = true;
            gpsBtn.textContent = "📍 Getting location...";
            gpsStatus.textContent = "Requesting location permission...";

            navigator.geolocation.getCurrentPosition(
                // SUCCESS
                function (position) {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    // Store coordinates in hidden fields
                    latitudeInput.value = latitude;
                    longitudeInput.value = longitude;

                    gpsStatus.textContent =
                        `Location captured: ${latitude.toFixed(6)}, ` +
                        `${longitude.toFixed(6)} ` +
                        `(accuracy ~${Math.round(accuracy)} m)`;

                    gpsBtn.disabled = false;
                    gpsBtn.textContent = "📍 Location captured";

                    // Show a small map preview when Leaflet is available
                    if (gpsMapPreview && typeof L !== "undefined") {
                        gpsMapPreview.style.display = "block";

                        if (window.gpsMap) {
                            window.gpsMap.remove();
                        }

                        window.gpsMap = L.map("gpsMapPreview").setView(
                            [latitude, longitude],
                            16
                        );

                        L.tileLayer(
                            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                            {
                                attribution:
                                    "&copy; OpenStreetMap contributors"
                            }
                        ).addTo(window.gpsMap);

                        L.marker([latitude, longitude])
                            .addTo(window.gpsMap)
                            .bindPopup("Your complaint location")
                            .openPopup();
                    }
                },

                // ERROR
                function (error) {
                    gpsBtn.disabled = false;
                    gpsBtn.textContent = "📍 Use my current location";

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            gpsStatus.textContent =
                                "Location permission was denied. " +
                                "Please allow location access in your browser.";
                            break;

                        case error.POSITION_UNAVAILABLE:
                            gpsStatus.textContent =
                                "Your location could not be determined. " +
                                "Please try again.";
                            break;

                        case error.TIMEOUT:
                            gpsStatus.textContent =
                                "Location request timed out. " +
                                "Please try again.";
                            break;

                        default:
                            gpsStatus.textContent =
                                "Unable to get your location.";
                    }
                },

                // OPTIONS
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // ========================================================
    // COMPLAINT SUBMISSION
    // ========================================================

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const title = document.getElementById("title").value;
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;

        const photoInput = document.getElementById("photo");
        const photo = photoInput.files[0];

        // Read GPS coordinates captured by the button
        const latitude = latitudeInput
            ? latitudeInput.value
            : "";

        const longitude = longitudeInput
            ? longitudeInput.value
            : "";

        const token = await getAccessToken();

        if (!token) {
            message.textContent =
                "You must be logged in to submit a complaint.";

            window.location.href = "index.html";
            return;
        }

        // ====================================================
        // BUILD MULTIPART FORM DATA
        // ====================================================

        const formData = new FormData();

        formData.append("title", title);
        formData.append("description", description);
        formData.append("location", location);

        // Send GPS coordinates when available
        if (latitude && longitude) {
            formData.append("latitude", latitude);
            formData.append("longitude", longitude);
        }

        // Send photo when selected
        if (photo) {
            formData.append("photo", photo);
        }

        message.textContent = "Submitting...";

        try {
            const response = await fetch(
                `${API_BASE_URL}/complaints`,
                {
                    method: "POST",

                    headers: {
                        Authorization: `Bearer ${token}`,

                        // Do not set Content-Type manually.
                        // The browser sets the multipart boundary
                        // automatically for FormData.
                    },

                    body: formData
                }
            );

            if (!response.ok) {
                const err = await response
                    .json()
                    .catch(() => ({}));

                throw new Error(
                    err.detail || "Submission failed"
                );
            }

            const result = await response.json();

            message.textContent =
                `Complaint submitted! Category: ${result.category} | ` +
                `Priority: ${result.priority_label}` +
                (
                    result.is_duplicate
                        ? " (similar complaint already on file — merged)"
                        : ""
                );

            // =================================================
            // RESET FORM AFTER SUCCESS
            // =================================================

            form.reset();

            // Reset GPS status
            if (gpsStatus) {
                gpsStatus.textContent = "";
            }

            // Hide map
            if (gpsMapPreview) {
                gpsMapPreview.style.display = "none";
            }

            // Remove Leaflet map
            if (window.gpsMap) {
                window.gpsMap.remove();
                window.gpsMap = null;
            }

            // Reset GPS button
            if (gpsBtn) {
                gpsBtn.textContent =
                    "📍 Use my current location";

                gpsBtn.disabled = false;
            }

        } catch (err) {
            message.textContent =
                "Error: " + err.message;
        }
    });
}