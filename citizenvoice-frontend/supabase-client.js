// ============================================================
// Shared Supabase client + API config — loaded on every page
// ============================================================

// Fill these in from Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = "https://jdwrzstdjdmvwfbtqsbv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkd3J6c3RkamRtdndmYnRxc2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMzkwMzIsImV4cCI6MjEwMzgxNTAzMn0.axLewiVg2HpFB-a8c_72hokQFZrNCNUxJQV9q6zcAFU"; // safe to expose in frontend

// Your FastAPI backend's base URL (uvicorn default shown here)
const API_BASE_URL = "http://localhost:8000";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Small helper: get the current logged-in user's access token (or null)
async function getAccessToken() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session ? data.session.access_token : null;
}

// Small helper: redirect to login if nobody is signed in.
// Call this at the top of pages that require auth (dashboard, complaint form).
async function requireLogin() {
    const token = await getAccessToken();
    if (!token) {
        window.location.href = "index.html";
    }
}
