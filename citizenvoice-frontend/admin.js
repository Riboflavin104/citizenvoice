// ============================================================
// Authority Dashboard logic — hotspot map, list all complaints,
// update status. Requires the logged-in account to have
// is_authority = true in Supabase (see migration_authority.sql).
// ============================================================

requireLogin();

// ---------- Hotspot map (Leaflet) ----------

// Default center: India, zoomed out — will re-center once real data loads.
const map = L.map("hotspotMap").setView([20.5937, 78.9629], 5);

// Free OpenStreetMap tiles — no API key, no billing account needed.
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
}).addTo(map);

let hotspotMarkers = [];

function priorityColor(priority) {
    switch (priority) {
        case "critical": return "#c0202a";
        case "high": return "#e0641f";
        case "medium": return "#c99a00";
        default: return "#4a8f5c";
    }
}

// Marker size scales with complaint count so bigger clusters visually
// stand out — capped so one huge cluster doesn't dwarf the whole map.
function markerSize(count) {
    return Math.min(24 + count * 6, 60);
}

async function loadHotspots() {
    const token = await getAccessToken();

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/hotspots`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error("Could not load hotspots");
        }

        const hotspots = await response.json();

        // Clear any previously drawn markers before redrawing
        hotspotMarkers.forEach((m) => map.removeLayer(m));
        hotspotMarkers = [];

        const emptyNote = document.getElementById("mapEmptyNote");
        if (hotspots.length === 0) {
            emptyNote.style.display = "block";
            return;
        }
        emptyNote.style.display = "none";

        hotspots.forEach((spot) => {
            const size = markerSize(spot.count);
            const icon = L.divIcon({
                className: "hotspot-marker",
                html: spot.count,
                iconSize: [size, size],
            });

            const marker = L.marker([spot.latitude, spot.longitude], { icon }).addTo(map);

            // Recolor the div after Leaflet renders it, since divIcon html
            // doesn't take our priorityColor() styling directly.
            const el = marker.getElement();
            if (el) {
                const badge = el.querySelector(".hotspot-marker") || el;
                badge.style.background = priorityColor(spot.dominant_priority);
            }

            marker.bindPopup(`
                <strong>${spot.dominant_category}</strong><br>
                ${spot.count} complaint${spot.count > 1 ? "s" : ""} in this area<br>
                ${spot.unresolved} unresolved<br>
                Dominant priority: ${spot.dominant_priority}
            `);

            hotspotMarkers.push(marker);
        });

        // Re-center the map on the first (largest) cluster
        map.setView([hotspots[0].latitude, hotspots[0].longitude], 12);
    } catch (err) {
        console.error("Hotspot load error:", err);
    }
}

// ---------- Complaint list ----------

const listEl = document.getElementById("complaintsList");
const filterStatus = document.getElementById("filterStatus");
const filterCategory = document.getElementById("filterCategory");
const filterPriority = document.getElementById("filterPriority");

const STATUS_OPTIONS = ["submitted", "in_review", "in_progress", "resolved", "rejected"];
const STATUS_LABELS = {
    submitted: "Submitted",
    in_review: "In Review",
    in_progress: "In Progress",
    resolved: "Resolved",
    rejected: "Rejected",
};

function badgeClass(priority) {
    return `badge badge-${priority || "low"}`;
}

function statusDropdown(complaintId, currentStatus) {
    const options = STATUS_OPTIONS.map(
        (s) => `<option value="${s}" ${s === currentStatus ? "selected" : ""}>${STATUS_LABELS[s]}</option>`
    ).join("");
    return `<select data-id="${complaintId}">${options}</select>`;
}

function renderComplaints(complaints) {
    if (complaints.length === 0) {
        listEl.innerHTML = "<p>No complaints match these filters.</p>";
        return;
    }

    listEl.innerHTML = complaints
        .map(
            (c) => `
        <div class="complaint-card">
            <div class="row1">
                <strong>${c.category || "Uncategorized"}</strong>
                <span class="${badgeClass(c.priority_label)}">${c.priority_label}</span>
            </div>
            <p class="text">${c.raw_text}</p>
            <p class="meta">
                ${c.address || "No location"} ·
                Submitted ${new Date(c.created_at).toLocaleDateString()} ·
                Confidence ${c.classification_confidence ?? "n/a"}
            </p>
            ${
                c.duplicate_count > 1
                    ? `<p class="duplicate-flag"><i class="fa-solid fa-copy"></i> Reported ${c.duplicate_count} times</p>`
                    : ""
            }
            ${c.photo_url ? `<img src="${c.photo_url}" style="max-width:150px; margin-top:8px; border-radius:6px;">` : ""}
            <div class="status-row">
                ${statusDropdown(c.id, c.status)}
                <button data-save="${c.id}">Update Status</button>
            </div>
        </div>
    `
        )
        .join("");

    listEl.querySelectorAll("button[data-save]").forEach((btn) => {
        btn.addEventListener("click", () => handleStatusUpdate(btn));
    });
}

async function handleStatusUpdate(button) {
    const complaintId = button.getAttribute("data-save");
    const select = listEl.querySelector(`select[data-id="${complaintId}"]`);
    const newStatus = select.value;
    const token = await getAccessToken();

    button.disabled = true;
    button.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ new_status: newStatus }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || "Update failed");
        }

        button.textContent = "Saved ✓";
        setTimeout(() => {
            button.textContent = "Update Status";
            button.disabled = false;
        }, 1200);
    } catch (err) {
        alert("Error updating status: " + err.message);
        button.textContent = "Update Status";
        button.disabled = false;
    }
}

async function loadComplaints() {
    const token = await getAccessToken();

    const params = new URLSearchParams();
    if (filterStatus.value) params.append("status", filterStatus.value);
    if (filterCategory.value) params.append("category", filterCategory.value);
    if (filterPriority.value) params.append("priority_label", filterPriority.value);

    listEl.innerHTML = "Loading complaints...";

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/all?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 403) {
            listEl.innerHTML = "<p>You don't have authority access. This dashboard is for staff accounts only.</p>";
            return;
        }
        if (!response.ok) {
            throw new Error("Could not load complaints");
        }

        const complaints = await response.json();
        renderComplaints(complaints);
    } catch (err) {
        listEl.innerHTML = `<p>Error loading complaints: ${err.message}</p>`;
    }
}

filterStatus.addEventListener("change", loadComplaints);
filterCategory.addEventListener("change", loadComplaints);
filterPriority.addEventListener("change", loadComplaints);

loadHotspots();
loadComplaints();
