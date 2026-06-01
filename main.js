// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    // ImgBB API key for free cloud image hosting
    IMGBB_API_KEY: "425cd153d4752002c46373adf472529f",

    // GitHub username
    GITHUB_USERNAME: "winson24",

    // GitHub repository name
    GITHUB_REPO: "jann-artwork",

    // GitHub token is stored in localStorage (entered via Admin Panel)
    // This keeps it out of the source code so GitHub won't block it
    get GITHUB_TOKEN() {
        return localStorage.getItem("githubToken") || "";
    },

    // Path in your repo where artwork data JSON will be saved
    DATA_FILE_PATH: "data/artworks.json"
};


// ============================================================
// System Constants & State
// ============================================================
const DEFAULT_PASSWORD = "JANN_ADMIN_ACCESS";
const DEFAULT_QUESTION = "What is the name of your signature brand?";
const DEFAULT_ANSWER = "Jann's Creation";

let currentFolderFilter = "all";
let isAdminAuthenticated = false;
let artworkData = []; // Loaded from GitHub JSON

// Initialize Storage Defaults if Empty
if (!localStorage.getItem("adminPassword")) localStorage.setItem("adminPassword", DEFAULT_PASSWORD);
if (!localStorage.getItem("securityQuestion")) localStorage.setItem("securityQuestion", DEFAULT_QUESTION);
if (!localStorage.getItem("securityAnswer")) localStorage.setItem("securityAnswer", DEFAULT_ANSWER);
if (!localStorage.getItem("folders")) localStorage.setItem("folders", JSON.stringify(["Bridal", "Pageantry"]));

// Profile Defaults
if (!localStorage.getItem("brandName")) localStorage.setItem("brandName", "JANN G. ARTWORK");
if (!localStorage.getItem("siteSubtitle")) localStorage.setItem("siteSubtitle", "Fashion Illustration");
if (!localStorage.getItem("defaultOwnership")) localStorage.setItem("defaultOwnership", "JANN G. ARTWORK");
if (!localStorage.getItem("contactPlatforms")) {
    const initialContacts = [{ name: "Instagram", url: "https://instagram.com/laiyts_" }];
    localStorage.setItem("contactPlatforms", JSON.stringify(initialContacts));
}

// ============================================================
// GitHub Data API — Load & Save artworks.json in the repo
// ============================================================

// Fetch artworks from GitHub repo JSON file
async function loadArtworksFromGitHub() {
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATA_FILE_PATH}`;
    try {
        const res = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                // Use token only if set (for admin saves); public read doesn't need it
                ...(CONFIG.GITHUB_TOKEN !== "YOUR_GITHUB_TOKEN" && {
                    "Authorization": `token ${CONFIG.GITHUB_TOKEN}`
                })
            }
        });

        if (res.status === 404) {
            // File doesn't exist yet — start fresh
            artworkData = [];
            return;
        }

        if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);

        const json = await res.json();
        const decoded = atob(json.content.replace(/\n/g, ""));
        artworkData = JSON.parse(decoded);
    } catch (err) {
        console.warn("Could not load artworks from GitHub:", err.message);
        artworkData = [];
    }
}

// Save artworks to GitHub repo JSON file
async function saveArtworksToGitHub() {
    const token = localStorage.getItem("githubToken");
    if (!token) {
        alert("❌ No GitHub token saved.\n\nGo to Admin → Privacy & Security → scroll to bottom → enter your GitHub token and click Save Token.");
        return false;
    }

    const url = `https://api.github.com/repos/${CONFIG.GITHUB_USERNAME}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATA_FILE_PATH}`;

    // Get current file SHA (needed for updates)
    let sha = null;
    try {
        const check = await fetch(url, {
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });
        if (check.ok) {
            const existing = await check.json();
            sha = existing.sha;
        }
    } catch (_) {}

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(artworkData, null, 2))));

    const body = {
        message: `Update artworks.json — ${new Date().toISOString()}`,
        content: content,
        ...(sha && { sha })
    };

    try {
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || res.status);
        }
        return true;
    } catch (err) {
        alert("❌ Failed to save to GitHub: " + err.message + "\n\nCheck your token in Privacy & Security tab.");
        return false;
    }
}

