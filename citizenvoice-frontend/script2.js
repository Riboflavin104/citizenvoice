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
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabaseClient
        .from("profiles")
        .select("is_authority")
        .eq("id", user.id)
        .single();

    const authorityLink = document.getElementById("authorityLink");

    if (authorityLink && profile && profile.is_authority) {
        authorityLink.style.display = "inline";
    }
}

toggleAuthorityLink();