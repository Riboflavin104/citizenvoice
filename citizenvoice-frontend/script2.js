function bookComplaint() {
    window.location.href = "index1.html";
}

function trackComplaint() {
    window.location.href = "track.html";
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

async function toggleAuthorityLink() {
    const authorityLink = document.getElementById("authorityLink");

    // If this page doesn't have the authority link, do nothing
    if (!authorityLink) return;

    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabaseClient
        .from("profiles")
        .select("is_authority")
        .eq("id", user.id)
        .single();

    if (profile && profile.is_authority) {
        authorityLink.style.display = "inline";
    }
}

toggleAuthorityLink();