// ============================================================
// ImgBB Upload — Upload image and return public URL
// ============================================================
async function uploadImageToImgBB(file) {
    if (CONFIG.IMGBB_API_KEY === "YOUR_IMGBB_API_KEY") {
        alert("ImgBB API key not configured. Please set CONFIG.IMGBB_API_KEY in main.js\n\nGet a free key at: https://api.imgbb.com/");
        return null;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("key", CONFIG.IMGBB_API_KEY);

    try {
        const res = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: formData
        });

        if (!res.ok) throw new Error(`ImgBB error: ${res.status}`);

        const data = await res.json();
        if (!data.success) throw new Error(data.error?.message || "Upload failed");

        // Return the direct image URL (permanent, public)
        return data.data.url;
    } catch (err) {
        alert("Image upload to ImgBB failed: " + err.message);
        return null;
    }
}

// ============================================================
// DOM Elements
// ============================================================
const authModal = document.getElementById("auth-modal");
const adminPanelModal = document.getElementById("admin-panel-modal");
const adminLoginBtn = document.getElementById("admin-login-btn");
const closeAuth = document.getElementById("close-auth");
const closeAdminPanel = document.getElementById("close-admin-panel");

const loginView = document.getElementById("login-view");
const forgotView = document.getElementById("forgot-view");
const goForgot = document.getElementById("go-forgot");
const goBackLogin = document.getElementById("go-back-login");

// ============================================================
// App Initialization — Load from GitHub on startup
// ============================================================
async function initApp() {
    applyProfileDOM();
    renderFolderNavigation();

    // Show loading state
    const gallery = document.getElementById("gallery");
    if (gallery) {
        gallery.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:60px 0;">Loading gallery...</p>';
    }

    await loadArtworksFromGitHub();
    renderGallery();
    populateFolderDropdown();
}

initApp();

// ============================================================
// Apply profile info to DOM
// ============================================================
function applyProfileDOM() {
    const brand = localStorage.getItem("brandName");
    const sub = localStorage.getItem("siteSubtitle");

    document.getElementById("display-brand-name").innerText = brand;
    document.getElementById("display-subtitle").innerText = sub;
    document.getElementById("site-title-meta").innerText = `${brand} | ${sub}`;
    document.getElementById("artwork-ownership").value = localStorage.getItem("defaultOwnership");
    document.getElementById("footer-credits").innerHTML = `&copy; 2026 ${brand}. All Rights Reserved.`;

    const footerSocials = document.getElementById("footer-socials");
    const contacts = JSON.parse(localStorage.getItem("contactPlatforms")) || [];
    footerSocials.innerHTML = "";
    contacts.forEach(c => {
        footerSocials.innerHTML += `<a href="${c.url}" target="_blank" class="social-item">${c.name}</a>`;
    });
}

// ============================================================
// Modal Control
// ============================================================
adminLoginBtn.addEventListener("click", () => {
    if (isAdminAuthenticated) {
        openAdminPanel();
    } else {
        showView("login");
        authModal.style.display = "block";
    }
});

closeAuth.addEventListener("click", () => authModal.style.display = "none");
closeAdminPanel.addEventListener("click", () => adminPanelModal.style.display = "none");

window.addEventListener("click", (e) => {
    if (e.target === authModal) authModal.style.display = "none";
    if (e.target === adminPanelModal) adminPanelModal.style.display = "none";
});

function showView(view) {
    if (view === "login") {
        loginView.classList.remove("hidden");
        forgotView.classList.add("hidden");
    } else {
        loginView.classList.add("hidden");
        forgotView.classList.remove("hidden");
        document.getElementById("challenge-question-text").innerText = localStorage.getItem("securityQuestion");
    }
}

goForgot.addEventListener("click", () => showView("forgot"));
goBackLogin.addEventListener("click", () => showView("login"));

setupPasswordToggle("toggle-login-pwd", "login-password");
setupPasswordToggle("toggle-new-pwd", "new-sys-password");

function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
        if (input.type === "password") {
            input.type = "text";
            btn.innerText = "Hide";
        } else {
            input.type = "password";
            btn.innerText = "View";
        }
    });
}

// ============================================================
// Authentication
// ============================================================
document.getElementById("submit-login").addEventListener("click", () => {
    const entered = document.getElementById("login-password").value;
    if (entered === localStorage.getItem("adminPassword")) {
        isAdminAuthenticated = true;
        document.getElementById("login-password").value = "";
        authModal.style.display = "none";
        openAdminPanel();
    } else {
        alert("Verification failed. Incorrect credential.");
    }
});

