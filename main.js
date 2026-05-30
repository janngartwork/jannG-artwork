import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCiLLOrKy9GpiyIAnYzLF9XHSh2uvJchIw",
  authDomain: "android-e2586.firebaseapp.com",
  projectId: "android-e2586",
  storageBucket: "android-e2586.firebasestorage.app",
  messagingSenderId: "1046005396760",
  appId: "1:1046005396760:web:5023999e2fad9106f61a6d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// System Constants & State Initializations
const DEFAULT_PASSWORD = "JANN_ADMIN_ACCESS";
const DEFAULT_QUESTION = "What is the name of your signature brand?";
const DEFAULT_ANSWER = "Jann's Creation";

let currentFolderFilter = "all";
let isAdminAuthenticated = false;
let temporaryContacts = [];

// Expose functions globally for HTML inline event handlers
window.filterFolder = filterFolder;
window.switchTab = switchTab;
window.deleteFolder = deleteFolder;
window.removeTemporaryContact = removeTemporaryContact;
window.deleteArtwork = deleteArtwork;

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

// DOM Elements
const authModal = document.getElementById("auth-modal");
const adminPanelModal = document.getElementById("admin-panel-modal");
const adminLoginBtn = document.getElementById("admin-login-btn");
const closeAuth = document.getElementById("close-auth");
const closeAdminPanel = document.getElementById("close-admin-panel");

// Authentication View Toggles
const loginView = document.getElementById("login-view");
const forgotView = document.getElementById("forgot-view");
const goForgot = document.getElementById("go-forgot");
const goBackLogin = document.getElementById("go-back-login");

// App initialization calls
applyProfileDOM();
renderFolderNavigation();
renderGallery();
populateFolderDropdown();


// Apply profile info to DOM
function applyProfileDOM() {
    const brand = localStorage.getItem("brandName");
    const sub = localStorage.getItem("siteSubtitle");
    
    document.getElementById("display-brand-name").innerText = brand;
    document.getElementById("display-subtitle").innerText = sub;
    document.getElementById("site-title-meta").innerText = `${brand} | ${sub}`;
    document.getElementById("artwork-ownership").value = localStorage.getItem("defaultOwnership");
    document.getElementById("footer-credits").innerHTML = `&copy; 2026 ${brand}. All Rights Reserved.`;
    
    // Render Public Footer Contacts
    const footerSocials = document.getElementById("footer-socials");
    const contacts = JSON.parse(localStorage.getItem("contactPlatforms")) || [];
    footerSocials.innerHTML = "";
    contacts.forEach(c => {
        footerSocials.innerHTML += `<a href="${c.url}" target="_blank" class="social-item">${c.name}</a>`;
    });
}

// Modal Control Operations
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

// Password Visibility Utilities
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

// Verification Logic Flow
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
    
    // Load profile configurations into fields
    document.getElementById("edit-brand-name").value = localStorage.getItem("brandName");
    document.getElementById("edit-subtitle").value = localStorage.getItem("siteSubtitle");
    document.getElementById("edit-default-owner").value = localStorage.getItem("defaultOwnership");
    
    temporaryContacts = JSON.parse(localStorage.getItem("contactPlatforms")) || [];
    renderAdminContacts();
    
    document.getElementById("new-security-question").value = localStorage.getItem("securityQuestion");
    document.getElementById("new-security-answer").value = localStorage.getItem("securityAnswer");
}

// Tab Layout Navigation
function switchTab(tabId) {
    const contents = document.querySelectorAll(".tab-content");
    const tabs = document.querySelectorAll(".tab-btn");
    
    contents.forEach(content => content.classList.add("hidden"));
    tabs.forEach(tab => tab.classList.remove("active"));
    
    document.getElementById(tabId).classList.remove("hidden");
    event.currentTarget.classList.add("active");
}

// Profile Contact Lists Management inside Dashboard
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
        alert("Profile setup and configuration properties updated.");
    } else {
        alert("All informational text fields require valid inputs.");
    }
});

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
    
    if (confirm(`Delete folder "${folderName}"? Content inside will be unassigned.`)) {
        folders.splice(index, 1);
        localStorage.setItem("folders", JSON.stringify(folders));
        
        // Update artworks in this folder
        async function updateFolderArtworks() {
            try {
                const q = query(collection(db, "artworks"));
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach(async (document) => {
                    if (document.data().folder === folderName) {
                        await updateDoc(doc(db, "artworks", document.id), { folder: "Unassigned" });
                    }
                });
                
                if (currentFolderFilter === folderName) currentFolderFilter = "all";
                renderFolderNavigation();
                populateFolderDropdown();
                renderManageFolders();
                renderGallery();
                renderAdminArtworkList();
            } catch (error) {
                console.error("Error updating artworks folder:", error);
            }
        }
        updateFolderArtworks();
    }
}

