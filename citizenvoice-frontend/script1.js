// ============================================================
// Complaint submission — now actually sends data to the backend
// ============================================================

const form = document.getElementById("complaintForm");

// script1.js is loaded on every page, but the complaint form only exists on
// index1.html — skip everything below on pages that don't have it.
if (form) {
    requireLogin(); // bounce to login page if not signed in

    const message = document.getElementById("message");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const title = document.getElementById("title").value;
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;
        const photoInput = document.getElementById("photo");
        const photo = photoInput.files[0];

        const token = await getAccessToken();
        if (!token) {
            message.textContent = "You must be logged in to submit a complaint.";
            window.location.href = "index.html";
            return;
        }

        // FastAPI's Form()/File() params expect multipart/form-data — FormData
        // builds exactly that, including the file, in one request.
        const formData = new FormData();
        formData.append("title", title);
        formData.append("description", description);
        formData.append("location", location);
        if (photo) {
            formData.append("photo", photo);
        }

        message.textContent = "Submitting...";

        try {
            const response = await fetch(`${API_BASE_URL}/complaints`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Don't set Content-Type manually — the browser sets the
                    // correct multipart boundary automatically for FormData.
                },
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || "Submission failed");
            }

            const result = await response.json();

            message.textContent =
                `Complaint submitted! Category: ${result.category} | Priority: ${result.priority_label}` +
                (result.is_duplicate ? " (similar complaint already on file — merged)" : "");

            form.reset();
        } catch (err) {
            message.textContent = "Error: " + err.message;
        }
    });
}