function openAdminPanel() {
    adminPanelModal.style.display = "block";
    populateFolderDropdown();
    renderManageFolders();
    renderAdminArtworkList();

    document.getElementById("edit-brand-name").value = localStorage.getItem("brandName");
    document.getElementById("edit-subtitle").value = localStorage.getItem("siteSubtitle");
    document.getElementById("edit-default-owner").value = localStorage.getItem("defaultOwnership");

    temporaryContacts = JSON.parse(localStorage.getItem("contactPlatforms")) || [];
    renderAdminContacts();

    document.getElementById("new-security-question").value = localStorage.getItem("securityQuestion");
    document.getElementById("new-security-answer").value = localStorage.getItem("securityAnswer");

    // Load saved GitHub token status
    const savedToken = localStorage.getItem("githubToken");
    const statusEl = document.getElementById("github-token-status");
    if (savedToken) {
        statusEl.textContent = "✅ Token saved — " + savedToken.substring(0, 8) + "...";
        statusEl.style.color = "#2e7d32";
    } else {
        statusEl.textContent = "⚠️ No token saved yet. Upload will fail without it.";
        statusEl.style.color = "#c62828";
    }
}

// ============================================================
// Tab Navigation
// ============================================================
function switchTab(tabId) {
    const contents = document.querySelectorAll(".tab-content");
    const tabs = document.querySelectorAll(".tab-btn");

    contents.forEach(content => content.classList.add("hidden"));
    tabs.forEach(tab => tab.classList.remove("active"));

    document.getElementById(tabId).classList.remove("hidden");
    event.currentTarget.classList.add("active");
}

// ============================================================
// Contact Management
// ============================================================
let temporaryContacts = [];

function renderAdminContacts() {
    const list = document.getElementById("admin-contacts-list");
    if (!list) return;
    list.innerHTML = "";
    temporaryContacts.forEach((c, index) => {
        const li = document.createElement("li");
        li.innerHTML = `<span><strong>${c.name}:</strong> <small>${c.url}</small></span> <button class="remove-btn" type="button" onclick="removeTemporaryContact(${index})">&times; Remove</button>`;
        list.appendChild(li);
    });
}

document.getElementById("submit-contact").addEventListener("click", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("new-platform-name");
    const urlInput = document.getElementById("new-platform-url");

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (name && url) {
        temporaryContacts.push({ name, url });
        nameInput.value = "";
        urlInput.value = "";
        renderAdminContacts();
    } else {
        alert("Both Platform Name and Link URL are required.");
    }
});

function removeTemporaryContact(index) {
    temporaryContacts.splice(index, 1);
    renderAdminContacts();
}

document.getElementById("submit-profile-settings").addEventListener("click", () => {
    const bName = document.getElementById("edit-brand-name").value.trim();
    const subTitle = document.getElementById("edit-subtitle").value.trim();
    const dfOwner = document.getElementById("edit-default-owner").value.trim();

    if (bName && subTitle && dfOwner) {
        localStorage.setItem("brandName", bName);
        localStorage.setItem("siteSubtitle", subTitle);
        localStorage.setItem("defaultOwnership", dfOwner);
        localStorage.setItem("contactPlatforms", JSON.stringify(temporaryContacts));

        applyProfileDOM();
        renderGallery();
        alert("Profile settings updated.");
    } else {
        alert("All fields require valid inputs.");
    }
});

// ============================================================
// Folder Management
// ============================================================
function getFolders() {
    let folders = localStorage.getItem("folders");
    if (!folders) {
        folders = JSON.stringify(["Bridal", "Pageantry"]);
        localStorage.setItem("folders", folders);
    }
    return JSON.parse(folders);
}

function renderFolderNavigation() {
    const container = document.getElementById("folder-list");
    if (!container) return;
    const folders = getFolders();

    let html = `<button class="folder-tag ${currentFolderFilter === 'all' ? 'active' : ''}" onclick="filterFolder('all')">All Designs</button>`;
    folders.forEach(folder => {
        html += `<button class="folder-tag ${currentFolderFilter === folder ? 'active' : ''}" onclick="filterFolder('${folder}')">${folder}</button>`;
    });

    container.innerHTML = html;
}

