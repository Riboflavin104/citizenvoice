// ============================================================
// Track page — fetches the logged-in citizen's own complaints
// ============================================================

requireLogin();

const listEl = document.getElementById("complaintsList");

const STATUS_LABELS = {
    submitted: "Submitted",
    in_review: "In Review",
    in_progress: "In Progress",
    resolved: "Resolved",
    rejected: "Rejected",
};

async function loadComplaints() {
    const token = await getAccessToken();

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/mine`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error("Could not load complaints");
        }

        const complaints = await response.json();

        if (complaints.length === 0) {
            listEl.innerHTML = "<p>You haven't submitted any complaints yet.</p>";
            return;
        }

        listEl.innerHTML = complaints
            .map(
                (c) => `
            <div class="form-group" style="border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:14px;">
                <strong>${c.category || "Uncategorized"}</strong>
                <span style="float:right; text-transform:uppercase; font-size:12px;">
                    ${STATUS_LABELS[c.status] || c.status}
                </span>
                <p style="margin-top:8px; color:#555;">${c.raw_text}</p>
                <p style="margin-top:6px; font-size:12px; color:#888;">
                    Priority: ${c.priority_label} · Submitted: ${new Date(c.created_at).toLocaleDateString()}
                </p>
                ${c.photo_url ? `<img src="${c.photo_url}" style="max-width:150px; margin-top:8px; border-radius:6px;">` : ""}
            </div>
        `
            )
            .join("");
    } catch (err) {
        listEl.innerHTML = `<p>Error loading complaints: ${err.message}</p>`;
    }
}

loadComplaints();
