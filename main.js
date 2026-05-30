// ─────────────────────────────────────────────────────────────────────────────
//  FIREBASE INIT
// ─────────────────────────────────────────────────────────────────────────────

const firebaseConfig = {
    apiKey: "AIzaSyCiLLOrKy9GpiyIAnYzLF9XHSh2uvJchIw",
    authDomain: "android-e2586.firebaseapp.com",
    projectId: "android-e2586",
    storageBucket: "android-e2586.firebasestorage.app",
    messagingSenderId: "1046005396760",
    appId: "1:1046005396760:web:5023999e2fad9106f61a6d",
    measurementId: "G-QH0YWHLZZ3"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const storage = firebase.storage();

const SETTINGS_DOC  = firestore.collection("settings").doc("config");
const ARTWORKS_COL  = firestore.collection("artworks");

// ─────────────────────────────────────────────────────────────────────────────
//  IN-MEMORY STATE  (populated from Firestore on startup)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
    adminPassword:    "JANN_ADMIN_ACCESS",
    securityQuestion: "What is the name of your signature brand?",
    securityAnswer:   "Jann's Creation",
    folders:          ["Bridal", "Pageantry"],
    brandName:        "JANN G. ARTWORK",
    siteSubtitle:     "Fashion Illustration",
    defaultOwnership: "JANN G. ARTWORK",
    contactPlatforms: [{ name: "Instagram", url: "https://instagram.com/laiyts_" }]
};

let appSettings = { ...DEFAULTS };
let currentFolderFilter = "all";
let isAdminAuthenticated = false;
let temporaryContacts = [];

// ─────────────────────────────────────────────────────────────────────────────
//  DOM REFERENCES
// ─────────────────────────────────────────────────────────────────────────────

const authModal       = document.getElementById("auth-modal");
const adminPanelModal = document.getElementById("admin-panel-modal");
const adminLoginBtn   = document.getElementById("admin-login-btn");
const closeAuth       = document.getElementById("close-auth");
const closeAdminPanel = document.getElementById("close-admin-panel");
const loginView       = document.getElementById("login-view");
const forgotView      = document.getElementById("forgot-view");
const goForgot        = document.getElementById("go-forgot");
const goBackLogin     = document.getElementById("go-back-login");

// ─────────────────────────────────────────────────────────────────────────────
//  STARTUP — load settings from Firestore, then render page
// ─────────────────────────────────────────────────────────────────────────────

async function initApp() {
    try {
        const doc = await SETTINGS_DOC.get();
        if (doc.exists) {
            appSettings = { ...DEFAULTS, ...doc.data() };
        } else {
            // First-ever launch: write defaults to Firestore
            await SETTINGS_DOC.set(DEFAULTS);
        }
    } catch (err) {
        console.warn("Could not reach Firestore — running with defaults.", err);
    }

    applyProfileDOM();
    renderFolderNavigation();
    populateFolderDropdown();
    renderGallery();
}

initApp();

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE / BRANDING
// ─────────────────────────────────────────────────────────────────────────────