function populateFolderDropdown() {
    const select = document.getElementById("artwork-folder-select");
    if (!select) return;
    const folders = getFolders();

    let html = '<option value="Unassigned">Unassigned</option>';
    folders.forEach(folder => {
        html += `<option value="${folder}">${folder}</option>`;
    });
    select.innerHTML = html;
}

function renderManageFolders() {
    const list = document.getElementById("manage-folder-list");
    if (!list) return;
    const folders = getFolders();
    list.innerHTML = "";

    folders.forEach((folder, index) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${folder}</span> <button class="remove-btn" type="button" onclick="deleteFolder(${index})">&times; Remove</button>`;
        list.appendChild(li);
    });
}

document.getElementById("submit-folder").addEventListener("click", () => {
    const nameInput = document.getElementById("new-folder-name");
    const folderName = nameInput.value.trim();

    if (!folderName) return;

    let folders = getFolders();
    if (!folders.includes(folderName)) {
        folders.push(folderName);
        localStorage.setItem("folders", JSON.stringify(folders));
        nameInput.value = "";

        renderFolderNavigation();
        populateFolderDropdown();
        renderManageFolders();
    }
});

function deleteFolder(index) {
    let folders = getFolders();
    const folderName = folders[index];

    if (confirm(`Delete folder "${folderName}"? Artworks inside will be unassigned.`)) {
        folders.splice(index, 1);
        localStorage.setItem("folders", JSON.stringify(folders));

        // Update artworks in memory
        artworkData = artworkData.map(art => {
            if (art.folder === folderName) art.folder = "Unassigned";
            return art;
        });

        if (currentFolderFilter === folderName) currentFolderFilter = "all";
        renderFolderNavigation();
        populateFolderDropdown();
        renderManageFolders();
        renderGallery();
        renderAdminArtworkList();
    }
}

function filterFolder(folderName) {
    currentFolderFilter = folderName;
    renderFolderNavigation();
    renderGallery();
}

// ============================================================
// Upload — ImgBB + GitHub Save
// ============================================================
document.getElementById("submit-upload").addEventListener("click", async () => {
    const fileInput = document.getElementById("artwork-file");
    const titleInput = document.getElementById("artwork-title");
    const descInput = document.getElementById("artwork-desc");
    const ownerInput = document.getElementById("artwork-ownership");
    const folderSelect = document.getElementById("artwork-folder-select");
    const uploadBtn = document.getElementById("submit-upload");

    if (!fileInput.files[0] || !titleInput.value.trim()) {
        alert("Image file and Title are required.");
        return;
    }

    // Block upload if GitHub token not saved yet
    const savedToken = localStorage.getItem("githubToken");
    if (!savedToken) {
        alert("⚠️ GitHub token not set!\n\nGo to Privacy & Security tab → scroll to the bottom → paste your GitHub token → click Save Token.\n\nThen come back here to upload.");
        return;
    }

    // Disable button during upload
    uploadBtn.disabled = true;
    uploadBtn.innerText = "Uploading image...";

    const file = fileInput.files[0];

    // Step 1: Upload image to ImgBB (get public URL)
    const imageUrl = await uploadImageToImgBB(file);
    if (!imageUrl) {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "Publish Illustration";
        return;
    }

    uploadBtn.innerText = "Saving to GitHub...";

    // Step 2: Build artwork object with public URL
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const newArtwork = {
        id: Date.now(),
        image: imageUrl,
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        date: formattedDate,
        ownership: ownerInput.value.trim() || localStorage.getItem("defaultOwnership"),
        folder: folderSelect.value
    };

    // Step 3: Add to in-memory data + show in gallery immediately
    artworkData.unshift(newArtwork);
    renderGallery();
    renderAdminArtworkList();

    // Step 4: Save to GitHub so ALL devices can see it
    const saved = await saveArtworksToGitHub();

    if (saved) {
        fileInput.value = "";
        titleInput.value = "";
        descInput.value = "";
        ownerInput.value = localStorage.getItem("defaultOwnership");
        alert("✅ Illustration published! Everyone who opens the site will see it.");
    } else {
        alert("⚠️ Image uploaded to ImgBB but NOT saved to GitHub.\nFix your token in Privacy & Security tab, then try again.");
    }

    uploadBtn.disabled = false;
    uploadBtn.innerText = "Publish Illustration";
});

// ============================================================
// Gallery Rendering — From in-memory artworkData (loaded from GitHub)
// ============================================================
function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;
    gallery.innerHTML = "";

    const filtered = artworkData.filter(art => {
        if (currentFolderFilter === "all") return true;
        return art.folder === currentFolderFilter;
    });

    if (filtered.length === 0) {
        gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 40px 0;">No illustrations cataloged in this collection.</p>';
        return;
    }

    filtered.forEach(art => {
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${art.image}" alt="${art.title}" loading="lazy">
            </div>
            <div class="card-details">
                <h3 class="card-title">${art.title}</h3>
                <p class="card-desc">${art.description}</p>
                <p class="card-meta"><strong>Date of publication:</strong> ${art.date}</p>
                <p class="card-meta"><strong>Ownership:</strong> ${art.ownership}</p>
            </div>
        `;
        gallery.appendChild(card);
    });
}