function filterFolder(folderName) {
    currentFolderFilter = folderName;
    renderFolderNavigation();
    renderGallery();
}

// Artwork Management Core Processing
document.getElementById("submit-upload").addEventListener("click", () => {
    const fileInput = document.getElementById("artwork-file");
    const titleInput = document.getElementById("artwork-title");
    const descInput = document.getElementById("artwork-desc");
    const ownerInput = document.getElementById("artwork-ownership");
    const folderSelect = document.getElementById("artwork-folder-select");
    
    if (!fileInput.files[0] || !titleInput.value.trim()) {
        alert("Image asset file and Title parameter fields are mandated.");
        return;
    }
    
    const file = fileInput.files[0];
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const uploadBtn = document.getElementById("submit-upload");
    const originalText = uploadBtn.innerText;
    uploadBtn.innerText = "Publishing... Please wait";
    uploadBtn.disabled = true;

    try {
        // Upload to Firebase Storage as binary file (much faster)
        const uniqueFilename = `artworks/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, uniqueFilename);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);

        const newArtwork = {
            timestamp: Date.now(),
            image: downloadURL,
            imageRef: uniqueFilename,
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            date: formattedDate,
            ownership: ownerInput.value.trim() || localStorage.getItem("defaultOwnership"),
            folder: folderSelect.value
        };
        
        // Save to Firestore
        await addDoc(collection(db, "artworks"), newArtwork);
        
        fileInput.value = "";
        titleInput.value = "";
        descInput.value = "";
        ownerInput.value = localStorage.getItem("defaultOwnership");
        
        alert("High-resolution graphic published successfully.");
        renderGallery();
        renderAdminArtworkList();
    } catch (error) {
        console.error(error);
        alert("Error saving the artwork asset. Ensure Firebase config is correct and rules allow writes.");
    } finally {
        uploadBtn.innerText = originalText;
        uploadBtn.disabled = false;
    }
});

async function renderGallery() {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;
    
    gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 40px 0;">Loading...</p>';
    
    try {
        const q = query(collection(db, "artworks"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const artworks = [];
        
        querySnapshot.forEach((doc) => {
            artworks.push({ id: doc.id, ...doc.data() });
        });
        
        gallery.innerHTML = "";
        
        const filtered = artworks.filter(art => {
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
                    <img src="${art.image}" alt="${art.title}">
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
    } catch (error) {
        console.error("Error loading gallery:", error);
        gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red; padding: 40px 0;">Failed to load artworks.</p>';
    }
}

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
    
    listContainer.innerHTML = '<li style="color: #999; font-size: 12px;">Loading...</li>';
    
    try {
        const q = query(collection(db, "artworks"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const artworks = [];
        
        querySnapshot.forEach((doc) => {
            artworks.push({ id: doc.id, ...doc.data() });
        });
        
        listContainer.innerHTML = "";
        
        if (artworks.length === 0) {
            listContainer.innerHTML = '<li style="color: #999; font-size: 12px;">No active illustrations found.</li>';
            return;
        }
        
        artworks.forEach(art => {
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
                <button class="remove-btn" type="button" onclick="deleteArtwork('${art.id}', '${art.imageRef}')">&times; Remove</button>
            `;
            listContainer.appendChild(li);
        });
    } catch (error) {
        console.error("Error loading admin list:", error);
        listContainer.innerHTML = '<li style="color: red; font-size: 12px;">Error loading data.</li>';
    }
}

async function deleteArtwork(id, imageRefPath) {
    if (confirm("Proceed to permanently delete this unique design entry?")) {
        try {
            await deleteDoc(doc(db, "artworks", id));
            if (imageRefPath && imageRefPath !== "undefined") {
                const storageRef = ref(storage, imageRefPath);
                await deleteObject(storageRef);
            }
            renderGallery();
            renderAdminArtworkList();
        } catch (error) {
            console.error("Error deleting artwork:", error);
            alert("Error removing the design entry.");
        }
    }
}

// Security Updates Configuration Panel
document.getElementById("submit-new-password").addEventListener("click", () => {
    const val = document.getElementById("new-sys-password").value.trim();
    if (val) {
        localStorage.setItem("adminPassword", val);
        document.getElementById("new-sys-password").value = "";
        alert("Access configuration updated successfully.");
    }
});

document.getElementById("submit-security-settings").addEventListener("click", () => {
    const q = document.getElementById("new-security-question").value.trim();
    const a = document.getElementById("new-security-answer").value.trim();
    
    if (q && a) {
        localStorage.setItem("securityQuestion", q);
        localStorage.setItem("securityAnswer", a);
        alert("Identity validation profile elements successfully saved.");
    }
});

document.getElementById("admin-logout").addEventListener("click", () => {
    isAdminAuthenticated = false;
    adminPanelModal.style.display = "none";
    renderGallery();
    alert("Session closed.");
});