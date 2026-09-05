// ============================================================
// CitizenVoice — Dashboard navigation and logout
// ============================================================

function goTo(page) {
    window.location.assign(page);
}

function bookComplaint() {
    goTo("index1.html");
}

function trackComplaint() {
    goTo("track.html");
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } finally {
        window.location.assign("index.html");
    }
}

async function toggleAuthorityLink() {
    const authorityLink = document.getElementById("authorityLink");
    if (!authorityLink) return;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("is_authority")
            .eq("id", user.id)
            .maybeSingle();

        if (!error && profile?.is_authority) {
            authorityLink.style.display = "inline";
        }
    } catch (error) {
        console.error("Unable to check authority access:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("bookComplaintBtn")?.addEventListener("click", () => goTo("index1.html"));
    document.getElementById("trackComplaintBtn")?.addEventListener("click", () => goTo("track.html"));
    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    toggleAuthorityLink();
});
