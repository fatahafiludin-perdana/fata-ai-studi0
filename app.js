/* ==========================================================================
   FATA AI STUDIO - APP CONTROLLER, STATE MANAGER & CLIPBOARD HANDLER
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Aplikasi ---
    const state = {
        theme: localStorage.getItem('fata_theme') || 'dark',
        user: JSON.parse(localStorage.getItem('fata_user')) || null,
        trialUsed: localStorage.getItem('fata_trial_used') === 'true',
        activeView: 'landing',
        activePanel: 'dashboard'
    };

    // --- Global Image Input Registry ---
    const activeImageInputs = {};

    // --- DOM Selectors ---
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const viewLanding = document.getElementById('view-landing');
    const viewLogin = document.getElementById('view-login');
    const viewRegister = document.getElementById('view-register');
    const appLayout = document.getElementById('app-layout');
    
    const previewModal = document.getElementById('preview-modal');
    const modalContentArea = document.getElementById('modal-content-area');
    const trialModal = document.getElementById('trial-modal');

    // --- Inisialisasi Utama ---
    function init() {
        applyTheme(state.theme);
        updateAuthUI();
        registerGlobalImageInputs();
        setupClipboardPasteListener();
        setupEventListeners();
    }

    // --- System Theme ---
    function applyTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        themeToggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('fata_theme', theme);
    }

    themeToggleBtn.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // --- Router & Auth State ---
    function updateAuthUI() {
        const guestBtns = document.querySelectorAll('.guest-only');
        const authBtns = document.querySelectorAll('.auth-only');
        const landingLinks = document.querySelectorAll('.landing-only');

        if (state.user) {
            guestBtns.forEach(el => el.classList.add('hidden'));
            authBtns.forEach(el => el.classList.remove('hidden'));
            landingLinks.forEach(el => el.classList.add('hidden'));
            switchView('app');
        } else {
            guestBtns.forEach(el => el.classList.remove('hidden'));
            authBtns.forEach(el => el.classList.add('hidden'));
            landingLinks.forEach(el => el.classList.remove('hidden'));
            switchView('landing');
        }
    }

    function switchView(viewName) {
        state.activeView = viewName;
        [viewLanding, viewLogin, viewRegister, appLayout].forEach(v => v.classList.add('hidden'));

        if (viewName === 'landing') viewLanding.classList.remove('hidden');
        else if (viewName === 'login') viewLogin.classList.remove('hidden');
        else if (viewName === 'register') viewRegister.classList.remove('hidden');
        else if (viewName === 'app') appLayout.classList.remove('hidden');

        window.scrollTo(0, 0);
    }

    function switchPanel(panelName) {
        if (!checkTrialOrAuth()) return;

        if (!state.user) switchView('app');

        document.querySelectorAll('.panel-view').forEach(p => p.classList.add('hidden'));
        const targetPanel = document.getElementById(`panel-${panelName}`);
        if (targetPanel) targetPanel.classList.remove('hidden');

        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panelName);
        });

        state.activePanel = panelName;
    }

    // --- FREE TRIAL SYSTEM GUARD ---
    function checkTrialOrAuth() {
        if (state.user) return true;
        if (!state.trialUsed) return true;

        trialModal.classList.remove('hidden');
        return false;
    }

    function consumeTrial() {
        if (!state.user && !state.trialUsed) {
            state.trialUsed = true;
            localStorage.setItem('fata_trial_used', 'true');
        }
    }

    // ==========================================================================
    // REUSABLE GLOBAL IMAGE INPUT COMPONENT (Upload, Drag-Drop, Clipboard)
    // ==========================================================================
    function registerGlobalImageInputs() {
        const containers = document.querySelectorAll('.global-image-input');
        containers.forEach(container => {
            const id = container.id;
            activeImageInputs[id] = { file: null, dataUrl: null };
            renderImageInputUI(container, id);
        });
    }

    function renderImageInputUI(container, id) {
        const data = activeImageInputs[id];

        if (!data.file) {
            container.innerHTML = `
                <div class="drop-zone" id="zone-${id}">
                    <span class="drop-icon">🖼️</span>
                    <p>Upload Image</p>
                    <small>Drag & drop an image here or click to browse</small><br>
                    <small style="color: var(--primary-green)">You can also paste with Ctrl + V</small>
                    <input type="file" id="file-${id}" accept="image/png, image/jpeg, image/webp" hidden>
                </div>
            `;

            const zone = container.querySelector(`#zone-${id}`);
            const input = container.querySelector(`#file-${id}`);

            zone.addEventListener('click', () => input.click());
            input.addEventListener('change', (e) => handleFileSelect(id, e.target.files[0]));

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('dragover');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                if (e.dataTransfer.files.length) handleFileSelect(id, e.dataTransfer.files[0]);
            });
        } else {
            container.innerHTML = `
                <div class="image-preview-card">
                    <img src="${data.dataUrl}" alt="Preview">
                    <div class="file-info">
                        <div class="file-name">${data.file.name}</div>
                        <div class="file-size">${(data.file.size / (1024 * 1024)).toFixed(2)} MB</div>
                        <div class="file-actions">
                            <button class="btn btn-outline btn-sm" id="replace-${id}">Replace</button>
                            <button class="btn btn-danger-outline btn-sm" id="remove-${id}">Remove</button>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector(`#replace-${id}`).addEventListener('click', () => {
                const tempInput = document.createElement('input');
                tempInput.type = 'file';
                tempInput.accept = 'image/*';
                tempInput.onchange = (e) => handleFileSelect(id, e.target.files[0]);
                tempInput.click();
            });

            container.querySelector(`#remove-${id}`).addEventListener('click', () => {
                activeImageInputs[id] = { file: null, dataUrl: null };
                renderImageInputUI(container, id);
            });
        }
    }

    function handleFileSelect(id, file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast("Please upload a PNG, JPG, JPEG, or WEBP image.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            activeImageInputs[id] = { file: file, dataUrl: e.target.result };
            const container = document.getElementById(id);
            if (container) renderImageInputUI(container, id);
        };
        reader.readAsDataURL(file);
    }

    // --- Clipboard Paste Handler (Ctrl + V) ---
    function setupClipboardPasteListener() {
        document.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    const file = new File([blob], "pasted-image.png", { type: blob.type });

                    // Temukan input image terdekat dari panel aktif
                    const activePanelEl = document.querySelector(`.panel-view:not(.hidden)`);
                    if (activePanelEl) {
                        const targetInputContainer = activePanelEl.querySelector('.global-image-input');
                        if (targetInputContainer) {
                            handleFileSelect(targetInputContainer.id, file);
                            showToast("Image pasted from clipboard.");
                        }
                    }
                }
            }
        });
    }

    // --- EVENT LISTENERS UI ---
    function setupEventListeners() {
        document.getElementById('nav-login-btn').addEventListener('click', () => switchView('login'));
        document.getElementById('nav-register-btn').addEventListener('click', () => switchView('register'));
        document.getElementById('link-to-reg').addEventListener('click', (e) => { e.preventDefault(); switchView('register'); });
        document.getElementById('link-to-login').addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });

        document.getElementById('brand-logo').addEventListener('click', () => {
            if (state.user) switchPanel('dashboard');
            else switchView('landing');
        });

        document.getElementById('hero-try-btn').addEventListener('click', () => {
            if (checkTrialOrAuth()) switchPanel('image-gen');
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            state.user = null;
            localStorage.removeItem('fata_user');
            updateAuthUI();
        });

        document.querySelectorAll('.feature-nav-btn, .dash-tile').forEach(el => {
            el.addEventListener('click', () => {
                const target = el.dataset.target || el.dataset.panel;
                if (checkTrialOrAuth()) switchPanel(target);
            });
        });

        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
        });

        // Modal Controls
        document.getElementById('modal-close').addEventListener('click', () => previewModal.classList.add('hidden'));
        document.getElementById('trial-btn-login').addEventListener('click', () => {
            trialModal.classList.add('hidden');
            switchView('login');
        });
        document.getElementById('trial-btn-register').addEventListener('click', () => {
            trialModal.classList.add('hidden');
            switchView('register');
        });

        // Form Auth Submits
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            state.user = { name: email.split('@')[0], email };
            localStorage.setItem('fata_user', JSON.stringify(state.user));
            updateAuthUI();
            switchPanel('dashboard');
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            state.user = { name, email };
            localStorage.setItem('fata_user', JSON.stringify(state.user));
            updateAuthUI();
            switchPanel('dashboard');
        });

        // Generator Triggers
        document.getElementById('btn-generate-image').addEventListener('click', handleImageGeneration);
        document.getElementById('btn-generate-video').addEventListener('click', handleVideoGeneration);
        document.getElementById('btn-analyze-img').addEventListener('click', handleImageAnalysis);
        document.getElementById('btn-analyze-vid').addEventListener('click', handleVideoAnalysis);
        document.getElementById('btn-generate-ppt').addEventListener('click', handlePPTGeneration);
    }

    // ==========================================================================
    // LOGIKA INTEGRASI PENYEDIA LAYANAN GENERATOR MULTIMEDIA
    // ==========================================================================

    // 1. AI Image Generator Execution
    async function handleImageGeneration() {
        const inputData = activeImageInputs['img-gen-input'];
        const prompt = document.getElementById('img-gen-prompt').value.trim();

        if (!inputData || !inputData.file) {
            showToast("Please upload an image before generating.");
            return;
        }
        if (!prompt) {
            showToast("Please enter a prompt before generating.");
            return;
        }
        if (!checkTrialOrAuth()) return;

        const resultsWrapper = document.getElementById('img-results-wrapper');
        const resultsGrid = document.getElementById('img-results-grid');

        resultsWrapper.classList.remove('hidden');
        resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--bright-green);">⚡ Generating 3 variations using Nano Banana AI...</div>`;

        try {
            const results = await window.aiService.generateImages(inputData.dataUrl, prompt, {
                ratio: document.getElementById('img-gen-ratio').value,
                style: document.getElementById('img-gen-style').value,
                quality: document.getElementById('img-gen-quality').value
            });

            consumeTrial();

            resultsGrid.innerHTML = results.map(item => `
                <div class="result-card">
                    <div class="result-media-box">
                        <img src="${item.url}" alt="Result">
                    </div>
                    <div class="result-card-body">
                        <h5>${item.meta}</h5>
                        <div class="icon-actions">
                            <button class="icon-btn" title="Preview" onclick="openPreviewModal('image', '${item.url}')">👁</button>
                            <button class="icon-btn" title="Download" onclick="downloadFile('${item.url}', 'FATA_Image.jpg')">↓</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            showToast("Something went wrong. Please try again.");
        }
    }

    // 2. AI Video Generator Execution
    async function handleVideoGeneration() {
        const inputData = activeImageInputs['video-gen-input'];
        const prompt = document.getElementById('video-gen-prompt').value.trim();

        if (!inputData || !inputData.file) { showToast("Please upload an image first."); return; }
        if (!prompt) { showToast("Please enter a prompt before generating."); return; }
        if (!checkTrialOrAuth()) return;

        const wrapper = document.getElementById('video-results-wrapper');
        const grid = document.getElementById('video-results-grid');
        wrapper.classList.remove('hidden');
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--bright-green);">⚡ Generating 3 video variations...</div>`;

        const results = await window.aiService.generateVideos(inputData.dataUrl, prompt);
        consumeTrial();

        grid.innerHTML = results.map((item, idx) => `
            <div class="result-card">
                <div class="result-media-box">
                    <video src="${item.url}" controls></video>
                </div>
                <div class="result-card-body">
                    <h5>Result ${idx + 1}</h5>
                    <div class="icon-actions">
                        <button class="icon-btn" title="Preview" onclick="openPreviewModal('video', '${item.url}')">👁</button>
                        <button class="icon-btn" title="Download" onclick="downloadFile('${item.url}', 'FATA_Video.mp4')">↓</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 3. Image Analysis Execution
    async function handleImageAnalysis() {
        const inputData = activeImageInputs['img-desc-input'];
        if (!inputData || !inputData.file) { showToast("Please upload an image before generating."); return; }
        if (!checkTrialOrAuth()) return;

        const wrapper = document.getElementById('img-desc-results-wrapper');
        const grid = document.getElementById('img-desc-results-grid');
        wrapper.classList.remove('hidden');
        grid.innerHTML = `<div style="text-align: center; color: var(--bright-green);">Analyzing image...</div>`;

        const results = await window.aiService.analyzeImage(inputData.dataUrl);
        consumeTrial();

        grid.innerHTML = results.map(item => `
            <div class="result-card">
                <h4 style="color: var(--bright-green); margin-bottom: 6px;">${item.title}</h4>
                <p style="font-size: 0.9rem; color: var(--text-white); margin-bottom: 10px;">${item.text}</p>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${item.text}')">Copy</button>
                    <button class="btn btn-outline btn-sm" onclick="downloadText('${item.text}', 'Description.txt')">Download TXT</button>
                </div>
            </div>
        `).join('');
    }

    // 4. Video Analysis Execution
    async function handleVideoAnalysis() {
        const fileInput = document.getElementById('vid-file-input');
        if (!fileInput.files.length) { showToast("Please upload a video file first."); return; }
        if (!checkTrialOrAuth()) return;

        const wrapper = document.getElementById('vid-desc-results-wrapper');
        const grid = document.getElementById('vid-desc-results-grid');
        wrapper.classList.remove('hidden');
        grid.innerHTML = `<div style="text-align: center; color: var(--bright-green);">Analyzing video content...</div>`;

        const results = await window.aiService.analyzeVideo(fileInput.files[0]);
        consumeTrial();

        grid.innerHTML = results.map(item => `
            <div class="result-card">
                <h4 style="color: var(--bright-green); margin-bottom: 6px;">${item.title}</h4>
                <p style="font-size: 0.9rem; color: var(--text-white); margin-bottom: 10px;">${item.text}</p>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${item.text}')">Copy</button>
                    <button class="btn btn-outline btn-sm" onclick="downloadText('${item.text}', 'Video_Analysis.txt')">Download TXT</button>
                </div>
            </div>
        `).join('');
    }

    // 5. PPT Generation Execution
    async function handlePPTGeneration() {
        const topic = document.getElementById('ppt-topic').value.trim();
        const slides = document.getElementById('ppt-slides').value;
        if (!topic) { showToast("Please enter a presentation topic."); return; }
        if (!checkTrialOrAuth()) return;

        const wrapper = document.getElementById('ppt-results-wrapper');
        const grid = document.getElementById('ppt-results-grid');
        wrapper.classList.remove('hidden');
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--bright-green);">Creating 3 presentation options...</div>`;

        const results = await window.aiService.generatePPT(topic, slides);
        consumeTrial();

        grid.innerHTML = results.map(item => `
            <div class="result-card">
                <div class="result-media-box" style="flex-direction: column; padding: 10px; text-align: center;">
                    <h5>${item.topic}</h5>
                    <small style="color: var(--bright-green); margin-top: 6px;">${item.slidesCount} Slides</small>
                </div>
                <div class="result-card-body">
                    <h5>${item.title}</h5>
                    <div class="icon-actions">
                        <button class="icon-btn" title="Preview" onclick="openPreviewModal('ppt', '${item.topic}')">👁</button>
                        <button class="icon-btn" title="Download" onclick="downloadText('${item.topic}', 'Presentation.pptx')">↓</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- Helper Utilities ---
    window.openPreviewModal = function(type, url) {
        if (type === 'image') {
            modalContentArea.innerHTML = `<img src="${url}" style="width: 100%; border-radius: 8px;">`;
        } else if (type === 'video') {
            modalContentArea.innerHTML = `<video src="${url}" controls autoplay style="width: 100%; border-radius: 8px;"></video>`;
        } else if (type === 'ppt') {
            modalContentArea.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <h3>PPT Preview: ${url}</h3>
                    <div style="background: var(--bg-sec); padding: 40px; margin: 15px 0; border-radius: 8px;">
                        <h4>Slide 1: Executive Summary</h4>
                    </div>
                </div>
            `;
        }
        previewModal.classList.remove('hidden');
    };

    window.downloadFile = function(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.downloadText = function(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        downloadFile(url, filename);
    };

    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => showToast("Text copied to clipboard."));
    };

    function showToast(msg) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    init();
});