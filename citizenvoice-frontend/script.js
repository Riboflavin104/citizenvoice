// ============================================================
// Login / Register popups — now backed by real Supabase Auth
// ============================================================

// ---------- Aadhaar format validation (mirrors backend's Verhoeff check) ----------
// Same algorithm as backend/app/services/aadhaar_service.py — kept in sync
// intentionally so frontend gives instant feedback, while the backend
// /users/validate-aadhaar endpoint remains the authoritative re-check
// (since anyone could bypass this JS and call the API directly).

const VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
];
const VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

function verhoeffValid(numStr) {
    let c = 0;
    const digits = numStr.split("").reverse().map(Number);
    for (let i = 0; i < digits.length; i++) {
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
    }
    return c === 0;
}

// Format only: 12 digits, doesn't start with 0/1, passes Verhoeff checksum.
// This does NOT verify the number is real or belongs to the user.
function isValidAadhaarFormat(raw) {
    const cleaned = raw.replace(/[\s-]/g, "");
    if (!/^[2-9][0-9]{11}$/.test(cleaned)) return false;
    return verhoeffValid(cleaned);
}

function maskAadhaar(raw) {
    const cleaned = raw.replace(/[\s-]/g, "");
    return "XXXXXXXX" + cleaned.slice(-4);
}

function login() {
    document.getElementById("loginPopup").style.display = "flex";
}

function register() {
    document.getElementById("loginPopup").style.display = "none";
    document.getElementById("registerPopup").style.display = "flex";
}

function closePopup() {
    document.getElementById("loginPopup").style.display = "none";
    document.getElementById("registerPopup").style.display = "none";
}

// LOGIN — replaces the old fake loginSuccess()
async function loginSuccess() {
    const popup = document.getElementById("loginPopup");
    const identifier = popup.querySelector('input[type="text"]').value.trim();
    const password = popup.querySelector('input[type="password"]').value;

    if (!identifier || !password) {
        alert("Please enter both email/mobile and password.");
        return;
    }

    const isPhone = /^\+?[0-9]{10,15}$/.test(identifier.replace(/[-\s]/g, ''));
    const credentials = { password: password };
    
    if (isPhone) {
        credentials.phone = identifier;
    } else {
        credentials.email = identifier;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword(credentials);

    if (error) {
        alert("Login failed: " + error.message);
        return;
    }

    // Success — Supabase has stored the session (incl. access token) for us.
    window.location.href = "index2.html";
}

// REGISTER — now includes Aadhaar format validation before creating the account
async function registerSuccess() {
    const fullName = document.getElementById("regFullName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const aadhaarRaw = document.getElementById("regAadhaar").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!fullName || !phone || !email || !aadhaarRaw || !password) {
        alert("Please fill in all fields, including Aadhaar number.");
        return;
    }

    // Quick client-side check first (instant feedback, no network call).
    if (!isValidAadhaarFormat(aadhaarRaw)) {
        alert("That doesn't look like a valid Aadhaar number. Please check the 12 digits and try again.");
        return;
    }

    // Authoritative re-check against the backend — never trust client-side
    // validation alone, since it can be bypassed by calling the API directly.
    let masked;
    try {
        const response = await fetch(`${API_BASE_URL}/users/validate-aadhaar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aadhaar_number: aadhaarRaw }),
        });
        const result = await response.json();

        if (!result.valid) {
            alert(result.message || "Aadhaar validation failed.");
            return;
        }
        masked = result.masked; // e.g. "XXXXXXXX9012" — this is what gets stored, never the raw number
    } catch (err) {
        alert("Could not verify Aadhaar number right now (backend unreachable). Please try again.");
        return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
                phone: phone,
                aadhaar_masked: masked, // reaches handle_new_user() trigger, stored masked only
            },
        },
    });

    if (error) {
        alert("Registration failed: " + error.message);
        return;
    }

    alert("Registration successful! You can now log in.");
    closePopup();
    login(); // open the login popup so they can sign in right away
}

// ========== COOKIE CONSENT BANNER ==========
document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('cookieConsent')) return;

    var banner = document.createElement('div');
    banner.id = 'cookieBanner';
    banner.innerHTML =
        '<span>We use cookies to improve your experience. ' +
        '<a href="privacy-policy.html" style="color:#a465ec;">Learn more</a></span>' +
        '<button id="cookieAccept">Accept</button>';
    banner.style.cssText =
        'position:fixed;bottom:0;left:0;width:100%;background:#30204d;color:#fff;' +
        'padding:14px 20px;display:flex;align-items:center;justify-content:center;' +
        'gap:20px;font-size:14px;z-index:9999;';

    var btn = banner.querySelector('#cookieAccept');
    btn.style.cssText =
        'background:#8120dc;color:#fff;border:none;padding:8px 18px;' +
        'border-radius:5px;cursor:pointer;font-weight:bold;';

    document.body.appendChild(banner);

    document.getElementById('cookieAccept').addEventListener('click', function () {
        localStorage.setItem('cookieConsent', 'true');
        banner.style.display = 'none';
    });
});