function applyProfileDOM() {
    const brand = appSettings.brandName;
    const sub   = appSettings.siteSubtitle;

    document.getElementById("display-brand-name").innerText = brand;
    document.getElementById("display-subtitle").innerText   = sub;
    document.getElementById("site-title-meta").innerText    = `${brand} | ${sub}`;
    document.getElementById("artwork-ownership").value      = appSettings.defaultOwnership;
    document.getElementById("footer-credits").innerHTML     = `&copy; 2026 ${brand}. All Rights Reserved.`;

    const footerSocials = document.getElementById("footer-socials");
    footerSocials.innerHTML = "";
    (appSettings.contactPlatforms || []).forEach(c => {
        footerSocials.innerHTML += `<a href="${c.url}" target="_blank" class="social-item">${c.name}</a>`;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL CONTROL
// ─────────────────────────────────────────────────────────────────────────────

adminLoginBtn.addEventListener("click", () => {
    if (isAdminAuthenticated) {
        openAdminPanel();
    } else {
        showView("login");
        authModal.style.display = "block";
    }
});

closeAuth.addEventListener("click",       () => authModal.style.display       = "none");
closeAdminPanel.addEventListener("click", () => adminPanelModal.style.display = "none");

window.addEventListener("click", e => {
    if (e.target === authModal)       authModal.style.display       = "none";
    if (e.target === adminPanelModal) adminPanelModal.style.display = "none";
});

function showView(view) {
    if (view === "login") {
        loginView.classList.remove("hidden");
        forgotView.classList.add("hidden");
    } else {
        loginView.classList.add("hidden");
        forgotView.classList.remove("hidden");
        document.getElementById("challenge-question-text").innerText = appSettings.securityQuestion;
    }
}

goForgot.addEventListener("click",    () => showView("forgot"));
goBackLogin.addEventListener("click", () => showView("login"));

// ─────────────────────────────────────────────────────────────────────────────
//  PASSWORD VISIBILITY TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

setupPasswordToggle("toggle-login-pwd", "login-password");
setupPasswordToggle("toggle-new-pwd",   "new-sys-password");

function setupPasswordToggle(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
        const isHidden  = input.type === "password";
        input.type      = isHidden ? "text"     : "password";
        btn.innerText   = isHidden ? "Hide"     : "View";
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById("submit-login").addEventListener("click", () => {
    const entered = document.getElementById("login-password").value;
    if (entered === appSettings.adminPassword) {
        isAdminAuthenticated = true;
        document.getElementById("login-password").value = "";
        authModal.style.display = "none";
        openAdminPanel();
    } else {
        alert("Verification failed. Incorrect credential.");
    }
});

document.getElementById("submit-recovery").addEventListener("click", () => {
    const entered  = document.getElementById("recovery-answer").value.trim().toLowerCase();
    const correct  = (appSettings.securityAnswer || "").trim().toLowerCase();
    if (entered === correct) {
        isAdminAuthenticated = true;
        document.getElementById("recovery-answer").value = "";
        authModal.style.display = "none";
        openAdminPanel();
    } else {
        alert("Security answer does not match. Please try again.");
    }
});

function openAdminPanel() {
    adminPanelModal.style.display = "block";
    populateFolderDropdown();
    renderManageFolders();
    renderAdminArtworkList();

    document.getElementById("edit-brand-name").value    = appSettings.brandName;
    document.getElementById("edit-subtitle").value      = appSettings.siteSubtitle;
    document.getElementById("edit-default-owner").value = appSettings.defaultOwnership;

    temporaryContacts = [...(appSettings.contactPlatforms || [])];
    renderAdminContacts();

    document.getElementById("new-security-question").value = appSettings.securityQuestion;
    document.getElementById("new-security-answer").value   = appSettings.securityAnswer;
}

document.getElementById("admin-logout").addEventListener("click", () => {
    isAdminAuthenticated = false;
    adminPanelModal.style.display = "none";
    renderGallery();
    alert("Session closed.");
});

// ─────────────────────────────────────────────────────────────────────────────
//  TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
    document.getElementById(tabId).classList.remove("hidden");
    event.currentTarget.classList.add("active");
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONTACTS (admin only — staged until Save Profile)
// ─────────────────────────────────────────────────────────────────────────────

function renderAdminContacts() {
    const list = document.getElementById("admin-contacts-list");
    if (!list) return;
    list.innerHTML = "";
    temporaryContacts.forEach((c, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span><strong>${c.name}:</strong> <small>${c.url}</small></span>
                        <button class="remove-btn" type="button" onclick="removeTemporaryContact(${i})">&times; Remove</button>`;
        list.appendChild(li);
    });
}

document.getElementById("submit-contact").addEventListener("click", e => {
    e.preventDefault();
    const nameInput = document.getElementById("new-platform-name");
    const urlInput  = document.getElementById("new-platform-url");
    const name = nameInput.value.trim();
    const url  = urlInput.value.trim();

    if (name && url) {
        temporaryContacts.push({ name, url });
        nameInput.value = "";
        urlInput.value  = "";
        renderAdminContacts();
    } else {
        alert("Both Platform Name and Link URL are required.");
    }
});

function removeTemporaryContact(index) {
    temporaryContacts.splice(index, 1);
    renderAdminContacts();
}

document.getElementById("submit-profile-settings").addEventListener("click", async () => {
    const bName    = document.getElementById("edit-brand-name").value.trim();
    const subTitle = document.getElementById("edit-subtitle").value.trim();
    const dfOwner  = document.getElementById("edit-default-owner").value.trim();

    if (!bName || !subTitle || !dfOwner) {
        alert("All informational text fields require valid inputs.");
        return;
    }

    const updates = { brandName: bName, siteSubtitle: subTitle, defaultOwnership: dfOwner, contactPlatforms: temporaryContacts };

    try {
        await SETTINGS_DOC.update(updates);
        Object.assign(appSettings, updates);
        applyProfileDOM();
        renderGallery();
        alert("Profile setup and configuration properties updated.");
    } catch (err) {
        alert("Error saving profile: " + err.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  FOLDERS
// ─────────────────────────────────────────────────────────────────────────────

function getFolders() {
    return appSettings.folders || [];
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

    let html = '<option value="Unassigned">Unassigned</option>';
    getFolders().forEach(f => {
        html += `<option value="${f}">${f}</option>`;
    });
    select.innerHTML = html;
}

function renderManageFolders() {
    const list = document.getElementById("manage-folder-list");
    if (!list) return;
    list.innerHTML = "";

    getFolders().forEach((folder, index) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${folder}</span>
                        <button class="remove-btn" type="button" onclick="deleteFolder(${index})">&times; Remove</button>`;
        list.appendChild(li);
    });
}

document.getElementById("submit-folder").addEventListener("click", async () => {
    const nameInput  = document.getElementById("new-folder-name");
    const folderName = nameInput.value.trim();
    if (!folderName) return;

    const folders = getFolders();
    if (folders.includes(folderName)) return;

    folders.push(folderName);
    try {
        await SETTINGS_DOC.update({ folders });
        appSettings.folders = folders;
        nameInput.value = "";
        renderFolderNavigation();
        populateFolderDropdown();
        renderManageFolders();
    } catch (err) {
        alert("Error creating folder: " + err.message);
    }
});

async function deleteFolder(index) {
    const folders    = getFolders();
    const folderName = folders[index];

    if (!confirm(`Delete folder "${folderName}"? Content inside will be unassigned.`)) return;

    folders.splice(index, 1);
    try {
        await SETTINGS_DOC.update({ folders });
        appSettings.folders = folders;

        // Batch-reassign artworks in that folder
        const snapshot = await ARTWORKS_COL.where("folder", "==", folderName).get();
        if (!snapshot.empty) {
            const batch = firestore.batch();
            snapshot.forEach(doc => batch.update(doc.ref, { folder: "Unassigned" }));
            await batch.commit();
        }

        if (currentFolderFilter === folderName) currentFolderFilter = "all";
        renderFolderNavigation();
        populateFolderDropdown();
        renderManageFolders();
        renderGallery();
        renderAdminArtworkList();
    } catch (err) {
        alert("Error deleting folder: " + err.message);
    }
}

function filterFolder(folderName) {
    currentFolderFilter = folderName;
    renderFolderNavigation();
    renderGallery();
}

// ─────────────────────────────────────────────────────────────────────────────
//  ARTWORK UPLOAD  (image → Firebase Storage, metadata → Firestore)
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById("submit-upload").addEventListener("click", async () => {
    const fileInput   = document.getElementById("artwork-file");
    const titleInput  = document.getElementById("artwork-title");
    const descInput   = document.getElementById("artwork-desc");
    const ownerInput  = document.getElementById("artwork-ownership");
    const folderSelect = document.getElementById("artwork-folder-select");
    const submitBtn   = document.getElementById("submit-upload");

    if (!fileInput.files[0] || !titleInput.value.trim()) {
        alert("Image asset file and Title parameter fields are mandated.");
        return;
    }

    const file        = fileInput.files[0];
    const artworkId   = Date.now().toString();
    const storageRef  = storage.ref(`artworks/${artworkId}_${file.name}`);
    const formattedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    submitBtn.innerText  = "Uploading...";
    submitBtn.disabled   = true;

    try {
        // 1 — Upload image to Firebase Storage
        const snapshot  = await storageRef.put(file);
        const imageUrl  = await snapshot.ref.getDownloadURL();

        // 2 — Save metadata to Firestore
        await ARTWORKS_COL.doc(artworkId).set({
            id:          artworkId,
            imageUrl,
            storagePath: snapshot.ref.fullPath,
            title:       titleInput.value.trim(),
            description: descInput.value.trim(),
            date:        formattedDate,
            ownership:   ownerInput.value.trim() || appSettings.defaultOwnership,
            folder:      folderSelect.value,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3 — Reset form
        fileInput.value  = "";
        titleInput.value = "";
        descInput.value  = "";
        ownerInput.value = appSettings.defaultOwnership;

        alert("High-resolution graphic published successfully.");
        renderGallery();
        renderAdminArtworkList();
    } catch (err) {
        alert("Error uploading artwork: " + err.message);
    } finally {
        submitBtn.innerText = "Publish Illustration";
        submitBtn.disabled  = false;
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GALLERY RENDER
// ─────────────────────────────────────────────────────────────────────────────

async function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    gallery.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#bbb; padding:40px 0; letter-spacing:2px; text-transform:uppercase; font-size:11px;">Loading collection...</p>';

    try {
        const snapshot = await ARTWORKS_COL.orderBy("createdAt", "desc").get();
        const all = [];
        snapshot.forEach(doc => all.push(doc.data()));

        const filtered = currentFolderFilter === "all"
            ? all
            : all.filter(art => art.folder === currentFolderFilter);

        gallery.innerHTML = "";

        if (filtered.length === 0) {
            gallery.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#999; padding:40px 0;">No illustrations cataloged in this collection.</p>';
            return;
        }

        filtered.forEach(art => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${art.imageUrl}" alt="${art.title}" loading="lazy">
                </div>
                <div class="card-details">
                    <h3 class="card-title">${art.title}</h3>
                    <p class="card-desc">${art.description || ""}</p>
                    <p class="card-meta"><strong>Date of publication:</strong> ${art.date}</p>
                    <p class="card-meta"><strong>Ownership:</strong> ${art.ownership}</p>
                </div>`;
            gallery.appendChild(card);
        });
    } catch (err) {
        gallery.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#c00; padding:40px 0;">Could not load gallery. Check your internet connection.</p>';
        console.error("Gallery load error:", err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN ARTWORK LIST
// ─────────────────────────────────────────────────────────────────────────────

async function renderAdminArtworkList() {
    let listContainer = document.getElementById("admin-artwork-list-container");

    if (!listContainer) {
        const uploadTab = document.getElementById("upload-tab");
        if (!uploadTab) return;

        const hr = document.createElement("hr");
        hr.className = "divider";
        uploadTab.appendChild(hr);

        const heading = document.createElement("h3");
        heading.innerText = "Published Illustrations";
        heading.style.cssText = "font-size:14px; text-transform:uppercase; letter-spacing:1px; margin:20px 0 10px 0;";
        uploadTab.appendChild(heading);

        listContainer = document.createElement("ul");
        listContainer.id = "admin-artwork-list-container";
        listContainer.className = "admin-list";
        uploadTab.appendChild(listContainer);
    }

    listContainer.innerHTML = '<li style="color:#999; font-size:12px;">Loading...</li>';

    try {
        const snapshot = await ARTWORKS_COL.orderBy("createdAt", "desc").get();
        const artworks = [];
        snapshot.forEach(doc => artworks.push(doc.data()));

        listContainer.innerHTML = "";

        if (artworks.length === 0) {
            listContainer.innerHTML = '<li style="color:#999; font-size:12px;">No active illustrations found.</li>';
            return;
        }

        artworks.forEach(art => {
            const li = document.createElement("li");
            li.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f5f5f5;";
            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${art.imageUrl}" style="width:40px; height:40px; object-fit:cover; border:1px solid #ddd;" loading="lazy">
                    <span style="font-size:13px;">${art.title} <small style="color:#888;">(${art.folder})</small></span>
                </div>
                <button class="remove-btn" type="button"
                    onclick="deleteArtwork('${art.id}', '${art.storagePath || ''}')">&times; Remove</button>`;
            listContainer.appendChild(li);
        });
    } catch (err) {
        listContainer.innerHTML = '<li style="color:#999; font-size:12px;">Error loading artworks.</li>';
        console.error(err);
    }
}

async function deleteArtwork(id, storagePath) {
    if (!confirm("Proceed to permanently delete this unique design entry?")) return;

    try {
        await ARTWORKS_COL.doc(id).delete();

        if (storagePath) {
            try { await storage.ref(storagePath).delete(); }
            catch (e) { console.warn("Storage file may already be removed:", e); }
        }

        renderGallery();
        renderAdminArtworkList();
    } catch (err) {
        alert("Error deleting artwork: " + err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECURITY & PASSWORD SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

document.getElementById("submit-new-password").addEventListener("click", async () => {
    const val = document.getElementById("new-sys-password").value.trim();
    if (!val) return;

    try {
        await SETTINGS_DOC.update({ adminPassword: val });
        appSettings.adminPassword = val;
        document.getElementById("new-sys-password").value = "";
        alert("Access configuration updated successfully.");
    } catch (err) {
        alert("Error updating password: " + err.message);
    }
});

document.getElementById("submit-security-settings").addEventListener("click", async () => {
    const q = document.getElementById("new-security-question").value.trim();
    const a = document.getElementById("new-security-answer").value.trim();

    if (!q || !a) return;

    try {
        await SETTINGS_DOC.update({ securityQuestion: q, securityAnswer: a });
        appSettings.securityQuestion = q;
        appSettings.securityAnswer   = a;
        alert("Identity validation profile elements successfully saved.");
    } catch (err) {
        alert("Error saving security settings: " + err.message);
    }
});