// ============================================================
// Admin Artwork List
// ============================================================
function renderAdminArtworkList() {
    let listContainer = document.getElementById("admin-artwork-list-container");

    if (!listContainer) {
        const uploadTab = document.getElementById("upload-tab");
        if (!uploadTab) return;
        const hr = document.createElement("hr");
        hr.className = "divider";
        uploadTab.appendChild(hr);

        const heading = document.createElement("h3");
        heading.innerText = "Published Illustrations";
        heading.style.fontSize = "14px";
        heading.style.textTransform = "uppercase";
        heading.style.letterSpacing = "1px";
        heading.style.margin = "20px 0 10px 0";
        uploadTab.appendChild(heading);

        listContainer = document.createElement("ul");
        listContainer.id = "admin-artwork-list-container";
        listContainer.className = "admin-list";
        uploadTab.appendChild(listContainer);
    }

    listContainer.innerHTML = "";

    if (artworkData.length === 0) {
        listContainer.innerHTML = '<li style="color: #999; font-size: 12px;">No active illustrations found.</li>';
        return;
    }

    artworkData.forEach(art => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "10px 0";
        li.style.borderBottom = "1px solid #f5f5f5";

        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${art.image}" style="width: 40px; height: 40px; object-fit: cover; border: 1px solid #ddd;">
                <span style="font-size: 13px;">${art.title} <small style="color: #888;">(${art.folder})</small></span>
            </div>
            <button class="remove-btn" type="button" onclick="deleteArtwork(${art.id})">&times; Remove</button>
        `;
        listContainer.appendChild(li);
    });
}

async function deleteArtwork(id) {
    if (confirm("Permanently delete this design?")) {
        artworkData = artworkData.filter(a => a.id !== id);
        const saved = await saveArtworksToGitHub();
        if (saved) {
            renderGallery();
            renderAdminArtworkList();
        } else {
            // Reload from GitHub on failure
            await loadArtworksFromGitHub();
            renderGallery();
            renderAdminArtworkList();
        }
    }
}

// ============================================================
// Security Settings
// ============================================================
document.getElementById("submit-new-password").addEventListener("click", () => {
    const val = document.getElementById("new-sys-password").value.trim();
    if (val) {
        localStorage.setItem("adminPassword", val);
        document.getElementById("new-sys-password").value = "";
        alert("Password updated successfully.");
    }
});

document.getElementById("submit-security-settings").addEventListener("click", () => {
    const q = document.getElementById("new-security-question").value.trim();
    const a = document.getElementById("new-security-answer").value.trim();

    if (q && a) {
        localStorage.setItem("securityQuestion", q);
        localStorage.setItem("securityAnswer", a);
        alert("Security settings saved.");
    }
});

document.getElementById("admin-logout").addEventListener("click", () => {
    isAdminAuthenticated = false;
    adminPanelModal.style.display = "none";
    renderGallery();
    alert("Session closed.");
});

// ============================================================
// GitHub Token — Save to localStorage
// ============================================================
document.getElementById("submit-github-token").addEventListener("click", () => {
    const tokenInput = document.getElementById("github-token-input");
    const statusEl = document.getElementById("github-token-status");
    const val = tokenInput.value.trim();

    if (!val) {
        statusEl.textContent = "⚠️ Please enter a token.";
        statusEl.style.color = "#c62828";
        return;
    }

    localStorage.setItem("githubToken", val);
    tokenInput.value = "";
    statusEl.textContent = "✅ Token saved — " + val.substring(0, 8) + "...";
    statusEl.style.color = "#2e7d32";
    alert("GitHub token saved! You can now upload artworks.");
});

setupPasswordToggle("toggle-github-token", "github-token-input");