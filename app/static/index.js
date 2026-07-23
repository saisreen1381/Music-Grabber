// Application State
let activeProfile = "";
let activePlaylistSourceId = "";
let editingSourceId = "";
let profiles = [];
let activeConfig = null;
let currentTracks = [];
let eventSource = null;
let currentBrowserPath = "/";
let parentBrowserPath = null;
let playerQueue = [];
let unshuffledQueue = [];
let currentQueueIndex = -1;
let currentPlayingTrack = null;
let discoverData = null;
let allLikedTracksSet = new Set();
let visualizerStyleMode = localStorage.getItem("musicgrabber_seekbar_style") || "solid_envelope";
let discoverSearchQuery = "";
let isMaximizedPlayerOpen = false;
let isLyricsActiveInMaximized = false;
let isQueueActiveInMaximized = true;
let currentSyncedLyricsLines = [];
let currentPlainLyricsLines = [];
let isLyricsAutoScrollEnabled = localStorage.getItem("musicgrabber_lyrics_autoscroll") !== "false";
let activeLyricsTrackKey = null;

async function updateLikedTracksSet() {
    allLikedTracksSet.clear();
    if (!activeProfile || !activeConfig || !activeConfig.sources) return;
    
    const likedSrc = activeConfig.sources.find(s => 
        (s.url && (s.url.includes("list=LM") || s.url.includes("list=LL"))) || 
        (s.name && s.name.toLowerCase().includes("liked"))
    );
    
    if (likedSrc) {
        try {
            const srcId = likedSrc.id || getSourceId(likedSrc);
            const res = await fetch(`/api/playlist/tracks?username=${activeProfile}&source_id=${srcId}`);
            if (res.ok) {
                const data = await res.json();
                (data.tracks || []).forEach(t => {
                    if (t.id) allLikedTracksSet.add(t.id);
                    if (t.url) allLikedTracksSet.add(t.url);
                    if (t.title) allLikedTracksSet.add(cleanMediaExtension(t.title).toLowerCase());
                });
            }
        } catch (e) {
            console.error("Error updating liked tracks set:", e);
        }
    }
}

// DOM Elements
let profileSelect = document.getElementById("profile-select");
let addProfileBtn = document.getElementById("add-profile-btn");
let profileWarning = document.getElementById("profile-warning");
const tabPanes = document.querySelectorAll(".tab-pane");
const navItems = document.querySelectorAll(".nav-item");

function getProfileSelect() {
    if (!profileSelect) profileSelect = document.getElementById("profile-select");
    return profileSelect;
}

function getProfileWarning() {
    if (!profileWarning) profileWarning = document.getElementById("profile-warning");
    return profileWarning;
}

// Sync Tab Elements
const syncNowBtn = document.getElementById("sync-now-btn");
const viewSyncModalBtn = document.getElementById("view-sync-modal-btn");
const syncBadge = document.getElementById("sync-badge");
const autoSyncStatus = document.getElementById("auto-sync-status");
const lastSyncTimeText = document.getElementById("last-sync-time");
const nextSyncTimeText = document.getElementById("next-sync-time");
const clearLogsBtn = document.getElementById("clear-logs-btn");
const copyLogsBtn = document.getElementById("copy-logs-btn");
const maximizeLogsBtn = document.getElementById("maximize-logs-btn");
const maximizeLogsIcon = document.getElementById("maximize-logs-icon");
const terminalCard = document.querySelector(".terminal-card");
const terminalBody = document.getElementById("terminal-body");
const filesTableBody = document.getElementById("files-table-body");
const filesCountText = document.getElementById("files-count");
const filesSearchInput = document.getElementById("files-search");

// Playlist Tab Elements
const newSourceBtn = document.getElementById("new-source-btn");
const sourcesListContainer = document.getElementById("sources-list");
const noPlaylistSelectedView = document.getElementById("no-playlist-selected");
const playlistActiveView = document.getElementById("playlist-active-view");
const activeSourceName = document.getElementById("active-source-name");
const activeSourceUrl = document.getElementById("active-source-url");
const refreshPlaylistBtn = document.getElementById("refresh-playlist-btn");
const editSourceBtn = document.getElementById("edit-source-btn");
const deleteSourceBtn = document.getElementById("delete-source-btn");
const selectAllTracksBtn = document.getElementById("select-all-tracks");
const deselectAllTracksBtn = document.getElementById("deselect-all-tracks");
const tracksSearchInput = document.getElementById("tracks-search");
const tracksLoadingSpinner = document.getElementById("tracks-loading-spinner");
const tracksItemsContainer = document.getElementById("tracks-items-container");
const tracksSelectedCount = document.getElementById("tracks-selected-count");

// Sync Progress Modal Elements
const syncProgressModal = document.getElementById("sync-progress-modal");
const syncModalTitle = document.getElementById("sync-modal-title");
const syncQuoteBox = document.getElementById("sync-quote-box");
const syncCurrentSong = document.getElementById("sync-current-song");
const syncModalProgress = document.getElementById("sync-modal-progress");
const syncProcessedCount = document.getElementById("sync-processed-count");
const syncPercentText = document.getElementById("sync-percent-text");
const syncElapsedTime = document.getElementById("sync-elapsed-time");
const syncEtaTime = document.getElementById("sync-eta-time");
const syncModalClose = document.getElementById("sync-modal-close");
const syncControlsWrapper = document.getElementById("sync-controls-wrapper");
const syncPauseBtn = document.getElementById("sync-pause-btn");
const syncPauseText = document.getElementById("sync-pause-text");
const syncPauseIcon = document.getElementById("sync-pause-icon");
const syncStopBtn = document.getElementById("sync-stop-btn");

// Settings Tab Elements
const settingDownloadDir = document.getElementById("setting-download-dir");
const settingFilenamePreset = document.getElementById("setting-filename-preset");
const settingEmbedMetadata = document.getElementById("setting-embed-metadata");
const settingMaxConcurrent = document.getElementById("setting-max-concurrent");
const rangeValueDisplay = document.getElementById("range-value-display");
const settingAutoSync = document.getElementById("setting-auto-sync");
const schedulerOptions = document.getElementById("scheduler-options");
const settingSyncMode = document.getElementById("setting-sync-mode");
const scheduleTimeField = document.getElementById("schedule-time-field");
const scheduleIntervalField = document.getElementById("schedule-interval-field");
const settingSyncTime = document.getElementById("setting-sync-time");
const settingSyncInterval = document.getElementById("setting-sync-interval");
const settingSeekbarStyle = document.getElementById("setting-seekbar-style");
const settingEqPreset = document.getElementById("setting-eq-preset");
const addLibraryDirInput = document.getElementById("add-library-dir-input");
const browseLibraryDirBtn = document.getElementById("browse-library-dir-btn");
const addLibraryDirBtn = document.getElementById("add-library-dir-btn");
const libraryDirsList = document.getElementById("library-dirs-list");
const cookiesStatusBadge = document.getElementById("cookies-status-badge");
const deleteCookiesBtn = document.getElementById("delete-cookies-btn");
const settingCookiesFile = document.getElementById("setting-cookies-file");
const triggerCookiesUploadBtn = document.getElementById("trigger-cookies-upload-btn");
const selectedCookiesFilename = document.getElementById("selected-cookies-filename");
const uploadCookiesBtn = document.getElementById("upload-cookies-btn");
const saveSettingsBtn = document.getElementById("save-settings-btn");
let activeDirectoryTargetInput = null;

// Discover Page & Bottom Audio Player Elements
const tabDiscover = document.getElementById("tab-discover");
const discoverArtistsGrid = document.getElementById("discover-artists-grid");
const discoverAlbumsGrid = document.getElementById("discover-albums-grid");
const discoverGenresGrid = document.getElementById("discover-genres-grid");
const discoverSongsTableBody = document.getElementById("discover-songs-table-body");
const discoverDetailsModal = document.getElementById("discover-details-modal");
const discoverDetailsTitle = document.getElementById("discover-details-title");
const discoverDetailsList = document.getElementById("discover-details-list");
const discoverDetailsClose = document.getElementById("discover-details-close");

// Spotify Bottom Player Elements
const musicPlayerBar = document.getElementById("music-player-bar");
const playerAlbumArt = document.getElementById("player-album-art");
const playerTrackTitle = document.getElementById("player-track-title");
const playerTrackArtist = document.getElementById("player-track-artist");
const playerPrevBtn = document.getElementById("player-prev-btn");
const playerPlayBtn = document.getElementById("player-play-btn");
const playerNextBtn = document.getElementById("player-next-btn");
const playSvg = document.getElementById("play-svg");
const pauseSvg = document.getElementById("pause-svg");
const playerCurrentTime = document.getElementById("player-current-time");
const playerProgressSlider = document.getElementById("player-progress-slider");
const playerTotalTime = document.getElementById("player-total-time");
const playerPipBtn = document.getElementById("player-pip-btn");
const playerVolumeSlider = document.getElementById("player-volume-slider");
const playerCloseBtn = document.getElementById("player-close-btn");
const localAudioElement = document.getElementById("local-audio-element");

// Modals
const profileModal = document.getElementById("profile-modal");
const browseDirBtn = document.getElementById("browse-dir-btn");
const dirBrowserModal = document.getElementById("dir-browser-modal");
const dirBrowserPath = document.getElementById("dir-browser-path");
const dirBrowserUpBtn = document.getElementById("dir-browser-up-btn");
const dirBrowserList = document.getElementById("dir-browser-list");
const dirBrowserCancel = document.getElementById("dir-browser-cancel");
const dirBrowserSelect = document.getElementById("dir-browser-select");
const newProfileUsername = document.getElementById("new-profile-username");
const profileModalCancel = document.getElementById("profile-modal-cancel");
const profileModalSave = document.getElementById("profile-modal-save");

const sourceModal = document.getElementById("source-modal");
const sourceModalTitle = document.getElementById("source-modal-title");
const newSourceType = document.getElementById("new-source-type");
const newSourceName = document.getElementById("new-source-name");
const sourceUrlGroup = document.getElementById("source-url-group");
const newSourceUrl = document.getElementById("new-source-url");
const sourcePathGroup = document.getElementById("source-path-group");
const newSourcePath = document.getElementById("new-source-path");
const sourceModalCancel = document.getElementById("source-modal-cancel");
const sourceModalSave = document.getElementById("source-modal-save");

let allDownloadedFilenamesSet = new Set();
let allDownloadedNormalizedSet = new Set();
let scannedFiles = [];

let sourceTitleFetchTimer = null;
if (newSourceUrl && newSourceName) {
    const handleUrlInput = () => {
        const urlVal = newSourceUrl.value.trim();
        const autoStatus = document.getElementById("source-name-auto-status");
        if (!urlVal) {
            if (autoStatus) autoStatus.style.display = "none";
            return;
        }
        
        clearTimeout(sourceTitleFetchTimer);
        sourceTitleFetchTimer = setTimeout(async () => {
            if (autoStatus) autoStatus.style.display = "inline-block";
            try {
                const res = await fetch(`/api/ytmusic/fetch-playlist-title?username=${encodeURIComponent(activeProfile || '')}&url=${encodeURIComponent(urlVal)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.title && data.status === "success") {
                        newSourceName.value = data.title;
                    }
                }
            } catch (err) {
                console.error("Error auto-fetching playlist title:", err);
            } finally {
                if (autoStatus) autoStatus.style.display = "none";
            }
        }, 400);
    };

    newSourceUrl.addEventListener("input", handleUrlInput);
    newSourceUrl.addEventListener("paste", () => setTimeout(handleUrlInput, 50));
    newSourceUrl.addEventListener("change", handleUrlInput);
}

function cleanMediaExtension(str) {
    if (!str) return "";
    return str.replace(/\.(mp3|flac|m4a|wav|opus|webm|aac|ogg)$/i, "");
}

function normalizeTrackName(name, stripBrackets = true) {
    if (!name) return "";
    let s = String(name).toLowerCase();
    if (stripBrackets) {
        s = s.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "");
    }
    s = cleanMediaExtension(s);
    // Standardize unicode fullwidth symbols (pipe, dash, colon)
    s = s.replace(/｜/g, "|").replace(/—/g, "-").replace(/：/g, ":");
    let cleaned = s.replace(/[^\p{L}\p{N}]/gu, "");
    if (!cleaned) return s.trim();
    return cleaned.trim();
}

function updateDownloadedFilesSet(list) {
    if (!Array.isArray(list)) return;
    list.forEach(item => {
        const name = item.name || item.filename || item.local_filename || item.title;
        if (name) {
            const rawLower = name.toLowerCase();
            const cleanLower = cleanMediaExtension(name).toLowerCase();
            const normFull = normalizeTrackName(name, false);
            const normStrip = normalizeTrackName(name, true);

            allDownloadedFilenamesSet.add(rawLower);
            allDownloadedFilenamesSet.add(cleanLower);
            if (normFull) allDownloadedNormalizedSet.add(normFull);
            if (normStrip) allDownloadedNormalizedSet.add(normStrip);
        }
    });
}

function isLocalTrack(track) {
    if (!track) return false;
    if (track.path || track.is_local || track.downloaded) return true;
    
    const fn = track.local_filename || track.filename || track.name || "";
    const title = track.title || track.display_name || "";
    
    const rawFn = fn ? fn.toLowerCase() : "";
    const cleanFn = fn ? cleanMediaExtension(fn).toLowerCase() : "";
    const rawTitle = title ? title.toLowerCase() : "";
    const cleanTitle = title ? cleanMediaExtension(title).toLowerCase() : "";

    const normFnFull = normalizeTrackName(fn, false);
    const normFnStrip = normalizeTrackName(fn, true);
    const normTitleFull = normalizeTrackName(title, false);
    const normTitleStrip = normalizeTrackName(title, true);

    const candidates = [
        rawFn, cleanFn, rawTitle, cleanTitle,
        normFnFull, normFnStrip, normTitleFull, normTitleStrip
    ];

    for (const cand of candidates) {
        if (!cand) continue;
        if (allDownloadedFilenamesSet.has(cand) || allDownloadedNormalizedSet.has(cand)) {
            return true;
        }
    }
    
    // Containment / partial matching check for longer titles (length >= 5)
    const normTargets = [normTitleFull, normTitleStrip, normFnFull, normFnStrip].filter(n => n && n.length >= 5);
    for (const target of normTargets) {
        for (const downloadedNorm of allDownloadedNormalizedSet) {
            if (downloadedNorm.length >= 5 && (target.includes(downloadedNorm) || downloadedNorm.includes(target))) {
                return true;
            }
        }
    }

    if (typeof scannedFiles !== "undefined" && Array.isArray(scannedFiles)) {
        for (const f of scannedFiles) {
            const fName = f.name || f.filename || "";
            const fNormFull = normalizeTrackName(fName, false);
            const fNormStrip = normalizeTrackName(fName, true);
            if (fNormFull && (normTargets.includes(fNormFull) || normTargets.includes(fNormStrip))) {
                return true;
            }
        }
    }
    return false;
}

function getLocalFilename(track) {
    if (!track) return null;
    
    // Only trust explicit local properties if the track has confirmed-local flags
    const confirmedLocal = track.path || track.is_local || track.downloaded;
    if (confirmedLocal) {
        if (track.local_filename) return track.local_filename;
        if (track.filename) return track.filename;
        if (track.path) return track.path.split(/[\/\\]/).pop();
    }

    // Fuzzy match against scanned local files using the track title/name
    const fn = track.local_filename || track.filename || track.name || "";
    const title = track.title || track.display_name || "";

    const normFnFull = normalizeTrackName(fn, false);
    const normFnStrip = normalizeTrackName(fn, true);
    const normTitleFull = normalizeTrackName(title, false);
    const normTitleStrip = normalizeTrackName(title, true);

    const normTargets = [normTitleFull, normTitleStrip, normFnFull, normFnStrip].filter(n => n && n.length >= 3);

    if (typeof scannedFiles !== "undefined" && Array.isArray(scannedFiles)) {
        for (const f of scannedFiles) {
            const fName = f.name || f.filename || "";
            const fNormFull = normalizeTrackName(fName, false);
            const fNormStrip = normalizeTrackName(fName, true);
            if (fNormFull && (normTargets.includes(fNormFull) || normTargets.includes(fNormStrip))) {
                return fName;
            }
            for (const target of normTargets) {
                if (target.length >= 5 && fNormFull.length >= 5 && (target.includes(fNormFull) || fNormFull.includes(target))) {
                    return fName;
                }
            }
        }
    }
    return null;
}

// Helper: Format Bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper: Format Duration (seconds to MM:SS)
function formatDuration(secs) {
    if (!secs) return "—";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function extractVideoId(trackOrUrl) {
    if (!trackOrUrl) return "";
    if (typeof trackOrUrl === "object") {
        if (trackOrUrl.id && trackOrUrl.id.length === 11 && !trackOrUrl.id.startsWith("src_")) {
            return trackOrUrl.id;
        }
        if (trackOrUrl.video_id) return trackOrUrl.video_id;
        trackOrUrl = trackOrUrl.url || "";
    }
    const str = String(trackOrUrl).trim();
    if (str.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
        return str;
    }
    const match = str.match(/(?:v=|\/vi\/|\/watch\?v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : "";
}

// Fetch available profiles (Guarded against concurrent wipes)
let isProfilesLoading = false;
let hasProfilesLoaded = false;

async function loadProfiles(forceRefresh = false) {
    if (isProfilesLoading && !forceRefresh) return;
    isProfilesLoading = true;
    
    const sel = getProfileSelect();
    const warn = getProfileWarning();
    
    try {
        const res = await fetch("/api/profiles?t=" + Date.now(), {
            headers: { "Cache-Control": "no-cache" }
        });
        const data = await res.json();
        profiles = Array.isArray(data) ? data : (data.profiles || []);
        
        // Populate select
        if (sel) {
            sel.innerHTML = '<option value="" disabled>Select Profile</option>';
            profiles.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
            });
        }

        // Restore last used profile or select first available profile
        let savedProfile = null;
        try { savedProfile = localStorage.getItem("musicgrabber_active_profile"); } catch (e) {}
        let targetProfile = (savedProfile && profiles.includes(savedProfile)) ? savedProfile : (activeProfile && profiles.includes(activeProfile) ? activeProfile : (profiles.length > 0 ? profiles[0] : null));
        
        if (targetProfile) {
            if (sel) sel.value = targetProfile;
            try {
                await handleProfileChange(targetProfile);
            } catch (err) {
                console.error("Error loading initial profile:", err);
            }
        } else {
            if (warn) {
                warn.classList.add("active-pane");
                warn.style.display = "block";
            }
        }
        hasProfilesLoaded = true;
    } catch (e) {
        console.error("Failed to load profiles", e);
    } finally {
        isProfilesLoading = false;
    }
}

// Profile Dropdown Change Listener
const selForListener = getProfileSelect();
if (selForListener) {
    selForListener.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            handleProfileChange(val);
        }
    });
}

// Switch Workspace Tabs
function switchTab(targetTab) {
    if (!targetTab) targetTab = "tab-sync";
    if (!targetTab.startsWith("tab-")) {
        targetTab = "tab-" + targetTab;
    }
    
    // Hide profile warning overlay
    const warn = getProfileWarning();
    if (warn) {
        warn.classList.remove("active-pane");
        warn.classList.remove("active");
        warn.style.display = "none";
    }
    
    // Hide all tab panes
    document.querySelectorAll(".tab-pane").forEach(pane => {
        if (pane.id !== "profile-warning") {
            pane.classList.remove("active-pane");
            pane.classList.remove("active");
            pane.style.display = "none";
        }
    });
    
    // Show target tab pane
    const targetPane = document.getElementById(targetTab);
    if (targetPane) {
        targetPane.classList.add("active-pane");
        targetPane.classList.add("active");
        targetPane.style.display = "block";
    }
    
    // Update sidebar nav button active states
    document.querySelectorAll(".nav-item").forEach(nav => {
        const tabAttr = nav.getAttribute("data-tab");
        if (tabAttr === targetTab || "tab-" + tabAttr === targetTab) {
            nav.classList.add("active");
        } else {
            nav.classList.remove("active");
        }
    });
    
    // Persist active tab
    if (activeProfile) {
        try { localStorage.setItem(`musicgrabber_active_tab_${activeProfile}`, targetTab); } catch (e) {}
    }
    try { localStorage.setItem("musicgrabber_active_tab", targetTab); } catch (e) {}
}

// Attach Sidebar Nav Click Handlers
document.querySelectorAll(".nav-item[data-tab]").forEach(nav => {
    nav.addEventListener("click", () => {
        const targetTab = nav.getAttribute("data-tab");
        if (targetTab) {
            switchTab(targetTab);
            if (targetTab === "tab-discover" || targetTab === "discover") {
                loadYtMusicDiscoverData();
            } else if (targetTab === "tab-library" || targetTab === "library") {
                loadDiscoverData();
            }
        }
    });
});

// Handle Profile Change
async function handleProfileChange(username) {
    if (!username) return;
    activeProfile = username;
    
    // 1. Immediately store active profile & update select dropdown
    try { localStorage.setItem("musicgrabber_active_profile", username); } catch (e) {}
    const sel = getProfileSelect();
    if (sel) sel.value = username;
    
    // 2. Immediately switch tab away from profile warning overlay
    const savedTab = (username ? localStorage.getItem(`musicgrabber_active_tab_${username}`) : null) || localStorage.getItem("musicgrabber_active_tab") || "tab-sync";
    switchTab(savedTab);
    
    // 3. Load config safely
    try {
        await loadConfig(username);
    } catch (e) {
        console.error("Error loading config for profile:", username, e);
    }
    
    // 4. Trigger individual subview updates safely without blocking
    try { refreshStatus(); } catch (e) { console.error(e); }
    try { loadFiles(); } catch (e) { console.error(e); }
    try { renderSourcesList(); } catch (e) { console.error(e); }
    try { loadDiscoverData(); } catch (e) { console.error(e); }
    try { restoreLastPlayedTrack(); } catch (e) { console.error(e); }
    try { initSyncSubtabs(); } catch (e) { console.error(e); }
    try { initContextMenu(); } catch (e) { console.error(e); }
    try { initLibraryToolbar(); } catch (e) { console.error(e); }
    try { initLocalPlaylists(); } catch (e) { console.error(e); }
    
    // Restore last active playlist tab if saved
    try {
        const savedPlaylistId = localStorage.getItem(`musicgrabber_last_playlist_${activeProfile}`);
        if (savedPlaylistId && activeConfig && activeConfig.sources && activeConfig.sources.some(s => s.id === savedPlaylistId)) {
            loadPlaylistTracks(savedPlaylistId);
        } else {
            if (noPlaylistSelectedView) noPlaylistSelectedView.style.display = "flex";
            if (playlistActiveView) playlistActiveView.style.display = "none";
            activePlaylistSourceId = "";
        }
    } catch (e) {
        if (noPlaylistSelectedView) noPlaylistSelectedView.style.display = "flex";
        if (playlistActiveView) playlistActiveView.style.display = "none";
        activePlaylistSourceId = "";
    }
    
    if (savedTab === "tab-discover" || savedTab === "discover") {
        try { loadYtMusicDiscoverData(); } catch (e) {}
    } else if (savedTab === "tab-library" || savedTab === "library") {
        try { loadDiscoverData(); } catch (e) {}
    }
}

// Load Configuration from server
async function loadConfig(username) {
    try {
        const res = await fetch(`/api/config?username=${username}&t=${Date.now()}`);
        activeConfig = await res.json();
        if (!activeConfig.sources) activeConfig.sources = [];
        activeConfig.sources.forEach(src => {
            if (!src.id) src.id = getSourceId(src);
        });
        populateSettingsForm();
        renderSourcesList();
        await refreshCookiesStatus(username);
        await updateLikedTracksSet();
    } catch (e) {
        console.error("Failed to load config", e);
    }
}

// Fetch and display cookies status
async function refreshCookiesStatus(username) {
    if (!username) return;
    
    // Reset file input and display
    if (settingCookiesFile) settingCookiesFile.value = "";
    if (selectedCookiesFilename) selectedCookiesFilename.textContent = "No file selected";
    if (uploadCookiesBtn) uploadCookiesBtn.style.display = "none";
    
    try {
        const res = await fetch(`/api/cookies/status?username=${username}&t=${Date.now()}`);
        const data = await res.json();
        
        if (cookiesStatusBadge) {
            if (data.status === "loaded") {
                cookiesStatusBadge.className = "badge badge-success";
                cookiesStatusBadge.textContent = `Cookies Active (${data.filename})`;
                if (deleteCookiesBtn) deleteCookiesBtn.style.display = "inline-block";
            } else {
                cookiesStatusBadge.className = "badge badge-danger";
                cookiesStatusBadge.textContent = "Cookies Missing";
                if (deleteCookiesBtn) deleteCookiesBtn.style.display = "none";
            }
        }
    } catch (e) {
        console.error("Failed to load cookies status", e);
        if (cookiesStatusBadge) {
            cookiesStatusBadge.className = "badge badge-warning";
            cookiesStatusBadge.textContent = "Status Unknown";
        }
        if (deleteCookiesBtn) deleteCookiesBtn.style.display = "none";
    }
}

// Directory Browser Navigation & Control
async function fetchDirectory(path) {
    if (!dirBrowserList) return;
    dirBrowserList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);"><span class="spinner" style="width:16px; height:16px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Loading directory...</div>';
    
    try {
        const res = await fetch(`/api/browse?path=${encodeURIComponent(path || "/")}&t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to list directory");
        const data = await res.json();
        
        currentBrowserPath = data.current_path || "/";
        parentBrowserPath = data.parent_path;
        
        if (dirBrowserPath) dirBrowserPath.textContent = currentBrowserPath;
        
        if (dirBrowserUpBtn) {
            dirBrowserUpBtn.style.display = (parentBrowserPath || (currentBrowserPath && currentBrowserPath !== "/")) ? "inline-flex" : "none";
        }
        
        dirBrowserList.innerHTML = "";
        if (!data.subdirectories || data.subdirectories.length === 0) {
            dirBrowserList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-dim); font-style: italic;">No subdirectories found.</div>';
            return;
        }
        
        data.subdirectories.forEach(sub => {
            const item = document.createElement("div");
            item.className = "dir-item";
            item.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s; background: rgba(255,255,255,0.02); margin-bottom: 4px; border: 1px solid rgba(255,255,255,0.04);";
            item.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span style="font-size: 0.88rem; color: var(--text-main); font-weight: 500;">${escapeHtml(sub)}</span>
            `;
            item.addEventListener("mouseenter", () => item.style.background = "rgba(99, 102, 241, 0.18)");
            item.addEventListener("mouseleave", () => item.style.background = "rgba(255,255,255,0.02)");
            item.addEventListener("click", () => {
                const slash = (currentBrowserPath.endsWith("/") || currentBrowserPath.endsWith("\\")) ? "" : "/";
                fetchDirectory(currentBrowserPath + slash + sub);
            });
            dirBrowserList.appendChild(item);
        });
    } catch (e) {
        if (dirBrowserList) dirBrowserList.innerHTML = `<div style="color: var(--danger); padding: 16px; text-align: center;">Error listing folders: ${e.message}</div>`;
    }
}

// Attach Directory Browser Listeners
if (dirBrowserUpBtn) {
    dirBrowserUpBtn.addEventListener("click", () => {
        if (parentBrowserPath) {
            fetchDirectory(parentBrowserPath);
        } else if (currentBrowserPath && currentBrowserPath !== "/") {
            const parts = currentBrowserPath.replace(/[/\\]+$/, "").split(/[/\\]/);
            parts.pop();
            const parent = parts.join("/") || "/";
            fetchDirectory(parent);
        }
    });
}

if (browseDirBtn) {
    browseDirBtn.addEventListener("click", () => {
        activeDirectoryTargetInput = settingDownloadDir;
        if (dirBrowserModal) dirBrowserModal.style.display = "flex";
        const initial = (settingDownloadDir && settingDownloadDir.value.trim()) ? settingDownloadDir.value.trim() : "/";
        fetchDirectory(initial);
    });
}

if (browseLibraryDirBtn) {
    browseLibraryDirBtn.addEventListener("click", () => {
        activeDirectoryTargetInput = addLibraryDirInput;
        if (dirBrowserModal) dirBrowserModal.style.display = "flex";
        const initial = (addLibraryDirInput && addLibraryDirInput.value.trim()) ? addLibraryDirInput.value.trim() : "/";
        fetchDirectory(initial);
    });
}

if (dirBrowserCancel) {
    dirBrowserCancel.addEventListener("click", () => {
        if (dirBrowserModal) dirBrowserModal.style.display = "none";
    });
}

if (dirBrowserSelect) {
    dirBrowserSelect.addEventListener("click", () => {
        if (activeDirectoryTargetInput) {
            activeDirectoryTargetInput.value = currentBrowserPath;
            activeDirectoryTargetInput.dispatchEvent(new Event("input", { bubbles: true }));
            activeDirectoryTargetInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (dirBrowserModal) dirBrowserModal.style.display = "none";
        showToast(`Selected directory: ${currentBrowserPath}`, "success");
    });
}

// Populate Settings Form from activeConfig
function populateSettingsForm() {
    if (!activeConfig) return;
    
    if (!activeConfig.additional_library_dirs) {
        activeConfig.additional_library_dirs = [];
    }
    
    if (settingDownloadDir) settingDownloadDir.value = activeConfig.download_dir || "";
    if (settingFilenamePreset) settingFilenamePreset.value = activeConfig.filename_template || "%(title)s.%(ext)s";
    if (settingEmbedMetadata) settingEmbedMetadata.checked = activeConfig.embed_metadata !== false;
    
    const maxConc = activeConfig.max_concurrent_downloads || 3;
    if (settingMaxConcurrent) settingMaxConcurrent.value = maxConc;
    if (rangeValueDisplay) rangeValueDisplay.textContent = maxConc;
    
    const autoSync = activeConfig.auto_sync === true;
    if (settingAutoSync) settingAutoSync.checked = autoSync;
    if (schedulerOptions) schedulerOptions.style.display = autoSync ? "block" : "none";
    
    // Detect schedule mode based on config
    const isInterval = activeConfig.sync_interval_hours && activeConfig.sync_interval_hours !== 24;
    if (settingSyncMode) settingSyncMode.value = isInterval ? "interval" : "time";
    if (settingSyncInterval) settingSyncInterval.value = activeConfig.sync_interval_hours || 24;
    if (settingSyncTime) settingSyncTime.value = activeConfig.sync_time || "02:00";
    if (scheduleIntervalField) scheduleIntervalField.style.display = isInterval ? "block" : "none";
    if (scheduleTimeField) scheduleTimeField.style.display = isInterval ? "none" : "block";
    
    // Populate UI Customizations from activeConfig
    if (activeConfig.seekbar_style) {
        if (activeConfig.seekbar_style === "equalizer") activeConfig.seekbar_style = "track_waveform_bars";
        visualizerStyleMode = activeConfig.seekbar_style;
        if (settingSeekbarStyle) settingSeekbarStyle.value = visualizerStyleMode;
        
        const radioToSelect = document.querySelector(`input[name="seekbar_style_radio"][value="${visualizerStyleMode}"]`);
        if (radioToSelect) radioToSelect.checked = true;
        document.querySelectorAll('.seekbar-card').forEach(card => {
            if (card.getAttribute("data-style-value") === visualizerStyleMode) {
                card.classList.add("active");
            } else {
                card.classList.remove("active");
            }
        });
    }
    if (activeConfig.eq_preset && settingEqPreset) {
        settingEqPreset.value = activeConfig.eq_preset;
        applyEqualizerPreset(activeConfig.eq_preset);
    }
    const autoLaunchInput = document.getElementById("setting-autoplay-launch");
    if (autoLaunchInput) {
        autoLaunchInput.checked = activeConfig.autoplay_launch === true;
    }
    const autoDownloadLikedInput = document.getElementById("setting-auto-download-liked");
    if (autoDownloadLikedInput) {
        autoDownloadLikedInput.checked = activeConfig.auto_download_liked === true;
    }

    renderAdditionalLibraryDirs();
    updateHeaderStats();
}

function updateHeaderStats() {
    const tracksCountElem = document.getElementById("hdr-tracks-count");
    const playlistsCountElem = document.getElementById("hdr-playlists-count");
    const autoSyncDot = document.getElementById("hdr-autosync-dot");
    const autoSyncStatusElem = document.getElementById("hdr-autosync-status");

    if (tracksCountElem) {
        const total = (currentTracks && currentTracks.length) ? currentTracks.length : 0;
        tracksCountElem.textContent = total;
    }
    if (playlistsCountElem) {
        const totalSources = (activeConfig && activeConfig.sources) ? activeConfig.sources.length : 0;
        playlistsCountElem.textContent = totalSources;
    }
    if (autoSyncStatusElem && autoSyncDot) {
        const isAutoSyncOn = activeConfig && activeConfig.auto_sync === true;
        if (isAutoSyncOn) {
            autoSyncDot.classList.add("active");
            const modeText = (activeConfig.sync_mode === "interval") 
                ? `Every ${activeConfig.sync_interval_hours || 24}h` 
                : `Daily @ ${activeConfig.sync_time || "02:00"}`;
            autoSyncStatusElem.textContent = `Auto-Sync: ${modeText}`;
            autoSyncStatusElem.style.color = "#10b981";
        } else {
            autoSyncDot.classList.remove("active");
            autoSyncStatusElem.textContent = "Auto-Sync Off";
            autoSyncStatusElem.style.color = "var(--text-muted)";
        }
    }
}

function initSeekbarRadioCards() {
    const radioInputs = document.querySelectorAll('input[name="seekbar_style_radio"]');
    const cards = document.querySelectorAll('.seekbar-card');
    const hiddenInput = document.getElementById("setting-seekbar-style");

    radioInputs.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const val = e.target.value;
            if (hiddenInput) hiddenInput.value = val;
            visualizerStyleMode = val;
            try { localStorage.setItem("musicgrabber_seekbar_style", val); } catch (err) {}
            
            cards.forEach(card => {
                if (card.getAttribute("data-style-value") === val) {
                    card.classList.add("active");
                } else {
                    card.classList.remove("active");
                }
            });

            if (activeConfig) {
                activeConfig.seekbar_style = val;
                autoSaveSettings();
            }
        });
    });

    cards.forEach(card => {
        card.addEventListener("click", () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio && !radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event("change"));
            }
        });
    });
}

function renderAdditionalLibraryDirs() {
    if (!libraryDirsList || !activeConfig) return;
    const dirs = activeConfig.additional_library_dirs || [];
    libraryDirsList.innerHTML = "";
    
    if (dirs.length === 0) {
        libraryDirsList.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-dim); font-style: italic;">No additional scan folders configured.</span>`;
        return;
    }
    
    dirs.forEach(path => {
        const item = document.createElement("div");
        item.className = "library-dir-item";
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.justifyContent = "space-between";
        item.style.background = "rgba(255,255,255,0.02)";
        item.style.padding = "8px 12px";
        item.style.borderRadius = "var(--radius-md)";
        item.style.border = "1px solid rgba(255,255,255,0.05)";
        item.style.fontSize = "0.85rem";
        item.style.color = "var(--text-main)";
        
        item.innerHTML = `
            <span>${escapeHtml(path)}</span>
            <button class="btn btn-icon delete-library-dir-btn" data-path="${escapeHtml(path)}" style="padding: 4px; color: var(--danger); width: 24px; height: 24px; min-width: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        `;
        
        item.querySelector(".delete-library-dir-btn").addEventListener("click", () => {
            activeConfig.additional_library_dirs = activeConfig.additional_library_dirs.filter(p => p !== path);
            renderAdditionalLibraryDirs();
        });
        
        libraryDirsList.appendChild(item);
    });
}

// Refresh status card information
async function refreshStatus() {
    if (!activeProfile) return;
    try {
        const res = await fetch(`/api/sync/status?username=${activeProfile}&t=${Date.now()}`);
        const status = await res.json();
        
        // Sync badge
        const syncQuoteBox = document.getElementById("sync-quote-box");
        const syncCurrentSongWrapper = document.getElementById("sync-current-song-wrapper");
        const syncProgressBarWrapper = document.getElementById("sync-progress-bar-wrapper");
        const syncStatsWrapper = document.getElementById("sync-stats-wrapper");
        const syncTimersWrapper = document.getElementById("sync-timers-wrapper");

        if (status.syncing) {
            syncBadge.className = "badge badge-syncing";
            syncBadge.textContent = "Syncing";
            syncNowBtn.disabled = true;
            syncModalTitle.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px; border-top-color: var(--primary); margin: 0;"></span> Syncing Library...`;
            if (syncQuoteBox) syncQuoteBox.style.display = "none";
            if (syncCurrentSongWrapper) syncCurrentSongWrapper.style.display = "none";
            if (syncProgressBarWrapper) syncProgressBarWrapper.style.display = "flex";
            if (syncStatsWrapper) syncStatsWrapper.style.display = "grid";
            if (syncTimersWrapper) syncTimersWrapper.style.display = "none";
            if (syncControlsWrapper) syncControlsWrapper.style.display = "flex";
            
            // Auto expand logs during sync so users see lines stream in
            if (terminalBody) terminalBody.style.display = "flex";
            if (logsToggleArrow) logsToggleArrow.style.transform = "rotate(180deg)";

            if (status.last_log && terminalBody && terminalBody.children.length <= 1) {
                terminalBody.innerHTML = "";
                status.last_log.split("\n").forEach(line => {
                    if (line.trim()) appendTerminalLine(line.trim());
                });
            }
        } else {
            syncBadge.className = "badge badge-idle";
            syncBadge.textContent = "Idle";
            syncNowBtn.disabled = false;
            syncModalTitle.innerHTML = `Library Sync: Idle`;
            if (syncQuoteBox) syncQuoteBox.style.display = "none";
            if (syncCurrentSongWrapper) syncCurrentSongWrapper.style.display = "none";
            if (syncProgressBarWrapper) syncProgressBarWrapper.style.display = "none";
            if (syncStatsWrapper) syncStatsWrapper.style.display = "none";
            if (syncTimersWrapper) syncTimersWrapper.style.display = "none";
            if (syncControlsWrapper) syncControlsWrapper.style.display = "none";
            
            // Reset Pause Button State
            if (syncPauseText) syncPauseText.textContent = "Pause";
            if (syncPauseIcon) syncPauseIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
        }
        
        // Auto-sync status badge
        if (activeConfig && activeConfig.auto_sync) {
            autoSyncStatus.className = "badge badge-success";
            autoSyncStatus.textContent = "Auto-Sync On";
        } else {
            autoSyncStatus.className = "badge badge-disabled";
            autoSyncStatus.textContent = "Auto-Sync Off";
        }
        
        // Dates
        if (status.last_sync_time) {
            const lastDate = new Date(status.last_sync_time);
            lastSyncTimeText.textContent = `${lastDate.toLocaleDateString()} ${lastDate.toLocaleTimeString()} (${status.last_sync_status || 'UNKNOWN'})`;
        } else {
            lastSyncTimeText.textContent = "Never";
        }
        
        if (status.next_sync_time && activeConfig && activeConfig.auto_sync) {
            const nextDate = new Date(status.next_sync_time);
            nextSyncTimeText.textContent = `${nextDate.toLocaleDateString()} ${nextDate.toLocaleTimeString()}`;
        } else {
            nextSyncTimeText.textContent = "Disabled";
        }

        // Preload logs if available and idle
        if (!status.syncing && status.last_log && terminalBody.children.length <= 1) {
            terminalBody.innerHTML = '<span class="system-line">[System] Loaded previous run logs:</span>';
            status.last_log.split("\n").forEach(line => appendTerminalLine(line));
        }
    } catch (e) {
        console.error("Failed to load status", e);
    }
}

// Fetch and render existing downloaded files
function cleanMediaExtension(str) {
    if (!str) return "";
    return str.replace(/\.(mp3|flac|m4a|wav|opus|webm|aac|ogg)$/i, "");
}

// Fetch and render existing downloaded files
let allDownloadedFiles = [];
let allToDownloadTracks = [];

async function loadFiles() {
    if (!activeProfile) return;
    try {
        const res = await fetch(`/api/scan?username=${activeProfile}&t=${Date.now()}`);
        const data = await res.json();
        allDownloadedFiles = data.files || [];
        scannedFiles = allDownloadedFiles;
        updateDownloadedFilesSet(allDownloadedFiles);
        renderFilesList(allDownloadedFiles);
        await loadToDownloadList();
    } catch (e) {
        console.error("Failed to load directory files", e);
    }
}

async function loadToDownloadList() {
    if (!activeProfile || !activeConfig || !activeConfig.sources) return;
    
    allToDownloadTracks = [];
    const seenTrackKeys = new Set();
    
    for (const src of activeConfig.sources) {
        try {
            const res = await fetch(`/api/playlist/tracks?username=${activeProfile}&source_id=${src.id}`);
            if (res.ok) {
                const data = await res.json();
                const tracks = data.tracks || [];
                tracks.forEach(t => {
                    if (!t.downloaded && t.enabled) {
                        const title = cleanMediaExtension(t.title || t.display_name || "Unknown Track");
                        const trackKey = (t.id || title).toLowerCase().trim();
                        if (!seenTrackKeys.has(trackKey)) {
                            seenTrackKeys.add(trackKey);
                            allToDownloadTracks.push({
                                ...t,
                                title: title,
                                source_name: src.name || "Playlist",
                                est_path: activeConfig.download_dir ? `${activeConfig.download_dir}/${title}.mp3` : `${title}.mp3`
                            });
                        }
                    }
                });
            }
        } catch (e) {}
    }
    
    renderToDownloadTable(allToDownloadTracks);
}

function renderToDownloadTable(tracks) {
    const tbody = document.getElementById("to-download-table-body");
    const countBadge = document.getElementById("to-download-count");
    if (countBadge) countBadge.textContent = tracks.length;
    if (!tbody) return;
    
    if (tracks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-table" style="padding: 40px; text-align: center; color: var(--text-muted);">🎉 All playlist songs are downloaded and up-to-date!</td></tr>`;
        return;
    }
    
    tbody.innerHTML = "";
    tracks.forEach((t, idx) => {
        const tr = document.createElement("tr");
        const cleanTitle = cleanMediaExtension(t.title || t.display_name || "Unknown Track");
        tr.innerHTML = `
            <td style="text-align: center;">
                <button class="btn btn-icon btn-sm play-queued-track-btn" title="Play Song" style="width: 24px; height: 24px; border-radius: 50%; color: var(--primary); padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </td>
            <td style="font-weight: 500;">${escapeHtml(cleanTitle)}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(t.source_name)}</td>
        `;
        
        tr.querySelector(".play-queued-track-btn").addEventListener("click", () => {
            playTrack(t, tracks, idx);
        });
        
        tbody.appendChild(tr);
    });
}

function renderFilesList(files) {
    if (filesCountText) filesCountText.textContent = `${files.length}`;
    if (typeof updateHeaderStats === "function") updateHeaderStats();
    
    if (!filesTableBody) return;
    
    if (files.length === 0) {
        filesTableBody.innerHTML = `<tr><td colspan="3" class="empty-table" style="padding: 40px; text-align: center; color: var(--text-muted);">No audio files found in library directories.</td></tr>`;
        return;
    }
    
    filesTableBody.innerHTML = "";
    files.forEach((f, idx) => {
        const tr = document.createElement("tr");
        const cleanName = cleanMediaExtension(f.name);
        const mockTrack = {
            filename: f.name,
            local_filename: f.name,
            title: cleanName,
            artist: "Downloaded Track",
            thumbnail_url: `/api/thumbnail?path=${encodeURIComponent(f.path)}`
        };
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <button class="btn btn-icon btn-sm play-downloaded-file-btn" title="Play File" style="width: 24px; height: 24px; border-radius: 50%; color: var(--primary); padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </td>
            <td style="font-weight: 500;">${escapeHtml(cleanName)}</td>
            <td style="white-space: nowrap; color: var(--text-muted); text-align: right; font-size: 0.8rem;">${formatBytes(f.size_bytes)}</td>
        `;
        
        tr.querySelector(".play-downloaded-file-btn").addEventListener("click", () => {
            const queue = files.map(fileItem => ({
                filename: fileItem.name,
                local_filename: fileItem.name,
                title: cleanMediaExtension(fileItem.name),
                artist: "Downloaded Track",
                thumbnail_url: `/api/thumbnail?path=${encodeURIComponent(fileItem.path)}`
            }));
            playTrack(mockTrack, queue, idx);
        });
        
        filesTableBody.appendChild(tr);
    });
}

// Filter downloaded and queued files locally
filesSearchInput.addEventListener("input", () => {
    const q = filesSearchInput.value.toLowerCase().trim();
    if (!q) {
        renderFilesList(allDownloadedFiles);
        renderToDownloadTable(allToDownloadTracks);
        return;
    }
    const filteredFiles = allDownloadedFiles.filter(f => f.name.toLowerCase().includes(q));
    const filteredToDownload = allToDownloadTracks.filter(t => (t.title || "").toLowerCase().includes(q) || (t.source_name || "").toLowerCase().includes(q));
    renderFilesList(filteredFiles);
    renderToDownloadTable(filteredToDownload);
});

// Render Playlists Sidebar Sources List
function renderSourcesList() {
    if (!activeConfig || !activeConfig.sources) {
        sourcesListContainer.innerHTML = '<div class="empty-sources">No playlists configured.</div>';
        return;
    }
    
    sourcesListContainer.innerHTML = "";
    
    if (activeConfig.sources.length === 0) {
        sourcesListContainer.innerHTML = '<div class="empty-sources">No playlists configured.</div>';
        return;
    }
    
    activeConfig.sources.forEach(src => {
        const div = document.createElement("div");
        div.className = `source-item ${src.id === activePlaylistSourceId ? 'active' : ''}`;
        
        let typeLabel = "YouTube Music";
        if (src.type === "youtube_playlist") typeLabel = "YouTube Video";
        if (src.type === "text_file") typeLabel = "Text List";
        
        div.innerHTML = `
            <span class="source-name">${escapeHtml(src.name)}</span>
            <span class="source-type">${typeLabel}</span>
        `;
        
        div.addEventListener("click", () => {
            // Highlight active element
            document.querySelectorAll(".source-item").forEach(el => el.classList.remove("active"));
            div.classList.add("active");
            
            loadPlaylistTracks(src.id);
        });
        
        sourcesListContainer.appendChild(div);
    });
}

// Fetch and load tracks of a playlist
async function loadPlaylistTracks(sourceId, refresh = false) {
    activePlaylistSourceId = sourceId;
    try {
        if (activeProfile) {
            localStorage.setItem(`musicgrabber_last_playlist_${activeProfile}`, sourceId);
        }
    } catch (e) {}
    
    // Find active source metadata
    const source = activeConfig.sources.find(s => s.id === sourceId);
    if (!source) return;
    
    // Toggle pane view
    noPlaylistSelectedView.style.display = "none";
    playlistActiveView.style.display = "flex";
    
    activeSourceName.textContent = source.name;
    const isUrl = source.url && source.url.startsWith("http");
    activeSourceUrl.textContent = source.url || source.path || "";
    if (isUrl) {
        activeSourceUrl.href = source.url;
        activeSourceUrl.style.cursor = "pointer";
        activeSourceUrl.style.pointerEvents = "auto";
        activeSourceUrl.style.textDecoration = "underline";
    } else {
        activeSourceUrl.removeAttribute("href");
        activeSourceUrl.style.cursor = "default";
        activeSourceUrl.style.pointerEvents = "none";
        activeSourceUrl.style.textDecoration = "none";
    }
    
    // Show spinner, clear table
    tracksLoadingSpinner.style.display = "flex";
    tracksItemsContainer.innerHTML = "";
    
    try {
        const res = await fetch(`/api/playlist/tracks?username=${activeProfile}&source_id=${sourceId}&refresh=${refresh}&t=${Date.now()}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ detail: "API request failed" }));
            throw new Error(errData.detail || "API failed");
        }
        
        const data = await res.json();
        currentTracks = data.tracks || [];
        
        renderTracksList(currentTracks);
    } catch (e) {
        const errorMsg = e.message || "Failed to load playlist tracks.";
        const isCookieError = errorMsg.toLowerCase().includes("cookie") || errorMsg.toLowerCase().includes("liked") || errorMsg.toLowerCase().includes("private");
        
        tracksItemsContainer.innerHTML = `
            <div class="empty-tracks-view" style="padding: 40px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;">
                <div style="font-size: 2.2rem; line-height: 1;">${isCookieError ? '🍪' : '⚠️'}</div>
                <h4 style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin: 0;">${isCookieError ? 'Private Playlist Cookies Required' : 'Unable to Fetch Playlist Tracks'}</h4>
                <p style="color: var(--text-muted); max-width: 480px; margin: 0; font-size: 0.88rem; line-height: 1.5;">${escapeHtml(errorMsg)}</p>
                ${isCookieError ? `
                    <button id="go-to-cookies-btn" class="btn btn-primary btn-sm" style="margin-top: 6px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        Go to Settings & Upload Cookies
                    </button>
                ` : ''}
            </div>
        `;
        
        document.getElementById("go-to-cookies-btn")?.addEventListener("click", () => {
            switchTab("tab-settings");
        });
    } finally {
        tracksLoadingSpinner.style.display = "none";
    }
}

function updateSelectedCount() {
    if (!tracksSelectedCount) return;
    const checkboxes = tracksItemsContainer.querySelectorAll(".track-check");
    const total = checkboxes.length;
    const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
    tracksSelectedCount.textContent = `Selected: ${checked} / ${total}`;
}

// Render Tracks Items inside details card
function renderTracksList(tracks) {
    if (tracks.length === 0) {
        tracksItemsContainer.innerHTML = `<div class="empty-tracks-view"><p>This playlist source has no songs, or it hasn't been fetched yet. Click "Refresh List" above.</p></div>`;
        if (tracksSelectedCount) tracksSelectedCount.textContent = "Selected: 0 / 0";
        return;
    }
    
    tracksItemsContainer.innerHTML = "";
    tracks.forEach(t => {
        const row = document.createElement("div");
        row.className = "track-item-row";
        
        const checkedAttr = t.enabled ? "checked" : "";
        const statusBadge = t.downloaded 
            ? `<span class="badge badge-success">Downloaded</span>` 
            : `<span class="badge badge-idle">Queued</span>`;
            
        row.innerHTML = `
            <div class="track-checkbox-wrapper">
                <input type="checkbox" class="track-check" data-id="${t.id}" ${checkedAttr}>
            </div>
            <div class="track-info-cell">
                <div class="track-title">${escapeHtml(t.title)}</div>
                <div class="track-artist">${escapeHtml(t.artist || 'Unknown Artist')} ${t.duration ? '• ' + formatDuration(t.duration) : ''}</div>
            </div>
            <div class="track-status-cell" style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                ${statusBadge}
                <div class="track-action-buttons">
                    ${t.downloaded 
                        ? `<button class="btn btn-primary btn-sm play-track-btn" style="padding: 0; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; min-width: 0;" title="Play Song">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                           </button>` 
                        : `<button class="btn btn-secondary btn-sm download-track-btn" style="padding: 0; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; min-width: 0;" title="Download Immediately">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                           </button>`
                    }
                </div>
            </div>
        `;

        // Action button listeners
        if (t.downloaded) {
            row.querySelector(".play-track-btn").addEventListener("click", () => {
                const downloadedTracks = tracks.filter(tr => tr.downloaded);
                playTrack(t, downloadedTracks);
            });
        } else {
            const dlBtn = row.querySelector(".download-track-btn");
            dlBtn.addEventListener("click", async () => {
                dlBtn.disabled = true;
                dlBtn.innerHTML = `<span class="spinner" style="width: 12px; height: 12px; border-width: 2px; border-top-color: var(--primary);"></span>`;
                try {
                    const res = await fetch("/api/playlist/tracks/download-single", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: activeProfile,
                            source_id: activePlaylistSourceId,
                            track_id: t.id
                        })
                    });
                    if (res.ok) {
                        await loadPlaylistTracks(activePlaylistSourceId);
                        loadFiles();
                        refreshStatus();
                    } else {
                        const err = await res.json().catch(() => ({}));
                        alert("Failed to download: " + (err.detail || "Unknown backend error."));
                        dlBtn.disabled = false;
                        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
                    }
                } catch (e) {
                    alert("Error downloading: " + e.message);
                    dlBtn.disabled = false;
                    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
                }
            });
        }
        
        // Listen to checkbox toggling
        const checkbox = row.querySelector(".track-check");
        checkbox.addEventListener("change", async () => {
            t.enabled = checkbox.checked;
            try {
                await fetch("/api/playlist/tracks/toggle", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: activeProfile,
                        source_id: activePlaylistSourceId,
                        track_id: t.id,
                        enabled: checkbox.checked
                    })
                });
                
                // Update active local config structure
                const src = activeConfig.sources.find(s => s.id === activePlaylistSourceId);
                if (src) {
                    if (!src.disabled_track_ids) src.disabled_track_ids = [];
                    if (checkbox.checked) {
                        src.disabled_track_ids = src.disabled_track_ids.filter(id => id !== t.id);
                    } else {
                        if (!src.disabled_track_ids.includes(t.id)) {
                            src.disabled_track_ids.push(t.id);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to toggle track", e);
            }
            updateSelectedCount();
        });
        
        tracksItemsContainer.appendChild(row);
    });
    updateSelectedCount();
}

// Track filtering
tracksSearchInput.addEventListener("input", () => {
    const q = tracksSearchInput.value.toLowerCase().trim();
    if (!q) {
        renderTracksList(currentTracks);
        return;
    }
    const filtered = currentTracks.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q)
    );
    renderTracksList(filtered);
});

// Refresh button trigger
refreshPlaylistBtn.addEventListener("click", () => {
    if (activePlaylistSourceId) {
        loadPlaylistTracks(activePlaylistSourceId, true);
    }
});

// Select / Deselect All Tracks
async function setAllTracksState(enabled) {
    if (!activePlaylistSourceId) return;
    
    // Toggle checkboxes visually
    document.querySelectorAll(".track-check").forEach(cb => cb.checked = enabled);
    
    // Update local state
    currentTracks.forEach(t => t.enabled = enabled);
    updateSelectedCount();
    
    try {
        await fetch("/api/playlist/tracks/toggle-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: activeProfile,
                source_id: activePlaylistSourceId,
                enabled: enabled
            })
        });
        
        // Sync local activeConfig
        const src = activeConfig.sources.find(s => s.id === activePlaylistSourceId);
        if (src) {
            if (enabled) {
                src.disabled_track_ids = [];
            } else {
                src.disabled_track_ids = currentTracks.map(t => t.id);
            }
        }
    } catch (e) {
        console.error("Failed to toggle all tracks", e);
    }
}

selectAllTracksBtn.addEventListener("click", () => setAllTracksState(true));
deselectAllTracksBtn.addEventListener("click", () => setAllTracksState(false));

// Delete Playlist Source
deleteSourceBtn.addEventListener("click", async () => {
    if (!activePlaylistSourceId) return;
    if (!confirm("Are you sure you want to delete this playlist source? Selected tracks will be removed from config.")) return;
    
    activeConfig.sources = activeConfig.sources.filter(s => s.id !== activePlaylistSourceId);
    
    try {
        // Save configuration
        const res = await fetch(`/api/config?username=${activeProfile}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeConfig)
        });
        if (res.ok) {
            renderSourcesList();
            noPlaylistSelectedView.style.display = "flex";
            playlistActiveView.style.display = "none";
            activePlaylistSourceId = "";
        }
    } catch (e) {
        console.error("Failed to delete source", e);
    }
});

// Auto Save Configuration Helper
let autoSaveTimeout = null;

async function autoSaveConfig() {
    if (!activeProfile || !activeConfig) return;
    
    activeConfig.download_dir = settingDownloadDir ? settingDownloadDir.value.trim() : (activeConfig.download_dir || "");
    activeConfig.filename_template = settingFilenamePreset ? settingFilenamePreset.value : (activeConfig.filename_template || "%(title)s.%(ext)s");
    activeConfig.embed_metadata = settingEmbedMetadata ? settingEmbedMetadata.checked : true;
    activeConfig.max_concurrent_downloads = settingMaxConcurrent ? parseInt(settingMaxConcurrent.value) : 3;
    
    if (settingSeekbarStyle) activeConfig.seekbar_style = settingSeekbarStyle.value;
    if (settingEqPreset) activeConfig.eq_preset = settingEqPreset.value;
    
    const autoLaunchInput = document.getElementById("setting-autoplay-launch");
    if (autoLaunchInput) activeConfig.autoplay_launch = autoLaunchInput.checked;

    const autoDownloadLikedInput = document.getElementById("setting-auto-download-liked");
    if (autoDownloadLikedInput) activeConfig.auto_download_liked = autoDownloadLikedInput.checked;
    
    const autoSync = settingAutoSync ? settingAutoSync.checked : false;
    activeConfig.auto_sync = autoSync;
    
    if (autoSync) {
        const mode = settingSyncMode ? settingSyncMode.value : "time";
        activeConfig.schedule_mode = mode;
        if (mode === "interval") {
            activeConfig.sync_interval_hours = settingSyncInterval ? parseInt(settingSyncInterval.value) : 24;
            activeConfig.sync_time = "";
        } else {
            activeConfig.sync_interval_hours = 24;
            activeConfig.sync_time = settingSyncTime ? settingSyncTime.value : "02:00";
        }
    } else {
        activeConfig.schedule_mode = "";
        activeConfig.sync_interval_hours = 0;
        activeConfig.sync_time = "";
    }
    
    // Auto save status pill indicator
    const indicator = document.getElementById("auto-save-indicator");
    if (indicator) {
        indicator.style.opacity = "1";
        setTimeout(() => { indicator.style.opacity = "0"; }, 2500);
    }
    
    try {
        await fetch(`/api/config?username=${activeProfile}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeConfig)
        });
    } catch (e) {
        console.error("Auto-save error:", e);
    }
}

function triggerDebouncedAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        autoSaveConfig();
    }, 400);
}

// Attach Auto-Save Event Listeners to all Settings inputs
if (settingAutoSync) settingAutoSync.addEventListener("change", () => autoSaveConfig());
if (settingSyncMode) settingSyncMode.addEventListener("change", () => autoSaveConfig());
if (settingSyncTime) settingSyncTime.addEventListener("change", () => autoSaveConfig());
if (settingSyncInterval) settingSyncInterval.addEventListener("input", triggerDebouncedAutoSave);
if (settingDownloadDir) settingDownloadDir.addEventListener("input", triggerDebouncedAutoSave);
if (settingFilenamePreset) settingFilenamePreset.addEventListener("change", () => autoSaveConfig());
if (settingEmbedMetadata) settingEmbedMetadata.addEventListener("change", () => autoSaveConfig());
if (settingMaxConcurrent) settingMaxConcurrent.addEventListener("input", triggerDebouncedAutoSave);
if (settingSeekbarStyle) settingSeekbarStyle.addEventListener("change", () => autoSaveConfig());
if (settingEqPreset) settingEqPreset.addEventListener("change", () => autoSaveConfig());

const autoLaunchInput = document.getElementById("setting-autoplay-launch");
if (autoLaunchInput) autoLaunchInput.addEventListener("change", () => autoSaveConfig());

const autoDownloadLikedInput = document.getElementById("setting-auto-download-liked");
if (autoDownloadLikedInput) autoDownloadLikedInput.addEventListener("change", () => autoSaveConfig());

// Manual Sync Triggers (SSE Logs)
const syncQuotes = [
    '"Without music, life would be a mistake." – Friedrich Nietzsche',
    '"Music washes away from the soul the dust of everyday life." – Berthold Auerbach',
    '"Where words fail, music speaks." – Hans Christian Andersen',
    '"One good thing about music, when it hits you, you feel no pain." – Bob Marley',
    '"Music is the shorthand of emotion." – Leo Tolstoy',
    '"Tip: Paste cookie contents in Settings to download private Liked Songs!"',
    '"Tip: You can download songs immediately in Playlists using inline download buttons!"',
    '"Tip: Enable the Background Scheduler in Settings to sync music every day!"',
    '"Tip: Groupings under the Discover tab are parsed dynamically from audio tags!"',
    '"Tip: The Spotify-style media player stays active across all navigation screens!"'
];

syncModalClose.addEventListener("click", () => {
    syncProgressModal.style.display = "none";
});

if (viewSyncModalBtn) {
    viewSyncModalBtn.addEventListener("click", () => {
        syncProgressModal.style.display = "flex";
    });
}

if (syncPauseBtn) {
    syncPauseBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        try {
            const res = await fetch(`/api/sync/pause?username=${activeProfile}`, { method: "POST" });
            const data = await res.json();
            if (data.paused) {
                if (syncPauseText) syncPauseText.textContent = "Resume";
                if (syncPauseIcon) syncPauseIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
                showToast("Sync paused.", "info");
                appendTerminalLine("[System] Sync paused by user.");
            } else {
                if (syncPauseText) syncPauseText.textContent = "Pause";
                if (syncPauseIcon) syncPauseIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
                showToast("Sync resumed.", "info");
                appendTerminalLine("[System] Sync resumed.");
            }
        } catch (e) {
            console.error("Pause sync error:", e);
        }
    });
}

if (syncStopBtn) {
    syncStopBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        try {
            await fetch(`/api/sync/stop?username=${activeProfile}`, { method: "POST" });
            showToast("Stopping sync...", "warning");
            appendTerminalLine("[System] Stop signal sent to sync worker.");
            if (syncPauseText) syncPauseText.textContent = "Pause";
            if (syncPauseIcon) syncPauseIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
        } catch (e) {
            console.error("Stop sync error:", e);
        }
    });
}

// Manual Sync Triggers (SSE Logs)
syncNowBtn.addEventListener("click", () => {
    if (!activeProfile) return;
    
    if (eventSource) {
        try { eventSource.close(); } catch(e) {}
        eventSource = null;
    }
    
    if (terminalBody) terminalBody.innerHTML = '<div class="system-line" style="display: block; color: #818cf8; font-weight: 600; margin-bottom: 3px;">[System] Triggering synchronization...</div>';
    if (syncBadge) {
        syncBadge.className = "badge badge-syncing";
        syncBadge.textContent = "Syncing";
    }
    if (syncNowBtn) syncNowBtn.disabled = true;
    
    // Reset and show modal
    let totalTracks = 0;
    let processedTracks = 0;
    const syncStartTime = Date.now();
    let syncTimer = null;
    let quoteTimer = null;
    
    if (syncProgressModal) syncProgressModal.style.display = "flex";
    if (syncModalClose) syncModalClose.style.display = "none";
    if (syncModalTitle) syncModalTitle.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; border-top-color: var(--primary); margin: 0;"></span> Syncing Library...';
    if (syncCurrentSong) syncCurrentSong.textContent = "Scanning local library...";

    // Ensure all stats/meters are visible during manual sync trigger
    const syncQuoteBox = document.getElementById("sync-quote-box");
    const syncCurrentSongWrapper = document.getElementById("sync-current-song-wrapper");
    const syncProgressBarWrapper = document.getElementById("sync-progress-bar-wrapper");
    const syncStatsWrapper = document.getElementById("sync-stats-wrapper");
    const syncTimersWrapper = document.getElementById("sync-timers-wrapper");

    if (syncQuoteBox) syncQuoteBox.style.display = "none";
    if (syncCurrentSongWrapper) syncCurrentSongWrapper.style.display = "none";
    if (syncProgressBarWrapper) syncProgressBarWrapper.style.display = "flex";
    if (syncStatsWrapper) syncStatsWrapper.style.display = "grid";
    if (syncTimersWrapper) syncTimersWrapper.style.display = "none";
    if (syncControlsWrapper) syncControlsWrapper.style.display = "flex";

    // Expand the logs console so lines stream in
    if (terminalBody) terminalBody.style.display = "flex";
    if (logsToggleArrow) logsToggleArrow.style.transform = "rotate(180deg)";
    if (syncModalProgress) syncModalProgress.style.width = "0%";
    if (syncProcessedCount) syncProcessedCount.textContent = "0 / 0 Songs";
    if (syncPercentText) syncPercentText.textContent = "0%";
    const syncProgressStatusText = document.getElementById("sync-progress-status-text");
    if (syncProgressStatusText) syncProgressStatusText.textContent = "Scanning local library...";
    if (syncElapsedTime) syncElapsedTime.textContent = "0:00";
    if (syncEtaTime) syncEtaTime.textContent = "--:--";

    // Elapsed and ETA Timer
    function formatTimer(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    syncTimer = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - syncStartTime) / 1000);
        if (syncElapsedTime) syncElapsedTime.textContent = formatTimer(elapsedSec);
        
        if (processedTracks > 0 && processedTracks < totalTracks) {
            const avgTime = elapsedSec / processedTracks;
            const rem = totalTracks - processedTracks;
            if (syncEtaTime) syncEtaTime.textContent = formatTimer(Math.floor(avgTime * rem));
        } else if (processedTracks >= totalTracks && totalTracks > 0) {
            if (syncEtaTime) syncEtaTime.textContent = "0:00";
        } else {
            if (syncEtaTime) syncEtaTime.textContent = "--:--";
        }
    }, 1000);
    
    function endSyncModal(titleText) {
        if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
        if (quoteTimer) { clearInterval(quoteTimer); quoteTimer = null; }
        if (syncModalTitle) syncModalTitle.innerHTML = titleText;
        if (syncModalClose) syncModalClose.style.display = "none";
        if (syncNowBtn) syncNowBtn.disabled = false;
        if (syncBadge) {
            syncBadge.className = "badge badge-idle";
            syncBadge.textContent = "Idle";
        }
        if (syncControlsWrapper) syncControlsWrapper.style.display = "none";
    }
    
    // Connect to Server Sent Events
    if (eventSource) {
        try { eventSource.close(); } catch(e) {}
        eventSource = null;
    }
    
    eventSource = new EventSource(`/api/sync/run?username=${activeProfile}`);
    
    eventSource.onmessage = (event) => {
        const line = event.data;
        
        if (line === "SYNC_COMPLETE") {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            appendTerminalLine("[System] Sync Complete!");
            refreshStatus();
            loadFiles();
            endSyncModal("Sync Complete!");
            
            // Reload tracks to show downloaded badge
            if (activePlaylistSourceId) {
                loadPlaylistTracks(activePlaylistSourceId, false);
            }
            return;
        }
        
        // Parse sync metrics
        if (line.includes("Total checked unique target tracks: ")) {
            const val = parseInt(line.split("Total checked unique target tracks: ")[1]) || 0;
            const el = document.getElementById("sync-metric-total");
            if (el) el.textContent = val;
        } else if (line.includes("Tracks already downloaded: ")) {
            const val = parseInt(line.split("Tracks already downloaded: ")[1]) || 0;
            const el = document.getElementById("sync-metric-synced");
            if (el) el.textContent = val;
        } else if (line.includes("New tracks to download: ")) {
            totalTracks = parseInt(line.split("New tracks to download: ")[1]) || 0;
            processedTracks = 0;
            const el = document.getElementById("sync-metric-todownload");
            if (el) el.textContent = totalTracks;
            const elDl = document.getElementById("sync-metric-downloaded");
            if (elDl) elDl.textContent = `0 / ${totalTracks}`;
            const badge = document.getElementById("to-download-count");
            if (badge) badge.textContent = totalTracks;
            if (syncModalProgress) syncModalProgress.style.width = "0%";
            if (syncPercentText) syncPercentText.textContent = "0%";
            if (syncProgressStatusText) syncProgressStatusText.textContent = `Downloading ${totalTracks} new tracks...`;
        } else if (line.includes("All songs are up-to-date!")) {
            if (syncProgressStatusText) syncProgressStatusText.textContent = "All songs are up-to-date!";
            if (syncModalProgress) syncModalProgress.style.width = "100%";
            if (syncPercentText) syncPercentText.textContent = "100%";
            const elDl = document.getElementById("sync-metric-downloaded");
            if (elDl) elDl.textContent = "Up to date";
            if (syncEtaTime) syncEtaTime.textContent = "0:00";
        } else if (line.includes("Starting download: ")) {
            const parts = line.split("Starting download: ");
            if (parts.length > 1 && syncProgressStatusText) {
                syncProgressStatusText.textContent = `Downloading: ${cleanMediaExtension(parts[1])}`;
            }
        } else if (line.includes("SUCCESS: ") || line.includes("FAILED: ")) {
            processedTracks++;
            const elDl = document.getElementById("sync-metric-downloaded");
            if (elDl) elDl.textContent = `${processedTracks} / ${totalTracks}`;
            if (totalTracks > 0) {
                const pct = Math.min(100, Math.round((processedTracks / totalTracks) * 100));
                if (syncModalProgress) syncModalProgress.style.width = `${pct}%`;
                if (syncPercentText) syncPercentText.textContent = `${pct}%`;
                if (syncProgressStatusText) syncProgressStatusText.textContent = `Downloaded ${processedTracks} of ${totalTracks} tracks (${pct}%)`;
            }
            // Auto refresh downloaded files periodically as songs complete
            loadFiles();
        } else if (line === "SYNC_FINISHED_SUCCESS") {
            // Close EventSource immediately to prevent auto-reconnect before server closes stream
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            endSyncModal("Sync Successful!");
        } else if (line === "SYNC_FINISHED_FAILED") {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            endSyncModal("<span style='color: var(--danger)'>Sync Completed with Errors</span>");
        }
        
        appendTerminalLine(line);
    };
    
    eventSource.onerror = (e) => {
        console.error("SSE stream error", e);
        if (eventSource) {
            try { eventSource.close(); } catch(err) {}
            eventSource = null;
        }
        if (syncNowBtn) syncNowBtn.disabled = false;
        if (syncBadge) {
            syncBadge.className = "badge badge-idle";
            syncBadge.textContent = "Idle";
        }
        if (syncControlsWrapper) syncControlsWrapper.style.display = "none";
        appendTerminalLine("[System] Sync connection completed or reset.");
        refreshStatus();
        loadFiles();
    };
});

function appendTerminalLine(text) {
    if (!terminalBody || !text) return;
    const div = document.createElement("div");
    div.style.display = "block";
    div.style.marginBottom = "3px";
    div.style.wordBreak = "break-word";
    
    // Classify line styling
    if (text.includes("SUCCESS") || text.includes("successfully") || text.includes("Complete")) {
        div.className = "success-line";
        div.style.color = "#34d399";
        div.style.fontWeight = "500";
    } else if (text.includes("ERROR") || text.includes("FAILED")) {
        div.className = "error-line";
        div.style.color = "#f87171";
        div.style.fontWeight = "500";
    } else if (text.includes("Warning") || text.includes("Retry") || text.includes("Retrying")) {
        div.className = "warning-line";
        div.style.color = "#fbbf24";
    } else if (text.startsWith("===") || text.startsWith("---") || text.includes("[System]")) {
        div.className = "system-line";
        div.style.color = "#818cf8";
        div.style.fontWeight = "600";
    } else {
        div.className = "info-line";
        div.style.color = "#e4e4e7";
    }
    
    div.textContent = text;
    terminalBody.appendChild(div);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

clearLogsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    terminalBody.innerHTML = '<span class="system-line">[System] Logs cleared.</span>';
});

copyLogsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const text = terminalBody.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Logs copied to clipboard successfully.", "success");
    }).catch(e => {
        showToast("Failed to copy logs: " + e.message, "error");
    });
});

let terminalPlaceholder = null;
if (maximizeLogsBtn) {
    maximizeLogsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isMax = terminalCard.classList.toggle("terminal-maximized");
        if (isMax) {
            maximizeLogsBtn.title = "Restore Logs";
            maximizeLogsIcon.innerHTML = `<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>`;
            // Force terminal body to be visible when maximized
            if (terminalBody) {
                terminalBody.style.display = "flex";
            }
            if (logsToggleArrow) {
                logsToggleArrow.style.transform = "rotate(180deg)";
            }
            
            // Detach and append to body to bypass parent spec limits (backdrop-filter container)
            terminalPlaceholder = document.createElement("div");
            terminalPlaceholder.style.display = "none";
            terminalCard.parentNode.insertBefore(terminalPlaceholder, terminalCard);
            document.body.appendChild(terminalCard);
        } else {
            maximizeLogsBtn.title = "Maximize Logs";
            maximizeLogsIcon.innerHTML = `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>`;
            
            // Restore back to its original parent spot
            if (terminalPlaceholder && terminalPlaceholder.parentNode) {
                terminalPlaceholder.parentNode.insertBefore(terminalCard, terminalPlaceholder);
                terminalPlaceholder.remove();
                terminalPlaceholder = null;
            }
        }
    });
}

// Profile Dropdown change
profileSelect.addEventListener("change", () => {
    handleProfileChange(profileSelect.value);
});

// Sidebar tabs toggling
function switchTab(tabId) {
    if (!tabId) return;
    // Restore maximized terminal if active
    if (terminalCard && terminalCard.classList.contains("terminal-maximized") && maximizeLogsBtn) {
        maximizeLogsBtn.click();
    }
    // Nav highlight
    navItems.forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    // Pane toggle
    tabPanes.forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add("active-pane");
        } else {
            pane.classList.remove("active-pane");
        }
    });

    if (activeProfile) {
        localStorage.setItem(`musicgrabber_active_tab_${activeProfile}`, tabId);
    }
    localStorage.setItem("musicgrabber_active_tab", tabId);
}

navItems.forEach(item => {
    item.addEventListener("click", () => {
        if (!activeProfile) {
            alert("Please select or create a profile first.");
            return;
        }
        const tabId = item.getAttribute("data-tab");
        switchTab(tabId);
        if (tabId === "tab-discover") {
            loadYtMusicDiscoverData();
        } else if (tabId === "tab-library") {
            loadDiscoverData();
        }
    });
});

// Range slider label updating
settingMaxConcurrent.addEventListener("input", () => {
    rangeValueDisplay.textContent = settingMaxConcurrent.value;
});

// Auto-sync toggles scheduler options
settingAutoSync.addEventListener("change", () => {
    schedulerOptions.style.display = settingAutoSync.checked ? "block" : "none";
});

// Scheduler mode selector
settingSyncMode.addEventListener("change", () => {
    if (settingSyncMode.value === "time") {
        scheduleTimeField.style.display = "block";
        scheduleIntervalField.style.display = "none";
    } else {
        scheduleTimeField.style.display = "none";
        scheduleIntervalField.style.display = "block";
    }
});

// Modals Trigger Handlers
// Profile Creation
addProfileBtn.addEventListener("click", () => {
    profileModal.style.display = "flex";
    newProfileUsername.value = "";
    newProfileUsername.focus();
});

profileModalCancel.addEventListener("click", () => profileModal.style.display = "none");

profileModalSave.addEventListener("click", async () => {
    const val = newProfileUsername.value.trim();
    if (!val) return;
    
    try {
        const res = await fetch("/api/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: val })
        });
        
        if (res.ok) {
            profileModal.style.display = "none";
            await loadProfiles();
            // Select newly created profile
            const sel = getProfileSelect();
            if (sel) sel.value = val.toLowerCase();
            handleProfileChange(val.toLowerCase());
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (e) {
        alert("Failed to create profile: " + e.message);
    }
});

// Profile Deletion Modal Event Handlers
const deleteProfileBtn = document.getElementById("delete-profile-btn");
const deleteProfileModal = document.getElementById("delete-profile-modal");
const deleteProfileTargetName = document.getElementById("delete-profile-target-name");
const deleteProfileCancelBtn = document.getElementById("delete-profile-modal-cancel");
const deleteProfileConfirmBtn = document.getElementById("delete-profile-modal-confirm");

if (deleteProfileBtn) {
    deleteProfileBtn.addEventListener("click", () => {
        if (!activeProfile) {
            alert("Please select a profile to delete.");
            return;
        }
        if (deleteProfileTargetName) deleteProfileTargetName.textContent = activeProfile;
        if (deleteProfileModal) deleteProfileModal.style.display = "flex";
    });
}

if (deleteProfileCancelBtn) {
    deleteProfileCancelBtn.addEventListener("click", () => {
        if (deleteProfileModal) deleteProfileModal.style.display = "none";
    });
}

if (deleteProfileConfirmBtn) {
    deleteProfileConfirmBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        const targetToDelete = activeProfile;
        try {
            const res = await fetch(`/api/profiles/${encodeURIComponent(targetToDelete)}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (res.ok) {
                if (deleteProfileModal) deleteProfileModal.style.display = "none";
                showToast(`Profile "${targetToDelete}" deleted successfully.`, "success");
                try { localStorage.removeItem("musicgrabber_active_profile"); } catch (e) {}
                activeProfile = "";
                await loadProfiles();
            } else {
                alert(`Failed to delete profile: ${data.detail || "Error"}`);
            }
        } catch (e) {
            alert("Error deleting profile: " + e.message);
        }
    });
}

// YouTube Cookies File Event Listeners
if (triggerCookiesUploadBtn && settingCookiesFile) {
    triggerCookiesUploadBtn.addEventListener("click", () => {
        settingCookiesFile.click();
    });
}

if (settingCookiesFile) {
    settingCookiesFile.addEventListener("change", () => {
        if (settingCookiesFile.files && settingCookiesFile.files.length > 0) {
            const file = settingCookiesFile.files[0];
            if (selectedCookiesFilename) selectedCookiesFilename.textContent = file.name;
            if (uploadCookiesBtn) uploadCookiesBtn.style.display = "inline-block";
        } else {
            if (selectedCookiesFilename) selectedCookiesFilename.textContent = "No file selected";
            if (uploadCookiesBtn) uploadCookiesBtn.style.display = "none";
        }
    });
}

if (uploadCookiesBtn) {
    uploadCookiesBtn.addEventListener("click", async () => {
        if (!activeProfile || !settingCookiesFile.files || settingCookiesFile.files.length === 0) return;
        const file = settingCookiesFile.files[0];
        const formData = new FormData();
        formData.append("file", file);
        
        try {
            uploadCookiesBtn.disabled = true;
            uploadCookiesBtn.textContent = "Uploading...";
            const res = await fetch(`/api/cookies/upload?username=${activeProfile}`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showToast("YouTube authentication cookies uploaded successfully!", "success");
                await refreshCookiesStatus(activeProfile);
                await updateLikedTracksSet();
            } else {
                showToast("Failed to upload cookies: " + (data.detail || "Error"), "danger");
            }
        } catch (e) {
            showToast("Error uploading cookies: " + e.message, "danger");
        } finally {
            uploadCookiesBtn.disabled = false;
            uploadCookiesBtn.textContent = "Upload File";
        }
    });
}

if (deleteCookiesBtn) {
    deleteCookiesBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        try {
            const res = await fetch(`/api/cookies?username=${activeProfile}`, {
                method: "DELETE"
            });
            if (res.ok) {
                showToast("Cookies file deleted.", "info");
                await refreshCookiesStatus(activeProfile);
                await updateLikedTracksSet();
            }
        } catch (e) {
            console.error("Failed to delete cookies:", e);
        }
    });
}

// Add playlist source
newSourceBtn.addEventListener("click", () => {
    editingSourceId = "";
    sourceModalTitle.textContent = "Add Playlist Source";
    sourceModalSave.textContent = "Add Playlist";
    sourceModal.style.display = "flex";
    newSourceName.value = "";
    newSourceUrl.value = "";
    newSourcePath.value = "";
    newSourceName.focus();
});

// Helper: Get deterministic source ID for source matching
function getSourceId(src) {
    if (src && src.id) return src.id;
    const key = (src ? (src.url || src.path || src.name) : "") || "";
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash << 5) - hash + key.charCodeAt(i);
        hash |= 0;
    }
    return "src_" + Math.abs(hash);
}

// Edit playlist source
editSourceBtn.addEventListener("click", () => {
    let src = null;
    if (activePlaylistSourceId && activeConfig && activeConfig.sources) {
        src = activeConfig.sources.find(s => (s.id && s.id === activePlaylistSourceId) || getSourceId(s) === activePlaylistSourceId);
    }
    if (!src && activeConfig && activeConfig.sources) {
        const headerName = activeSourceName.textContent.trim();
        src = activeConfig.sources.find(s => s.name === headerName);
    }
    if (!src && activeConfig && activeConfig.sources && activeConfig.sources.length > 0) {
        src = activeConfig.sources[0];
    }
    if (!src) {
        showToast("No playlist source selected to edit.", "warning");
        return;
    }
    
    editingSourceId = src.id || getSourceId(src);
    sourceModalTitle.textContent = "Edit Playlist Source";
    sourceModalSave.textContent = "Save Changes";
    
    newSourceName.value = src.name || "";
    newSourceType.value = src.type || "youtube_music_playlist";
    newSourceUrl.value = src.url || "";
    newSourcePath.value = src.path || "";
    
    // Trigger type change display toggle
    newSourceType.dispatchEvent(new Event("change"));
    
    sourceModal.style.display = "flex";
    newSourceName.focus();
});

sourceModalCancel.addEventListener("click", () => sourceModal.style.display = "none");

// Toggle source form inputs based on source type selection
newSourceType.addEventListener("change", () => {
    if (newSourceType.value === "text_file") {
        sourceUrlGroup.style.display = "none";
        sourcePathGroup.style.display = "block";
    } else {
        sourceUrlGroup.style.display = "block";
        sourcePathGroup.style.display = "none";
    }
});

sourceModalSave.addEventListener("click", async () => {
    const name = newSourceName.value.trim();
    const type = newSourceType.value;
    const url = newSourceUrl.value.trim();
    const path = newSourcePath.value.trim();
    
    if (!name) {
        alert("Please enter a source name");
        return;
    }
    
    if (type !== "text_file" && !url) {
        alert("Please enter a playlist URL");
        return;
    }
    
    if (type === "text_file" && !path) {
        alert("Please enter a text file location path");
        return;
    }
    
    if (editingSourceId) {
        // Edit existing source - strictly find by ID or current reference
        let src = activeConfig.sources.find(s => s.id === editingSourceId);
        if (!src) {
            src = activeConfig.sources.find(s => getSourceId(s) === editingSourceId);
        }
        if (src) {
            src.name = name;
            src.type = type;
            src.url = type !== "text_file" ? url : "";
            src.path = type === "text_file" ? path : "";
            if (!src.id) src.id = editingSourceId;
        }
    } else {
        // Add new source with unique ID
        const newSource = {
            id: "src_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
            type: type,
            name: name,
            url: type !== "text_file" ? url : "",
            path: type === "text_file" ? path : "",
            disabled_track_ids: []
        };
        activeConfig.sources.push(newSource);
    }
    
    try {
        const res = await fetch(`/api/config?username=${activeProfile}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeConfig)
        });
        
        if (res.ok) {
            sourceModal.style.display = "none";
            // Reload config & sources menu
            await loadConfig(activeProfile);
            renderSourcesList();
            if (editingSourceId && editingSourceId === activePlaylistSourceId) {
                loadPlaylistTracks(activePlaylistSourceId, true);
            }
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (e) {
        alert("Failed to save playlist: " + e.message);
    }
});

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Trigger hidden file input click
triggerCookiesUploadBtn.addEventListener("click", () => {
    settingCookiesFile.click();
});

// File input selection change
settingCookiesFile.addEventListener("change", () => {
    const file = settingCookiesFile.files[0];
    if (file) {
        selectedCookiesFilename.textContent = file.name;
        uploadCookiesBtn.style.display = "inline-block";
    } else {
        selectedCookiesFilename.textContent = "No file selected";
        uploadCookiesBtn.style.display = "none";
    }
});

// Upload Cookies button click
uploadCookiesBtn.addEventListener("click", async () => {
    if (!activeProfile) return;
    const file = settingCookiesFile.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    uploadCookiesBtn.disabled = true;
    uploadCookiesBtn.textContent = "Uploading...";
    
    try {
        const res = await fetch(`/api/cookies/upload?username=${activeProfile}`, {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            alert("Cookies uploaded successfully.");
            await refreshCookiesStatus(activeProfile);
        } else {
            const err = await res.json();
            alert(`Upload failed: ${err.detail || "Unknown error"}`);
        }
    } catch (e) {
        alert(`Upload error: ${e.message}`);
    } finally {
        uploadCookiesBtn.disabled = false;
        uploadCookiesBtn.textContent = "Upload File";
    }
});

// Delete Cookies button click
deleteCookiesBtn.addEventListener("click", async () => {
    if (!activeProfile) return;
    if (!confirm("Are you sure you want to delete the uploaded cookies? Private playlists will no longer sync.")) return;
    
    deleteCookiesBtn.disabled = true;
    
    try {
        const res = await fetch(`/api/cookies?username=${activeProfile}`, {
            method: "DELETE"
        });
        
        if (res.ok) {
            alert("Cookies deleted successfully.");
            await refreshCookiesStatus(activeProfile);
        } else {
            const err = await res.json();
            alert(`Deletion failed: ${err.detail || "Unknown error"}`);
        }
    } catch (e) {
        alert(`Deletion error: ${e.message}`);
    } finally {
        deleteCookiesBtn.disabled = false;
    }
});

// Track which input is being populated by directory browser
let currentBrowsingTargetInput = null;

// Show Directory Browser
browseDirBtn.addEventListener("click", () => {
    currentBrowsingTargetInput = settingDownloadDir;
    const currentVal = settingDownloadDir.value.trim() || "/";
    fetchDirectory(currentVal);
    dirBrowserModal.style.display = "flex";
});

browseLibraryDirBtn.addEventListener("click", () => {
    currentBrowsingTargetInput = addLibraryDirInput;
    const currentVal = addLibraryDirInput.value.trim() || "/";
    fetchDirectory(currentVal);
    dirBrowserModal.style.display = "flex";
});

addLibraryDirBtn.addEventListener("click", () => {
    const path = addLibraryDirInput.value.trim();
    if (!path) return;
    
    if (!activeConfig.additional_library_dirs) {
        activeConfig.additional_library_dirs = [];
    }
    
    if (!activeConfig.additional_library_dirs.includes(path)) {
        activeConfig.additional_library_dirs.push(path);
        renderAdditionalLibraryDirs();
        addLibraryDirInput.value = "";
    } else {
        alert("Directory is already added.");
    }
});

// Cancel browsing
dirBrowserCancel.addEventListener("click", () => {
    dirBrowserModal.style.display = "none";
});

// Select folder
dirBrowserSelect.addEventListener("click", () => {
    if (currentBrowsingTargetInput) {
        currentBrowsingTargetInput.value = currentBrowserPath;
    }
    dirBrowserModal.style.display = "none";
});

// Save Settings Form Handler
let isSavingSettings = false;

async function saveSettings() {
    if (isSavingSettings || !activeProfile || !activeConfig) return;
    isSavingSettings = true;
    
    let dirVal = settingDownloadDir.value.trim();
    if (!dirVal) {
        dirVal = activeConfig.download_dir || `/app/users/${activeProfile}/downloads`;
    }
    activeConfig.download_dir = dirVal;
    settingDownloadDir.value = dirVal;
    
    activeConfig.filename_template = settingFilenamePreset.value;
    activeConfig.embed_metadata = settingEmbedMetadata.checked;
    activeConfig.max_concurrent_downloads = parseInt(settingMaxConcurrent.value) || 3;
    activeConfig.auto_sync = settingAutoSync.checked;
    activeConfig.sync_mode = settingSyncMode.value;
    activeConfig.sync_time = settingSyncTime.value;
    activeConfig.sync_interval_hours = parseInt(settingSyncInterval.value) || 24;
    
    // Save UI & Audio Customization settings to user profile config
    if (settingSeekbarStyle) {
        activeConfig.seekbar_style = settingSeekbarStyle.value;
        visualizerStyleMode = settingSeekbarStyle.value;
    }
    if (settingEqPreset) {
        activeConfig.eq_preset = settingEqPreset.value;
    }
    const autoLaunchInput = document.getElementById("setting-autoplay-launch");
    if (autoLaunchInput) {
        activeConfig.autoplay_launch = autoLaunchInput.checked;
    }
    
    try {
        const res = await fetch(`/api/config?username=${activeProfile}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeConfig)
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.config) {
                activeConfig = data.config;
                populateSettingsForm();
            }
            isSettingsDirty = false;
            showToast("Settings saved successfully.", "success");
            await refreshStatus();
        } else {
            const err = await res.json();
            showToast(`Error saving settings: ${err.detail}`, "error");
        }
    } catch (e) {
        showToast("Failed to save settings: " + e.message, "error");
    } finally {
        isSavingSettings = false;
    }
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", saveSettings);
}

// ==================== Spotify-style Player Logic ====================

function restoreSavedVolume() {
    try {
        const savedVol = localStorage.getItem("musicgrabber_volume");
        if (savedVol !== null && !isNaN(parseFloat(savedVol))) {
            const vol = Math.max(0, Math.min(1, parseFloat(savedVol)));
            localAudioElement.volume = vol;
            if (playerVolumeSlider) {
                playerVolumeSlider.value = Math.round(vol * 100);
            }
        }
    } catch (e) {}
}

function restoreLastPlayedTrack() {
    if (!activeProfile) return;
    restoreSavedVolume();
    try {
        const savedTrackStr = localStorage.getItem(`musicgrabber_last_track_${activeProfile}`);
        const savedQueueStr = localStorage.getItem(`musicgrabber_last_queue_${activeProfile}`);
        const savedIndexStr = localStorage.getItem(`musicgrabber_last_index_${activeProfile}`);
        const savedTimeStr = localStorage.getItem(`musicgrabber_seek_time_${activeProfile}`);
        
        if (savedTrackStr) {
            const track = JSON.parse(savedTrackStr);
            const queue = savedQueueStr ? JSON.parse(savedQueueStr) : [track];
            const index = savedIndexStr !== null ? parseInt(savedIndexStr, 10) : 0;
            const targetSeek = savedTimeStr !== null ? parseFloat(savedTimeStr) : 0;
            
            const filename = track.local_filename || track.filename;
            if (filename) {
                currentPlayingTrack = track;
                playerQueue = queue;
                currentQueueIndex = index >= 0 && index < queue.length ? index : 0;
                
                localAudioElement.src = `/api/stream?username=${activeProfile}&filename=${encodeURIComponent(filename)}`;
                localAudioElement.load();
                
                if (targetSeek > 0) {
                    const onMeta = () => {
                        if (localAudioElement.duration && targetSeek < localAudioElement.duration) {
                            localAudioElement.currentTime = targetSeek;
                            playerProgressSlider.value = (targetSeek / localAudioElement.duration) * 100;
                            playerCurrentTime.textContent = formatDuration(targetSeek);
                        }
                        localAudioElement.removeEventListener("loadedmetadata", onMeta);
                    };
                    localAudioElement.addEventListener("loadedmetadata", onMeta);
                }
                
                musicPlayerBar.style.display = "flex";
                updatePlaybackUI();
            }
        }
    } catch (e) {
        console.error("Failed to restore last played track:", e);
    }
}

function playTrack(track, queue = [], index = -1) {
    if (!track) return;
    
    if (queue && queue.length > 0) {
        if (!isShuffleActive) {
            unshuffledQueue = [...queue];
            playerQueue = [...queue];
        } else {
            if (unshuffledQueue.length === 0) unshuffledQueue = [...queue];
            playerQueue = queue;
        }
    } else if (!playerQueue || playerQueue.length === 0) {
        playerQueue = [track];
        unshuffledQueue = [track];
    }
    
    if (index >= 0) {
        currentQueueIndex = index;
    } else {
        const foundIdx = playerQueue.findIndex(t => 
            (t.local_filename && track.local_filename && t.local_filename === track.local_filename) ||
            (t.filename && track.filename && t.filename === track.filename) ||
            (t.path && track.path && t.path === track.path) ||
            (t.title && track.title && t.title === track.title)
        );
        currentQueueIndex = foundIdx >= 0 ? foundIdx : 0;
    }
    
    currentPlayingTrack = track;
    
    // Save last played track and queue in localStorage for instant resume
    try {
        if (activeProfile) {
            localStorage.setItem(`musicgrabber_last_track_${activeProfile}`, JSON.stringify(track));
            localStorage.setItem(`musicgrabber_last_queue_${activeProfile}`, JSON.stringify(playerQueue));
            localStorage.setItem(`musicgrabber_last_index_${activeProfile}`, currentQueueIndex);
            localStorage.setItem(`musicgrabber_seek_time_${activeProfile}`, 0);
        }
    } catch (e) {}
    
    const localFile = getLocalFilename(track);
    const isLocal = isLocalTrack(track) || Boolean(localFile);
    currentPlayingTrack.is_local = isLocal;

    if (isLocal && localFile) {
        localAudioElement.src = `/api/stream?username=${activeProfile}&filename=${encodeURIComponent(localFile)}`;
    } else if (track.url) {
        localAudioElement.src = `/api/ytmusic/stream?username=${activeProfile}&url=${encodeURIComponent(track.url)}`;
    } else if (localFile) {
        localAudioElement.src = `/api/stream?username=${activeProfile}&filename=${encodeURIComponent(localFile)}`;
    } else {
        showToast("Cannot play track: No local file or stream URL available.", "danger");
        return;
    }
    
    // Initialize seeker visualizer nodes
    initVisualizer();
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    // Fetch track rating asynchronously for active song
    if (activeProfile && track) {
        let vId = track.id || "";
        const trackUrl = track.url || "";
        if (!vId && trackUrl) {
            const match = trackUrl.match(/(?:v=|\/vi\/|\/watch\?v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
            if (match) vId = match[1];
        }
        if (vId || trackUrl) {
            fetch(`/api/ytmusic/track-rating?username=${activeProfile}&video_id=${encodeURIComponent(vId)}&url=${encodeURIComponent(trackUrl)}`)
                .then(r => r.json())
                .then(data => {
                    if (data.rating && currentPlayingTrack === track) {
                        currentPlayingTrack.user_rating = data.rating;
                        updatePlaybackUI();
                    }
                })
                .catch(e => console.error("Failed to fetch track rating", e));
        }
    }

    localAudioElement.play().then(() => {
        musicPlayerBar.style.display = "flex";
        updatePlaybackUI();
    }).catch(e => {
        console.error("Audio playback error:", e);
        showToast("Playback error: Failed to play audio stream.", "danger");
    });
}

function highlightActivePlayingRows() {
    if (!currentPlayingTrack) return;
    
    const curTitle = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.display_name || currentPlayingTrack.filename || "").toLowerCase();
    const curUrl = currentPlayingTrack.url || "";
    const curPath = currentPlayingTrack.path || "";
    const curFilename = (currentPlayingTrack.local_filename || currentPlayingTrack.filename || "").toLowerCase();

    function isMatch(title, url, path, filename) {
        if (curUrl && url && curUrl === url) return true;
        if (curPath && path && curPath === path) return true;
        
        if (filename && curFilename && cleanMediaExtension(filename).toLowerCase() === cleanMediaExtension(curFilename).toLowerCase()) {
            return true;
        }
        
        if (title && curTitle) {
            const cleanT = cleanMediaExtension(title).toLowerCase();
            if (cleanT === curTitle || cleanT.includes(curTitle) || curTitle.includes(cleanT)) {
                return true;
            }
        }
        return false;
    }

    // 1. Discover Tab Playlists Table (#ytmusic-songs-table-body)
    const ytSongsBody = document.getElementById("ytmusic-songs-table-body");
    if (ytSongsBody) {
        Array.from(ytSongsBody.querySelectorAll("tr")).forEach(tr => {
            const rowTitle = tr.dataset.title || "";
            const rowUrl = tr.dataset.url || "";
            if (isMatch(rowTitle, rowUrl)) {
                tr.classList.add("playing-row");
                const playBtn = tr.querySelector(".play-yt-song-btn");
                if (playBtn) {
                    playBtn.title = "Currently Playing";
                    playBtn.style.background = "var(--primary)";
                    playBtn.style.color = "#ffffff";
                }
            } else {
                tr.classList.remove("playing-row");
                const playBtn = tr.querySelector(".play-yt-song-btn");
                if (playBtn) {
                    playBtn.title = "Play Song";
                    playBtn.style.background = "rgba(99, 102, 241, 0.15)";
                    playBtn.style.color = "var(--primary)";
                }
            }
        });
    }

    // 2. Discover / Local Library Songs Table (#discover-songs-table-body)
    const libSongsBody = document.getElementById("discover-songs-table-body");
    if (libSongsBody) {
        Array.from(libSongsBody.querySelectorAll("tr.discover-song-row")).forEach(tr => {
            const rowTitle = tr.dataset.title || "";
            const rowPath = tr.dataset.path || "";
            const rowFilename = tr.dataset.filename || "";
            if (isMatch(rowTitle, "", rowPath, rowFilename)) {
                tr.classList.add("playing-row");
                const rowIdx = tr.querySelector(".row-index");
                const rowIcon = tr.querySelector(".row-play-icon");
                if (rowIdx) rowIdx.style.display = "none";
                if (rowIcon) rowIcon.style.display = "inline-block";
            } else {
                tr.classList.remove("playing-row");
                const rowIdx = tr.querySelector(".row-index");
                const rowIcon = tr.querySelector(".row-play-icon");
                if (rowIdx) rowIdx.style.display = "inline-block";
                if (rowIcon) rowIcon.style.display = "none";
            }
        });
    }

    // 3. Playlists Tab Tracks Table (#playlist-tracks-body)
    const plTracksBody = document.getElementById("playlist-tracks-body");
    if (plTracksBody) {
        Array.from(plTracksBody.querySelectorAll("tr")).forEach(tr => {
            const rowTitle = tr.dataset.title || "";
            const rowUrl = tr.dataset.url || "";
            if (isMatch(rowTitle, rowUrl)) {
                tr.classList.add("playing-row");
            } else {
                tr.classList.remove("playing-row");
            }
        });
    }

    // 4. Downloaded Files List (#files-list-body)
    const filesBody = document.getElementById("files-list-body");
    if (filesBody) {
        Array.from(filesBody.querySelectorAll("tr")).forEach(tr => {
            const rowName = tr.dataset.filename || tr.dataset.name || "";
            if (isMatch(rowName, "", "", rowName)) {
                tr.classList.add("playing-row");
            } else {
                tr.classList.remove("playing-row");
            }
        });
    }

    // 5. Drawer Modals & Expander Lists (.discover-modal-song-row)
    document.querySelectorAll(".discover-modal-song-row, .inline-expander-song-row").forEach(row => {
        const rowTitle = row.dataset.title || "";
        const rowUrl = row.dataset.url || "";
        const rowPath = row.dataset.path || "";
        if (isMatch(rowTitle, rowUrl, rowPath)) {
            row.classList.add("playing-row");
        } else {
            row.classList.remove("playing-row");
        }
    });
}

async function rateCurrentTrack(newRating) {
    if (!currentPlayingTrack || !activeProfile) return;
    
    const likeBtn = document.getElementById("player-like-btn");
    const dislikeBtn = document.getElementById("player-dislike-btn");
    
    const trackTitle = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.display_name || currentPlayingTrack.filename || "Unknown Track");
    const trackArtist = currentPlayingTrack.artist || "YouTube Artist";
    const trackUrl = currentPlayingTrack.url || "";
    
    let videoId = extractVideoId(currentPlayingTrack);
    
    if (!videoId && !trackUrl) {
        showToast("Cannot rate local files that have no YouTube reference", "warning");
        return;
    }
    
    currentPlayingTrack.user_rating = newRating;
    if (likeBtn) {
        if (newRating === "LIKE") likeBtn.classList.add("liked");
        else likeBtn.classList.remove("liked");
    }
    if (dislikeBtn) {
        if (newRating === "DISLIKE") dislikeBtn.classList.add("disliked");
        else dislikeBtn.classList.remove("disliked");
    }
    
    if (newRating === "LIKE") {
        showToast(`Liked "${trackTitle}" on YouTube Music & added to Liked Music!`, "success");
    } else if (newRating === "DISLIKE") {
        showToast(`Disliked "${trackTitle}" on YouTube Music`, "info");
    } else {
        showToast(`Removed rating for "${trackTitle}"`, "info");
    }
    
    try {
        const res = await fetch("/api/ytmusic/rate-track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: activeProfile,
                video_id: videoId,
                url: trackUrl,
                rating: newRating,
                title: trackTitle,
                artist: trackArtist
            })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Failed to update rating");
        }
        
        if (typeof loadConfig === "function") {
            await loadConfig(activeProfile);
        }
        
        // Auto-download liked song if auto_download_liked is enabled in config
        if (newRating === "LIKE" && activeConfig && activeConfig.auto_download_liked && !isLocalTrack(currentPlayingTrack)) {
            showToast(`Auto-downloading "${trackTitle}" to your local library...`, "info");
            fetch("/api/ytmusic/download-track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: activeProfile,
                    url: trackUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""),
                    title: trackTitle,
                    artist: trackArtist
                })
            }).then(r => r.json()).then(d => {
                showToast(`Auto-downloaded "${trackTitle}" to Library!`, "success");
                allDownloadedFilenamesSet.add(trackTitle.toLowerCase());
                allDownloadedFilenamesSet.add(cleanMediaExtension(trackTitle).toLowerCase());
                currentPlayingTrack.is_local = true;
                updatePlaybackUI();
                if (typeof loadFiles === "function") loadFiles();
            }).catch(e => console.error("Auto-download error:", e));
        }
    } catch (err) {
        console.error("Error rating track:", err);
        showToast(`Rating error: ${err.message}`, "danger");
    }
}

function updatePlaybackUI() {
    if (!currentPlayingTrack) return;
    
    const title = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.display_name || currentPlayingTrack.filename || "Unknown Song");
    const artist = currentPlayingTrack.artist || "Unknown Artist";
    
    playerTrackTitle.textContent = title;
    playerTrackArtist.textContent = artist;

    // Automatic Lyrics Update on Track Change
    const trackKey = (currentPlayingTrack.id || currentPlayingTrack.url || title + artist).toLowerCase();
    if (activeLyricsTrackKey !== trackKey) {
        activeLyricsTrackKey = trackKey;
        fetchLyrics(artist, title);
    }
    
    // Rating Buttons State (Like / Dislike)
    const likeBtn = document.getElementById("player-like-btn");
    const dislikeBtn = document.getElementById("player-dislike-btn");
    if (likeBtn) {
        if (currentPlayingTrack.user_rating === "LIKE") likeBtn.classList.add("liked");
        else likeBtn.classList.remove("liked");
    }
    if (dislikeBtn) {
        if (currentPlayingTrack.user_rating === "DISLIKE") dislikeBtn.classList.add("disliked");
        else dislikeBtn.classList.remove("disliked");
    }

    // Fixed Position Status Container (Green Circle Tick for Local vs Download Button for Streaming)
    const container = document.getElementById("player-status-container");
    if (container) {
        const isLocal = isLocalTrack(currentPlayingTrack);
        if (isLocal) {
            // Green tick inside a circle icon
            container.innerHTML = `
                <div class="status-circle-check" title="Downloaded (Local Library File)" style="width: 24px; height: 24px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; display: flex; align-items: center; justify-content: center; color: #10b981; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            `;
        } else {
            // Download button for streaming songs
            container.innerHTML = `
                <button id="player-download-btn" class="btn btn-icon" title="Download song to Library" style="width: 26px; height: 26px; border-radius: 50%; background: rgba(139, 92, 246, 0.2); border: 1px solid #8b5cf6; display: flex; align-items: center; justify-content: center; color: #a78bfa; padding: 0; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            `;
            
            const dlBtn = container.querySelector("#player-download-btn");
            if (dlBtn) {
                dlBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    dlBtn.disabled = true;
                    dlBtn.innerHTML = `<div class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></div>`;
                    showToast(`Downloading "${title}" to your library...`, "info");
                    
                    try {
                        const res = await fetch("/api/ytmusic/download-track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                username: activeProfile,
                                url: currentPlayingTrack.url,
                                title: title,
                                artist: artist
                            })
                        });
                        const data = await res.json();
                        if (res.ok) {
                            showToast(`Downloaded "${title}" to Library!`, "success");
                            allDownloadedFilenamesSet.add(title.toLowerCase());
                            allDownloadedFilenamesSet.add(cleanMediaExtension(title).toLowerCase());
                            currentPlayingTrack.is_local = true;
                            updatePlaybackUI();
                            if (typeof loadFiles === "function") loadFiles();
                        } else {
                            throw new Error(data.detail || "Download failed");
                        }
                    } catch (err) {
                        showToast(`Failed to download: ${err.message}`, "danger");
                        updatePlaybackUI();
                    }
                });
            }
        }
    }

    // Update player album art
    const hoverTitle = document.getElementById("player-art-hover-title");
    const hoverArtist = document.getElementById("player-art-hover-artist");
    const hoverImg = document.getElementById("player-art-hover-img");
    if (hoverTitle) hoverTitle.textContent = title;
    if (hoverArtist) hoverArtist.textContent = artist;

    if (playerAlbumArt) {
        if (currentPlayingTrack.thumbnail_url || currentPlayingTrack.thumbnail) {
            const tUrl = currentPlayingTrack.thumbnail_url || currentPlayingTrack.thumbnail;
            playerAlbumArt.innerHTML = `<img src="${tUrl}" onerror="this.remove(); playerAlbumArt.innerHTML='🎵';" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-sm);">`;
            if (hoverImg) hoverImg.innerHTML = `<img src="${tUrl}" onerror="this.remove(); hoverImg.innerHTML='🎵';" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            playerAlbumArt.innerHTML = `🎵`;
            if (hoverImg) hoverImg.innerHTML = `🎵`;
        }
    }
    
    if (localAudioElement.paused) {
        playSvg.style.display = "block";
        pauseSvg.style.display = "none";
    } else {
        playSvg.style.display = "none";
        pauseSvg.style.display = "block";
    }
    
    updatePipCanvas(title, artist);
    updateMediaSession();
    if (isMaximizedPlayerOpen) updateMaximizedPlayerUI();
    document.body.style.background = "#0a0d14";

    // Highlight active playing track row in all tables
    highlightActivePlayingRows();
    
    // Refresh queue modal if visible
    const queueModal = document.getElementById("queue-drawer-modal");
    if (queueModal && queueModal.style.display === "flex") {
        renderQueueList();
    }
}

// MediaSession API Integration for Hardware Media Keys
function updateMediaSession() {
    if (!('mediaSession' in navigator) || !currentPlayingTrack) return;

    const title = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.display_name || currentPlayingTrack.filename || "Unknown Song");
    const artist = currentPlayingTrack.artist || "Unknown Artist";
    const album = currentPlayingTrack.album || "Music Grabber";
    const artworkUrl = currentPlayingTrack.thumbnail_url || "";

    navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: album,
        artwork: artworkUrl ? [
            { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ] : []
    });

    navigator.mediaSession.setActionHandler('play', () => {
        localAudioElement.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        localAudioElement.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && localAudioElement.duration) {
            localAudioElement.currentTime = details.seekTime;
        }
    });
}

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT" || activeEl.isContentEditable)) {
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
    } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (localAudioElement.duration) {
            localAudioElement.currentTime = Math.min(localAudioElement.duration, localAudioElement.currentTime + 5);
        }
    } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (localAudioElement.duration) {
            localAudioElement.currentTime = Math.max(0, localAudioElement.currentTime - 5);
        }
    } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const volSlider = document.getElementById("player-volume-slider");
        if (volSlider) {
            let val = Math.min(100, parseInt(volSlider.value || "80") + 5);
            volSlider.value = val;
            localAudioElement.volume = val / 100;
        }
    } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const volSlider = document.getElementById("player-volume-slider");
        if (volSlider) {
            let val = Math.max(0, parseInt(volSlider.value || "80") - 5);
            volSlider.value = val;
            localAudioElement.volume = val / 100;
        }
    } else if (e.code === "KeyM") {
        localAudioElement.muted = !localAudioElement.muted;
        showToast(localAudioElement.muted ? "Muted" : "Unmuted", "info");
    } else if (e.code === "KeyL") {
        if (isMaximizedPlayerOpen) {
            toggleLyricsInMaximized();
        } else {
            openMaximizedPlayer(true);
        }
    } else if (e.code === "KeyF") {
        toggleFullscreenPlayer();
    } else if (e.code === "KeyS") {
        toggleShuffle();
    } else if (e.code === "KeyR") {
        toggleRepeatMode();
    } else if (e.code === "Escape") {
        if (isMaximizedPlayerOpen) {
            closeMaximizedPlayer();
        }
    }
});

function togglePlayPause() {
    if (localAudioElement.src && localAudioElement.src !== "" && !localAudioElement.src.endsWith("/")) {
        if (localAudioElement.paused) {
            localAudioElement.play();
        } else {
            localAudioElement.pause();
        }
    } else if (currentPlayingTrack) {
        playTrack(currentPlayingTrack, playerQueue, currentQueueIndex);
    }
}

function playNextTrack() {
    if (playerQueue.length > 0) {
        if (isShuffleActive && playerQueue.length > 1) {
            let randIdx = currentQueueIndex;
            while (randIdx === currentQueueIndex) {
                randIdx = Math.floor(Math.random() * playerQueue.length);
            }
            currentQueueIndex = randIdx;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        } else if (currentQueueIndex < playerQueue.length - 1) {
            currentQueueIndex++;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        } else if (repeatMode === "all") {
            currentQueueIndex = 0;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        }
    }
}

function playPrevTrack() {
    if (playerQueue.length > 0) {
        if (currentQueueIndex > 0) {
            currentQueueIndex--;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        } else if (repeatMode === "all") {
            currentQueueIndex = playerQueue.length - 1;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        }
    }
}

// Maximized Full-Screen Player Logic
function openMaximizedPlayer(openWithLyrics = false) {
    if (!currentPlayingTrack) {
        showToast("Play a song first!", "info");
        return;
    }
    const overlay = document.getElementById("maximized-player-overlay");
    if (!overlay) return;
    
    isMaximizedPlayerOpen = true;
    overlay.style.display = "flex";
    
    if (openWithLyrics) {
        isLyricsActiveInMaximized = true;
    }
    
    updateMaximizedPlayerUI();
    fetchLyrics(currentPlayingTrack.artist, currentPlayingTrack.title || currentPlayingTrack.filename);
}

function closeMaximizedPlayer() {
    const overlay = document.getElementById("maximized-player-overlay");
    if (overlay) overlay.style.display = "none";
    isMaximizedPlayerOpen = false;
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}

function toggleLyricsInMaximized(forceState = null) {
    isLyricsActiveInMaximized = forceState !== null ? forceState : !isLyricsActiveInMaximized;
    const bodyContainer = document.getElementById("maximized-body-container");
    const lyricsBtn = document.getElementById("maximized-lyrics-toggle-btn");
    
    if (bodyContainer) {
        if (isLyricsActiveInMaximized) {
            bodyContainer.classList.remove("lyrics-off");
            bodyContainer.classList.add("lyrics-on");
        } else {
            bodyContainer.classList.remove("lyrics-on");
            bodyContainer.classList.add("lyrics-off");
        }
    }
    if (lyricsBtn) {
        if (isLyricsActiveInMaximized) lyricsBtn.classList.add("active");
        else lyricsBtn.classList.remove("active");
    }
}

function toggleQueueInMaximized() {
    isQueueActiveInMaximized = !isQueueActiveInMaximized;
    const queueCol = document.getElementById("maximized-queue-column");
    const queueBtn = document.getElementById("maximized-queue-toggle-btn");
    
    if (queueCol) {
        if (isQueueActiveInMaximized) queueCol.classList.remove("collapsed");
        else queueCol.classList.add("collapsed");
    }
    if (queueBtn) {
        if (isQueueActiveInMaximized) queueBtn.classList.add("active");
        else queueBtn.classList.remove("active");
    }
}

function toggleFullscreenPlayer() {
    const overlay = document.getElementById("maximized-player-overlay");
    if (!overlay) return;
    if (!document.fullscreenElement) {
        overlay.requestFullscreen().catch(err => {
            console.error("Error attempting to enable fullscreen:", err);
        });
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

function updateMaximizedPlayerUI() {
    if (!currentPlayingTrack) return;
    
    const title = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.display_name || currentPlayingTrack.filename || "Unknown Song");
    const artist = currentPlayingTrack.artist || "Unknown Artist";
    const album = currentPlayingTrack.album || "Local Library Track";
    const thumb = currentPlayingTrack.thumbnail_url || "";
    
    const headerTrack = document.getElementById("maximized-header-track");
    const songTitle = document.getElementById("maximized-song-title");
    const songArtist = document.getElementById("maximized-song-artist");
    const songAlbum = document.getElementById("maximized-song-album");
    const coverArt = document.getElementById("maximized-cover-art");
    const bgBlur = document.getElementById("maximized-bg-blur");
    
    if (headerTrack) headerTrack.textContent = title;
    if (songTitle) songTitle.textContent = title;
    if (songArtist) songArtist.textContent = artist;
    if (songAlbum) songAlbum.textContent = album;
    
    if (coverArt) {
        if (thumb) {
            coverArt.innerHTML = `<img src="${thumb}" onerror="this.remove(); coverArt.innerHTML='🎵';" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            coverArt.innerHTML = `🎵`;
        }
    }
    
    if (bgBlur && thumb) {
        bgBlur.style.backgroundImage = `url('${thumb}')`;
    }
    
    const playSvg = document.getElementById("maximized-play-svg");
    const pauseSvg = document.getElementById("maximized-pause-svg");
    if (localAudioElement.paused) {
        if (playSvg) playSvg.style.display = "block";
        if (pauseSvg) pauseSvg.style.display = "none";
    } else {
        if (playSvg) playSvg.style.display = "none";
        if (pauseSvg) pauseSvg.style.display = "block";
    }
    
    toggleLyricsInMaximized(isLyricsActiveInMaximized);
    renderMaximizedQueueList();
}

function renderMaximizedQueueList() {
    const listContainer = document.getElementById("maximized-queue-list");
    if (!listContainer) return;
    
    if (!playerQueue || playerQueue.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 16px; font-size: 0.85rem;">Queue is empty</div>`;
        return;
    }
    
    listContainer.innerHTML = "";
    playerQueue.forEach((track, idx) => {
        const isCurrent = idx === currentQueueIndex;
        const item = document.createElement("div");
        item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-sm); background: ${isCurrent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)'}; cursor: pointer; transition: all 0.2s ease;`;
        
        const cleanTitle = cleanMediaExtension(track.title || track.filename || "Unknown Track");
        const durText = (track.duration && track.duration > 0) ? formatDuration(track.duration) : "";
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                <span style="font-size: 0.75rem; font-weight: 700; color: ${isCurrent ? 'var(--primary)' : 'var(--text-dim)'}; min-width: 18px;">${isCurrent ? '▶' : (idx + 1)}</span>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 500; font-size: 0.82rem; color: ${isCurrent ? 'var(--primary)' : 'var(--text-main)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cleanTitle)}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(track.artist || "Unknown Artist")}</div>
                </div>
            </div>
            ${durText ? `<span style="font-size: 0.72rem; color: var(--text-dim); font-weight: 500; margin-left: 8px; flex-shrink: 0;">${durText}</span>` : ''}
        `;
        
        item.addEventListener("click", () => {
            playTrack(track, playerQueue, idx);
        });
        
        listContainer.appendChild(item);
    });
}

// Lyrics Customization & Preferences State
let lyricsCustomization = {
    fontSize: 20,
    textAlign: "center"
};

try {
    const savedCustom = localStorage.getItem("musicgrabber_lyrics_prefs");
    if (savedCustom) lyricsCustomization = Object.assign(lyricsCustomization, JSON.parse(savedCustom));
} catch (e) {}

function applyLyricsCustomization() {
    [document.getElementById("maximized-lyrics-body"), document.getElementById("floating-lyrics-body")].forEach(el => {
        if (!el) return;
        el.style.fontSize = `${lyricsCustomization.fontSize}px`;
        el.style.textAlign = lyricsCustomization.textAlign;
    });
    try {
        localStorage.setItem("musicgrabber_lyrics_prefs", JSON.stringify(lyricsCustomization));
    } catch (e) {}
}

function changeLyricsFontSize(delta) {
    lyricsCustomization.fontSize = Math.min(36, Math.max(14, lyricsCustomization.fontSize + delta));
    applyLyricsCustomization();
}

function toggleLyricsAlignment() {
    const aligns = ["left", "center", "right"];
    const nextIdx = (aligns.indexOf(lyricsCustomization.textAlign) + 1) % aligns.length;
    lyricsCustomization.textAlign = aligns[nextIdx];
    applyLyricsCustomization();
}

// Floating Draggable & Resizable Lyrics Window Logic
let floatingLyricsPos = { left: null, top: null, width: 400, height: 520 };
try {
    const savedPos = localStorage.getItem("musicgrabber_floating_lyrics_pos");
    if (savedPos) floatingLyricsPos = Object.assign(floatingLyricsPos, JSON.parse(savedPos));
} catch (e) {}

function openFloatingLyrics() {
    if (!currentPlayingTrack) {
        showToast("Play a song first!", "info");
        return;
    }
    const modal = document.getElementById("floating-lyrics-modal");
    if (!modal) return;
    
    modal.style.display = "flex";
    
    if (floatingLyricsPos.left !== null && floatingLyricsPos.top !== null) {
        modal.style.left = `${floatingLyricsPos.left}px`;
        modal.style.top = `${floatingLyricsPos.top}px`;
        modal.style.bottom = "auto";
        modal.style.right = "auto";
    }
    if (floatingLyricsPos.width) modal.style.width = `${floatingLyricsPos.width}px`;
    if (floatingLyricsPos.height) modal.style.height = `${floatingLyricsPos.height}px`;
    
    const titleEl = document.getElementById("floating-lyrics-title");
    if (titleEl) {
        titleEl.textContent = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.filename || "Lyrics");
    }
    
    applyLyricsCustomization();
    fetchLyrics(currentPlayingTrack.artist, currentPlayingTrack.title || currentPlayingTrack.filename);
}

function closeFloatingLyrics() {
    const modal = document.getElementById("floating-lyrics-modal");
    if (modal) modal.style.display = "none";
}

function initFloatingLyricsDragAndResize() {
    const modal = document.getElementById("floating-lyrics-modal");
    const header = document.getElementById("floating-lyrics-header");
    const resizeHandle = document.getElementById("floating-lyrics-resize-handle");
    if (!modal || !header || !resizeHandle) return;
    
    let isDragging = false;
    let isResizing = false;
    let dragStartX = 0, dragStartY = 0, initialLeft = 0, initialTop = 0;
    let resizeStartX = 0, resizeStartY = 0, initialW = 0, initialH = 0;
    
    header.addEventListener("mousedown", (e) => {
        if (e.target.closest(".floating-lyrics-actions")) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = modal.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        modal.style.bottom = "auto";
        modal.style.right = "auto";
        modal.style.left = `${initialLeft}px`;
        modal.style.top = `${initialTop}px`;
        document.body.style.userSelect = "none";
    });
    
    resizeHandle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        initialW = modal.offsetWidth;
        initialH = modal.offsetHeight;
        document.body.style.userSelect = "none";
    });
    
    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            let newLeft = Math.max(0, Math.min(window.innerWidth - modal.offsetWidth, initialLeft + dx));
            let newTop = Math.max(0, Math.min(window.innerHeight - modal.offsetHeight, initialTop + dy));
            modal.style.left = `${newLeft}px`;
            modal.style.top = `${newTop}px`;
            floatingLyricsPos.left = newLeft;
            floatingLyricsPos.top = newTop;
        } else if (isResizing) {
            const dw = e.clientX - resizeStartX;
            const dh = e.clientY - resizeStartY;
            let newW = Math.max(280, initialW + dw);
            let newH = Math.max(250, initialH + dh);
            modal.style.width = `${newW}px`;
            modal.style.height = `${newH}px`;
            floatingLyricsPos.width = newW;
            floatingLyricsPos.height = newH;
        }
    });
    
    document.addEventListener("mouseup", () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            document.body.style.userSelect = "";
            try {
                localStorage.setItem("musicgrabber_floating_lyrics_pos", JSON.stringify(floatingLyricsPos));
            } catch (e) {}
        }
    });
}

// Fetch & Display Lyrics
async function fetchLyrics(artist, title) {
    const maxBody = document.getElementById("maximized-lyrics-body");
    const floatBody = document.getElementById("floating-lyrics-body");
    const floatTitleEl = document.getElementById("floating-lyrics-title");

    if (floatTitleEl && title) {
        floatTitleEl.textContent = cleanMediaExtension(title);
    }
    
    currentSyncedLyricsLines = [];
    currentPlainLyricsLines = [];
    
    const loadingHtml = `<div class="lyrics-placeholder-msg"><span class="spinner" style="width: 24px; height: 24px; border-width: 2px; border-top-color: var(--primary); margin-right: 12px;"></span> Searching lyrics online...</div>`;
    if (maxBody) maxBody.innerHTML = loadingHtml;
    if (floatBody) floatBody.innerHTML = loadingHtml;
    
    try {
        const res = await fetch(`/api/lyrics?artist=${encodeURIComponent(artist || "")}&title=${encodeURIComponent(title || "")}`);
        if (res.ok) {
            const data = await res.json();
            if (data.syncedLyrics) {
                parseAndRenderSyncedLyrics(data.syncedLyrics);
            } else if (data.plainLyrics && !data.plainLyrics.includes("not found")) {
                renderPlainLyrics(data.plainLyrics);
            } else {
                const notFoundHtml = `<div class="lyrics-placeholder-msg">Lyrics not found for this track.</div>`;
                if (maxBody) maxBody.innerHTML = notFoundHtml;
                if (floatBody) floatBody.innerHTML = notFoundHtml;
            }
        } else {
            const errHtml = `<div class="lyrics-placeholder-msg">Unable to load lyrics at this time.</div>`;
            if (maxBody) maxBody.innerHTML = errHtml;
            if (floatBody) floatBody.innerHTML = errHtml;
        }
    } catch (e) {
        const errText = `<div class="lyrics-placeholder-msg">Error fetching lyrics: ${escapeHtml(e.message)}</div>`;
        if (maxBody) maxBody.innerHTML = errText;
        if (floatBody) floatBody.innerHTML = errText;
    }
    applyLyricsCustomization();
}

function renderPlainLyrics(plainText) {
    const maxBody = document.getElementById("maximized-lyrics-body");
    const floatBody = document.getElementById("floating-lyrics-body");
    
    if (maxBody) maxBody.innerHTML = "";
    if (floatBody) floatBody.innerHTML = "";
    currentSyncedLyricsLines = [];
    currentPlainLyricsLines = [];

    const rawLines = plainText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) {
        const notFoundHtml = `<div class="lyrics-placeholder-msg">Lyrics empty.</div>`;
        if (maxBody) maxBody.innerHTML = notFoundHtml;
        if (floatBody) floatBody.innerHTML = notFoundHtml;
        return;
    }

    const totalLines = rawLines.length;

    rawLines.forEach((text, idx) => {
        const lineEl1 = document.createElement("div");
        lineEl1.className = "lyrics-line";
        lineEl1.textContent = text;
        lineEl1.dataset.lineIndex = idx;
        lineEl1.addEventListener("click", () => {
            if (localAudioElement && localAudioElement.duration) {
                localAudioElement.currentTime = (idx / totalLines) * localAudioElement.duration;
            }
        });
        if (maxBody) maxBody.appendChild(lineEl1);

        const lineEl2 = document.createElement("div");
        lineEl2.className = "lyrics-line";
        lineEl2.textContent = text;
        lineEl2.dataset.lineIndex = idx;
        lineEl2.addEventListener("click", () => {
            if (localAudioElement && localAudioElement.duration) {
                localAudioElement.currentTime = (idx / totalLines) * localAudioElement.duration;
            }
        });
        if (floatBody) floatBody.appendChild(lineEl2);

        currentPlainLyricsLines.push({ index: idx, elements: [lineEl1, lineEl2] });
    });

    applyLyricsCustomization();
}

function parseAndRenderSyncedLyrics(lrcText) {
    const maxBody = document.getElementById("maximized-lyrics-body");
    const floatBody = document.getElementById("floating-lyrics-body");
    
    if (maxBody) maxBody.innerHTML = "";
    if (floatBody) floatBody.innerHTML = "";
    currentSyncedLyricsLines = [];
    currentPlainLyricsLines = [];
    
    const lines = lrcText.split("\n");
    const timeRegex = /\[(\d+):(\d+)\.(\d+)\]/;
    
    lines.forEach((lineText) => {
        const match = timeRegex.exec(lineText);
        if (match) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = parseInt(match[3], 10);
            const totalSeconds = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const text = lineText.replace(/\[\d+:\d+\.\d+\]/g, "").trim();
            if (text) {
                const lineEl1 = document.createElement("div");
                lineEl1.className = "lyrics-line";
                lineEl1.textContent = text;
                lineEl1.dataset.time = totalSeconds;
                lineEl1.addEventListener("click", () => {
                    localAudioElement.currentTime = totalSeconds;
                });
                if (maxBody) maxBody.appendChild(lineEl1);
                
                const lineEl2 = document.createElement("div");
                lineEl2.className = "lyrics-line";
                lineEl2.textContent = text;
                lineEl2.dataset.time = totalSeconds;
                lineEl2.addEventListener("click", () => {
                    localAudioElement.currentTime = totalSeconds;
                });
                if (floatBody) floatBody.appendChild(lineEl2);
                
                currentSyncedLyricsLines.push({ time: totalSeconds, elements: [lineEl1, lineEl2] });
            }
        }
    });
    
    if (currentSyncedLyricsLines.length === 0) {
        const plainText = lrcText.replace(/\[\d+:\d+\.\d+\]/g, "").trim();
        renderPlainLyrics(plainText);
    }
    applyLyricsCustomization();
}

// Render Queue List inside Queue Drawer
function renderQueueList() {
    const nowArt = document.getElementById("queue-now-art");
    const nowTitle = document.getElementById("queue-now-title");
    const nowArtist = document.getElementById("queue-now-artist");
    const listContainer = document.getElementById("queue-list-container");
    
    if (currentPlayingTrack) {
        if (nowTitle) nowTitle.textContent = cleanMediaExtension(currentPlayingTrack.title || currentPlayingTrack.filename || "Unknown Song");
        if (nowArtist) nowArtist.textContent = currentPlayingTrack.artist || "Unknown Artist";
        if (nowArt) {
            if (currentPlayingTrack.thumbnail_url) {
                nowArt.innerHTML = `<img src="${currentPlayingTrack.thumbnail_url}" style="width:100%; height:100%; object-fit:cover;">`;
            } else {
                nowArt.innerHTML = `🎵`;
            }
        }
    }
    
    if (!listContainer) return;
    
    if (!playerQueue || playerQueue.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 24px;">No items in queue.</div>`;
        return;
    }
    
    listContainer.innerHTML = "";
    playerQueue.forEach((track, idx) => {
        const isCurrent = idx === currentQueueIndex;
        const item = document.createElement("div");
        item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-md); background: ${isCurrent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)'}; cursor: pointer; transition: all 0.2s ease;`;
        
        const cleanTitle = cleanMediaExtension(track.title || track.filename || "Unknown Track");
        const durText = (track.duration && track.duration > 0) ? formatDuration(track.duration) : "";
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                <span style="font-size: 0.8rem; font-weight: 700; color: ${isCurrent ? 'var(--primary)' : 'var(--text-dim)'}; min-width: 24px;">${isCurrent ? '▶' : (idx + 1)}</span>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 500; font-size: 0.88rem; color: ${isCurrent ? 'var(--primary)' : 'var(--text-main)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cleanTitle)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(track.artist || "Unknown Artist")}</div>
                </div>
            </div>
            ${durText ? `<span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 500; margin-right: 8px; flex-shrink: 0;">${durText}</span>` : ''}
            <button class="btn btn-icon btn-sm remove-queue-item-btn" style="color: var(--text-dim); padding: 4px;" title="Remove from queue">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        `;
        
        item.addEventListener("click", (e) => {
            if (e.target.closest(".remove-queue-item-btn")) return;
            playTrack(track, playerQueue, idx);
        });
        
        const removeBtn = item.querySelector(".remove-queue-item-btn");
        if (removeBtn) {
            removeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                playerQueue.splice(idx, 1);
                if (idx < currentQueueIndex) currentQueueIndex--;
                renderQueueList();
                renderMaximizedQueueList();
                showToast("Removed song from queue", "info");
            });
        }
        
        listContainer.appendChild(item);
    });
}

// Wire Maximized Player Triggers
const playerAlbumArtBtn = document.getElementById("player-album-art");
const playerTrackTitleEl = document.getElementById("player-track-title");
const playerTrackArtistEl = document.getElementById("player-track-artist");
const playerLyricsBtn = document.getElementById("player-lyrics-btn");

if (playerAlbumArtBtn) {
    playerAlbumArtBtn.addEventListener("click", () => openMaximizedPlayer(false));
}
if (playerTrackTitleEl) {
    playerTrackTitleEl.addEventListener("click", () => openMaximizedPlayer(false));
}
if (playerTrackArtistEl) {
    playerTrackArtistEl.addEventListener("click", () => openMaximizedPlayer(false));
}
if (playerLyricsBtn) {
    playerLyricsBtn.addEventListener("click", () => {
        if (isMaximizedPlayerOpen) {
            toggleLyricsInMaximized(true);
        } else {
            const floatModal = document.getElementById("floating-lyrics-modal");
            if (floatModal && floatModal.style.display === "flex") {
                closeFloatingLyrics();
            } else {
                openFloatingLyrics();
            }
        }
    });
}

function toggleLyricsAutoScroll() {
    isLyricsAutoScrollEnabled = !isLyricsAutoScrollEnabled;
    try {
        localStorage.setItem("musicgrabber_lyrics_autoscroll", isLyricsAutoScrollEnabled);
    } catch (e) {}
    updateLyricsAutoScrollUI();
    showToast(isLyricsAutoScrollEnabled ? "Lyrics Auto-Scroll Enabled" : "Lyrics Auto-Scroll Disabled", "info");
}

function updateLyricsAutoScrollUI() {
    const btn1 = document.getElementById("max-lyrics-autoscroll-btn");
    const btn2 = document.getElementById("floating-lyrics-autoscroll-btn");
    [btn1, btn2].forEach(btn => {
        if (!btn) return;
        if (isLyricsAutoScrollEnabled) {
            btn.classList.add("active");
            btn.style.color = "var(--accent)";
            btn.title = "Auto-Scroll: ON (Click to disable)";
        } else {
            btn.classList.remove("active");
            btn.style.color = "var(--text-dim)";
            btn.title = "Auto-Scroll: OFF (Click to enable)";
        }
    });
}

// Wire Lyrics Customization Controls
const maxAutoScrollBtn = document.getElementById("max-lyrics-autoscroll-btn");
const floatAutoScrollBtn = document.getElementById("floating-lyrics-autoscroll-btn");
const maxFontDecBtn = document.getElementById("max-lyrics-font-dec");
const maxFontIncBtn = document.getElementById("max-lyrics-font-inc");
const maxAlignBtn = document.getElementById("max-lyrics-align-btn");
const floatFontDecBtn = document.getElementById("floating-lyrics-font-dec");
const floatFontIncBtn = document.getElementById("floating-lyrics-font-inc");
const floatAlignBtn = document.getElementById("floating-lyrics-align-btn");
const floatCloseBtn = document.getElementById("floating-lyrics-close");

if (maxAutoScrollBtn) maxAutoScrollBtn.addEventListener("click", toggleLyricsAutoScroll);
if (floatAutoScrollBtn) floatAutoScrollBtn.addEventListener("click", toggleLyricsAutoScroll);
if (maxFontDecBtn) maxFontDecBtn.addEventListener("click", () => changeLyricsFontSize(-2));
if (maxFontIncBtn) maxFontIncBtn.addEventListener("click", () => changeLyricsFontSize(2));
if (maxAlignBtn) maxAlignBtn.addEventListener("click", toggleLyricsAlignment);

if (floatFontDecBtn) floatFontDecBtn.addEventListener("click", () => changeLyricsFontSize(-2));
if (floatFontIncBtn) floatFontIncBtn.addEventListener("click", () => changeLyricsFontSize(2));
if (floatAlignBtn) floatAlignBtn.addEventListener("click", toggleLyricsAlignment);
if (floatCloseBtn) floatCloseBtn.addEventListener("click", closeFloatingLyrics);

updateLyricsAutoScrollUI();

initFloatingLyricsDragAndResize();

// Wire Maximized Overlay Controls
const maxMinimizeBtn = document.getElementById("maximized-minimize-btn");
const maxLyricsToggleBtn = document.getElementById("maximized-lyrics-toggle-btn");
const maxQueueToggleBtn = document.getElementById("maximized-queue-toggle-btn");
const maxQueueCloseBtn = document.getElementById("maximized-queue-close-btn");
const maxFullscreenBtn = document.getElementById("maximized-fullscreen-btn");
const maxPlayBtn = document.getElementById("maximized-play-btn");
const maxPrevBtn = document.getElementById("maximized-prev-btn");
const maxNextBtn = document.getElementById("maximized-next-btn");
const maxShuffleBtn = document.getElementById("maximized-shuffle-btn");
const maxRepeatBtn = document.getElementById("maximized-repeat-btn");
const maxSlider = document.getElementById("maximized-progress-slider");

if (maxMinimizeBtn) maxMinimizeBtn.addEventListener("click", closeMaximizedPlayer);
if (maxLyricsToggleBtn) maxLyricsToggleBtn.addEventListener("click", () => toggleLyricsInMaximized());
if (maxQueueToggleBtn) maxQueueToggleBtn.addEventListener("click", toggleQueueInMaximized);
if (maxQueueCloseBtn) maxQueueCloseBtn.addEventListener("click", toggleQueueInMaximized);
if (maxFullscreenBtn) maxFullscreenBtn.addEventListener("click", toggleFullscreenPlayer);
if (maxPlayBtn) maxPlayBtn.addEventListener("click", togglePlayPause);
if (maxPrevBtn) maxPrevBtn.addEventListener("click", playPrevTrack);
if (maxNextBtn) maxNextBtn.addEventListener("click", playNextTrack);
if (maxShuffleBtn) maxShuffleBtn.addEventListener("click", toggleShuffle);
if (maxRepeatBtn) maxRepeatBtn.addEventListener("click", toggleRepeatMode);

if (maxSlider) {
    maxSlider.addEventListener("input", () => {
        if (localAudioElement.duration) {
            localAudioElement.currentTime = (maxSlider.value / 100) * localAudioElement.duration;
        }
    });
}

// Queue Drawer Button Listener
const playerQueueBtn = document.getElementById("player-queue-btn");
const queueDrawerClose = document.getElementById("queue-drawer-close");
const queueDrawerModal = document.getElementById("queue-drawer-modal");

if (playerQueueBtn) {
    playerQueueBtn.addEventListener("click", () => {
        renderQueueList();
        if (queueDrawerModal) queueDrawerModal.style.display = "flex";
    });
}

if (queueDrawerClose) {
    queueDrawerClose.addEventListener("click", () => {
        if (queueDrawerModal) queueDrawerModal.style.display = "none";
    });
}

const pipVideo = document.createElement("video");
pipVideo.muted = true;
pipVideo.playsInline = true;

const pipCanvas = document.createElement("canvas");
pipCanvas.width = 640;
pipCanvas.height = 640;
const pipCtx = pipCanvas.getContext("2d");

function updatePipCanvas(title, artist) {
    const grad = pipCtx.createLinearGradient(0, 0, 640, 640);
    grad.addColorStop(0, "#0d111a");
    grad.addColorStop(1, "#161b26");
    pipCtx.fillStyle = grad;
    pipCtx.fillRect(0, 0, 640, 640);
    
    if (currentPlayingTrack && currentPlayingTrack.thumbnail_url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = currentPlayingTrack.thumbnail_url;
        img.onload = () => {
            try {
                pipCtx.save();
                pipCtx.beginPath();
                if (typeof pipCtx.roundRect === "function") {
                    pipCtx.roundRect(140, 40, 360, 360, 20);
                } else {
                    pipCtx.rect(140, 40, 360, 360);
                }
                pipCtx.clip();
                pipCtx.drawImage(img, 140, 40, 360, 360);
                pipCtx.restore();
            } catch (e) {
                pipCtx.drawImage(img, 140, 40, 360, 360);
            }
            
            pipCtx.fillStyle = "#ffffff";
            pipCtx.font = "bold 28px 'Outfit', sans-serif";
            pipCtx.textAlign = "center";
            pipCtx.fillText(title, 320, 450, 560);
            
            pipCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
            pipCtx.font = "20px 'Outfit', sans-serif";
            pipCtx.fillText(artist, 320, 490, 560);
            
            drawPipProgressBar();
        };
    } else {
        pipCtx.fillStyle = "#ffffff";
        pipCtx.font = "bold 32px 'Outfit', sans-serif";
        pipCtx.textAlign = "center";
        pipCtx.fillText(title, 320, 240, 560);
        
        pipCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
        pipCtx.font = "24px 'Outfit', sans-serif";
        pipCtx.fillText(artist, 320, 290, 560);
        
        pipCtx.fillStyle = "rgba(255, 255, 255, 0.2)";
        pipCtx.font = "120px sans-serif";
        pipCtx.fillText("🎵", 320, 440);
        
        drawPipProgressBar();
    }
}

function drawPipProgressBar() {
    if (!localAudioElement.duration) return;
    const progress = localAudioElement.currentTime / localAudioElement.duration;
    pipCtx.fillStyle = "rgba(255, 255, 255, 0.15)";
    pipCtx.fillRect(60, 560, 520, 8);
    pipCtx.fillStyle = "#6366f1";
    pipCtx.fillRect(60, 560, 520 * progress, 8);
}

async function togglePip() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            const title = currentPlayingTrack?.title || currentPlayingTrack?.display_name || "Music Grabber";
            const artist = currentPlayingTrack?.artist || "Self-Hosted";
            updatePipCanvas(title, artist);
            
            const stream = pipCanvas.captureStream(1);
            pipVideo.srcObject = stream;
            
            await new Promise(resolve => {
                pipVideo.onloadedmetadata = () => {
                    pipVideo.play().then(resolve);
                };
            });
            await pipVideo.requestPictureInPicture();
        }
    } catch (e) {
        console.error("PIP failed", e);
        alert("Picture-in-Picture mode not supported or requires user gesture.");
    }
}

localAudioElement.addEventListener("timeupdate", () => {
    if (localAudioElement.duration) {
        const cur = localAudioElement.currentTime;
        const dur = localAudioElement.duration;
        const val = (cur / dur) * 100;
        
        if (playerProgressSlider) playerProgressSlider.value = val;
        if (playerCurrentTime) playerCurrentTime.textContent = formatDuration(cur);
        
        const maxSlider = document.getElementById("maximized-progress-slider");
        const maxCurr = document.getElementById("maximized-curr-time");
        const maxTotal = document.getElementById("maximized-total-time");
        if (maxSlider) maxSlider.value = val;
        if (maxCurr) maxCurr.textContent = formatDuration(cur);
        if (maxTotal) maxTotal.textContent = formatDuration(dur);

        // Highlight & Auto-scroll active lyrics line across maximized and floating views
        if (isLyricsAutoScrollEnabled && dur > 0) {
            if (currentSyncedLyricsLines && currentSyncedLyricsLines.length > 0) {
                let activeIdx = -1;
                for (let i = 0; i < currentSyncedLyricsLines.length; i++) {
                    if (cur >= currentSyncedLyricsLines[i].time) {
                        activeIdx = i;
                    } else {
                        break;
                    }
                }
                if (activeIdx >= 0) {
                    currentSyncedLyricsLines.forEach((item, idx) => {
                        const lineEls = item.elements || (item.element ? [item.element] : []);
                        lineEls.forEach(el => {
                            if (idx === activeIdx) {
                                if (!el.classList.contains("active")) {
                                    el.classList.add("active");
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            } else {
                                el.classList.remove("active");
                            }
                        });
                    });
                }
            } else if (currentPlainLyricsLines && currentPlainLyricsLines.length > 0) {
                const ratio = Math.min(0.99, Math.max(0, cur / dur));
                const activeLineIdx = Math.floor(ratio * currentPlainLyricsLines.length);

                currentPlainLyricsLines.forEach((item, idx) => {
                    const lineEls = item.elements || [];
                    lineEls.forEach(el => {
                        if (idx === activeLineIdx) {
                            if (!el.classList.contains("active")) {
                                el.classList.add("active");
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        } else {
                            el.classList.remove("active");
                        }
                    });
                });
            }
        }
        
        drawPipProgressBar();

        if (activeProfile && cur > 0) {
            try {
                localStorage.setItem(`musicgrabber_seek_time_${activeProfile}`, cur);
            } catch (e) {}
        }
    }
});

localAudioElement.addEventListener("loadedmetadata", () => {
    if (playerTotalTime) playerTotalTime.textContent = formatDuration(localAudioElement.duration);
    if (playerProgressSlider) playerProgressSlider.value = 0;
    const maxTotal = document.getElementById("maximized-total-time");
    const maxSlider = document.getElementById("maximized-progress-slider");
    if (maxTotal) maxTotal.textContent = formatDuration(localAudioElement.duration);
    if (maxSlider) maxSlider.value = 0;
});

// Playback State Variables
let isShuffleActive = false;
let repeatMode = "off"; // "off", "all", "one"

localAudioElement.addEventListener("ended", () => {
    if (repeatMode === "one") {
        localAudioElement.currentTime = 0;
        localAudioElement.play();
        return;
    }
    
    if (isShuffleActive && playerQueue.length > 1) {
        let randIdx = currentQueueIndex;
        while (randIdx === currentQueueIndex) {
            randIdx = Math.floor(Math.random() * playerQueue.length);
        }
        currentQueueIndex = randIdx;
        playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        return;
    }
    
    if (playerQueue.length > 0) {
        if (currentQueueIndex < playerQueue.length - 1) {
            currentQueueIndex++;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        } else if (repeatMode === "all") {
            currentQueueIndex = 0;
            playTrack(playerQueue[currentQueueIndex], playerQueue, currentQueueIndex);
        } else {
            updatePlaybackUI();
        }
    } else {
        updatePlaybackUI();
    }
});

localAudioElement.addEventListener("play", updatePlaybackUI);
localAudioElement.addEventListener("pause", updatePlaybackUI);

if (playerPlayBtn) {
    playerPlayBtn.addEventListener("click", togglePlayPause);
}
if (playerNextBtn) {
    playerNextBtn.addEventListener("click", playNextTrack);
}
if (playerPrevBtn) {
    playerPrevBtn.addEventListener("click", playPrevTrack);
}

function toggleShuffle() {
    isShuffleActive = !isShuffleActive;
    if (isShuffleActive) {
        if (playerQueue.length > 1) {
            if (unshuffledQueue.length === 0) unshuffledQueue = [...playerQueue];
            const currentTrack = currentPlayingTrack;
            const remaining = playerQueue.filter(t => t !== currentTrack);
            for (let i = remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }
            playerQueue = currentTrack ? [currentTrack, ...remaining] : remaining;
            currentQueueIndex = 0;
        }
        showToast("Shuffle Mode On", "info");
    } else {
        if (unshuffledQueue.length > 0) {
            playerQueue = [...unshuffledQueue];
            if (currentPlayingTrack) {
                const foundIdx = playerQueue.findIndex(t => 
                    (t.title && currentPlayingTrack.title && t.title === currentPlayingTrack.title) ||
                    (t.filename && currentPlayingTrack.filename && t.filename === currentPlayingTrack.filename)
                );
                currentQueueIndex = foundIdx >= 0 ? foundIdx : 0;
            }
        }
        showToast("Shuffle Mode Off", "info");
    }
    updateShuffleButtonsUI();
    renderQueueList();
    renderMaximizedQueueList();
}

function updateShuffleButtonsUI() {
    const btn1 = document.getElementById("player-shuffle-btn");
    const btn2 = document.getElementById("maximized-shuffle-btn");
    [btn1, btn2].forEach(b => {
        if (!b) return;
        if (isShuffleActive) {
            b.style.color = "var(--primary)";
            b.title = "Shuffle (On)";
        } else {
            b.style.color = "var(--text-dim)";
            b.title = "Shuffle (Off)";
        }
    });
}

function toggleRepeatMode() {
    if (repeatMode === "off") {
        repeatMode = "all";
        showToast("Repeat All Queue", "info");
    } else if (repeatMode === "all") {
        repeatMode = "one";
        showToast("Repeat 1 Track", "info");
    } else {
        repeatMode = "off";
        showToast("Repeat Off", "info");
    }
    updateRepeatButtonsUI();
}

function updateRepeatButtonsUI() {
    const btn1 = document.getElementById("player-repeat-btn");
    const btn2 = document.getElementById("maximized-repeat-btn");
    const badge = document.getElementById("repeat-one-badge");
    
    [btn1, btn2].forEach(b => {
        if (!b) return;
        if (repeatMode === "off") {
            b.style.color = "var(--text-dim)";
            b.title = "Repeat (Off)";
        } else {
            b.style.color = "var(--primary)";
            b.title = repeatMode === "one" ? "Repeat Current Track" : "Repeat All Queue";
        }
    });
    
    if (badge) {
        badge.style.display = repeatMode === "one" ? "block" : "none";
    }
}

// Like & Dislike Buttons Listeners
const playerLikeBtn = document.getElementById("player-like-btn");
const playerDislikeBtn = document.getElementById("player-dislike-btn");

if (playerLikeBtn) {
    playerLikeBtn.addEventListener("click", () => {
        if (!currentPlayingTrack) return;
        const targetRating = currentPlayingTrack.user_rating === "LIKE" ? "INDIFFERENT" : "LIKE";
        rateCurrentTrack(targetRating);
    });
}

if (playerDislikeBtn) {
    playerDislikeBtn.addEventListener("click", () => {
        if (!currentPlayingTrack) return;
        const targetRating = currentPlayingTrack.user_rating === "DISLIKE" ? "INDIFFERENT" : "DISLIKE";
        rateCurrentTrack(targetRating);
    });
}

// Shuffle Button Listener
const playerShuffleBtn = document.getElementById("player-shuffle-btn");
if (playerShuffleBtn) {
    playerShuffleBtn.addEventListener("click", toggleShuffle);
}

// Repeat Button Listener
const playerRepeatBtn = document.getElementById("player-repeat-btn");
if (playerRepeatBtn) {
    playerRepeatBtn.addEventListener("click", toggleRepeatMode);
}

// Seek Bar Style Mode Switcher Listener
const playerVisualizerStyleBtn = document.getElementById("player-visualizer-style-btn");
if (playerVisualizerStyleBtn) {
    playerVisualizerStyleBtn.addEventListener("click", () => {
        if (visualizerStyleMode === "solid_envelope") {
            visualizerStyleMode = "equalizer";
            showToast("Seek Bar Style: Realtime Equalizer", "info");
        } else if (visualizerStyleMode === "equalizer") {
            visualizerStyleMode = "thin_bars";
            showToast("Seek Bar Style: Thin Frequency Bars", "info");
        } else if (visualizerStyleMode === "thin_bars") {
            visualizerStyleMode = "minimal_line";
            showToast("Seek Bar Style: Minimal Progress Line", "info");
        } else {
            visualizerStyleMode = "solid_envelope";
            showToast("Seek Bar Style: Solid Waveform Envelope", "info");
        }
        try {
            localStorage.setItem("musicgrabber_seekbar_style", visualizerStyleMode);
        } catch (e) {}
    });
}

playerPrevBtn.addEventListener("click", () => {
    if (playerQueue.length > 0 && currentQueueIndex > 0) {
        currentQueueIndex--;
        playTrack(playerQueue[currentQueueIndex], playerQueue);
    }
});

playerProgressSlider.addEventListener("input", () => {
    if (localAudioElement.duration) {
        const pct = playerProgressSlider.value / 100;
        const targetTime = pct * localAudioElement.duration;
        localAudioElement.currentTime = targetTime;
        if (activeProfile) {
            try {
                localStorage.setItem(`musicgrabber_seek_time_${activeProfile}`, targetTime);
            } catch (e) {}
        }
    }
});

playerVolumeSlider.addEventListener("input", () => {
    const vol = playerVolumeSlider.value / 100;
    localAudioElement.volume = vol;
    try {
        localStorage.setItem("musicgrabber_volume", vol);
    } catch (e) {}
});

playerCloseBtn.addEventListener("click", () => {
    localAudioElement.pause();
    showToast("Playback paused", "info");
});

playerPipBtn.addEventListener("click", togglePip);


// ==================== Discover Page Logic ====================

// Toggle Subtabs
document.querySelectorAll(".discover-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".discover-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const subtabId = btn.getAttribute("data-subtab");
        document.querySelectorAll(".discover-subtab-pane").forEach(p => p.style.display = "none");
        const pane = document.getElementById(subtabId);
        if (pane) pane.style.display = "block";
        if (activeProfile && subtabId) {
            localStorage.setItem(`musicgrabber_library_subtab_${activeProfile}`, subtabId);
        }
    });
});

async function loadDiscoverData() {
    if (!activeProfile) return;

    // Restore saved library subtab
    try {
        const savedSubtab = localStorage.getItem(`musicgrabber_library_subtab_${activeProfile}`);
        if (savedSubtab) {
            const btn = document.querySelector(`.discover-tab-btn[data-subtab="${savedSubtab}"]`);
            if (btn) {
                document.querySelectorAll(".discover-tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                document.querySelectorAll(".discover-subtab-pane").forEach(p => p.style.display = "none");
                const pane = document.getElementById(savedSubtab);
                if (pane) pane.style.display = "block";
            }
        }
    } catch(e) {}
    
    // Render existing data immediately if already loaded
    if (discoverData) {
        renderDiscoverPage();
    } else {
        discoverArtistsGrid.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>Loading library metadata...</p></div>';
        discoverSongsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;"><div class="spinner-container"><div class="spinner"></div><p style="margin-top: 12px; color: var(--text-dim);">Scanning music library folders...</p></div></td></tr>';
    }
    
    try {
        const res = await fetch(`/api/discover?username=${activeProfile}&t=${Date.now()}`);
        if (!res.ok) throw new Error("API scan failed");
        
        discoverData = await res.json();
        if (discoverData && discoverData.all_songs) {
            updateDownloadedFilesSet(discoverData.all_songs);
        }
        renderDiscoverPage();
    } catch (e) {
        if (!discoverData) {
            discoverArtistsGrid.innerHTML = `<div class="empty-sources" style="color: var(--danger)">Failed to load discover page: ${e.message}</div>`;
            discoverSongsTableBody.innerHTML = `<tr><td colspan="6" class="empty-table" style="color: var(--danger)">Failed to scan music library: ${e.message}</td></tr>`;
        }
    }
}

// Inline Expander Drawer for Artist, Album, and Genre Cards
function toggleInlineExpander(cardElement, gridContainer, title, type, tracks) {
    const parentPane = gridContainer.parentElement || gridContainer;
    
    // Check if this card's drawer is currently open
    const isAlreadyOpen = cardElement.classList.contains("card-selected");
    
    // Close all open drawers in this subtab pane and clear card highlights
    parentPane.querySelectorAll(".inline-expander-drawer").forEach(el => el.remove());
    gridContainer.querySelectorAll(".discover-card").forEach(el => {
        el.classList.remove("card-selected");
        el.classList.remove("card-expanded");
    });
    
    if (isAlreadyOpen) return; // Toggled closed
    
    cardElement.classList.add("card-selected");
    
    // Create the Expander Drawer element
    const drawer = document.createElement("div");
    drawer.className = "inline-expander-drawer glass-card";
    drawer.style.cssText = `
        width: 100%;
        margin: 4px 0 8px 0;
        padding: 16px 20px;
        background: rgba(14, 17, 28, 0.96);
        border: 1px solid var(--primary);
        border-radius: var(--radius-lg);
        display: flex;
        gap: 20px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(99, 102, 241, 0.2);
        animation: slideDownPaper 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
    `;
    
    const cleanTitle = title.replace(/^(Artist|Album|Genre):\s*/, "");
    const imgUrl = type === "artist" 
        ? `/api/artist-image?artist=${encodeURIComponent(cleanTitle)}`
        : (tracks.find(t => t.thumbnail_url)?.thumbnail_url || "");
    const defaultIcon = type === "artist" ? "👤" : (type === "album" ? "💿" : "🎸");
    
    // Left Overview Column
    const leftCol = document.createElement("div");
    leftCol.style.cssText = "width: 210px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; text-align: center; border-right: 1px solid rgba(255,255,255,0.08); padding-right: 20px; justify-content: center;";
    leftCol.innerHTML = `
        <div style="width: 85px; height: 85px; border-radius: ${type === 'artist' ? '50%' : 'var(--radius-md)'}; position: relative; overflow: hidden; margin-bottom: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.4); background: var(--primary);">
            <span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 2.2rem; z-index: 1;">${defaultIcon}</span>
            ${imgUrl ? `<img src="${imgUrl}" onerror="this.remove();" style="position: absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; z-index:2;">` : ''}
        </div>
        <h3 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); word-break: break-word; line-height: 1.2;">${escapeHtml(cleanTitle)}</h3>
        <p style="font-size: 0.75rem; color: var(--text-dim); margin: 0 0 8px 0; line-height: 1.3;">Downloaded ${type.charAt(0).toUpperCase() + type.slice(1)} music catalog.</p>
        <span class="badge badge-idle" style="margin-bottom: 10px; font-size: 0.75rem; background: rgba(99, 102, 241, 0.15); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.3);">${tracks.length} ${tracks.length === 1 ? 'Song' : 'Songs'}</span>
        <button class="btn btn-primary btn-sm play-all-inline-btn" style="width: 100%; border-radius: 20px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Play All Songs
        </button>
    `;
    
    // Right Songs List Column
    const rightCol = document.createElement("div");
    rightCol.style.cssText = "flex: 1; min-width: 0; display: flex; flex-direction: column;";
    rightCol.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--text-main);">Tracks in ${escapeHtml(cleanTitle)} (${tracks.length})</h4>
            <button class="btn btn-icon btn-sm close-inline-drawer-btn" style="color: var(--text-dim);" title="Close">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>
        <div class="inline-tracks-scroll" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px;">
        </div>
    `;
    
    const scrollList = rightCol.querySelector(".inline-tracks-scroll");
    tracks.forEach((t, idx) => {
        const item = document.createElement("div");
        item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); border-radius: var(--radius-sm); transition: var(--transition); cursor: pointer;";
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                <span style="font-size: 0.8rem; color: var(--text-dim); width: 20px; text-align: center;">${idx + 1}</span>
                <div style="min-width: 0;">
                    <div style="font-weight: 500; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.title)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.artist || 'Unknown Artist')} ${t.album ? '• ' + escapeHtml(t.album) : ''}</div>
                </div>
            </div>
            <button class="btn btn-primary btn-sm play-single-inline-btn" style="padding: 0; width: 26px; height: 26px; border-radius: 50%; min-width: 0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Play Track">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
        `;
        
        item.addEventListener("click", (e) => {
            if (e.target.closest(".play-single-inline-btn")) return;
            playTrack(t, tracks, idx);
        });
        
        item.querySelector(".play-single-inline-btn").addEventListener("click", () => {
            playTrack(t, tracks, idx);
        });
        
        scrollList.appendChild(item);
    });
    
    leftCol.querySelector(".play-all-inline-btn").addEventListener("click", () => {
        if (tracks.length > 0) playTrack(tracks[0], tracks, 0);
    });
    
    rightCol.querySelector(".close-inline-drawer-btn").addEventListener("click", () => {
        drawer.remove();
        cardElement.classList.remove("card-selected");
    });
    
    drawer.appendChild(leftCol);
    drawer.appendChild(rightCol);
    
    // Find the last card in the same horizontal row as the clicked card
    const allCards = Array.from(gridContainer.querySelectorAll(".discover-card"));
    const clickedTop = cardElement.offsetTop;
    let lastInRow = cardElement;
    for (let i = 0; i < allCards.length; i++) {
        if (Math.abs(allCards[i].offsetTop - clickedTop) < 15) {
            lastInRow = allCards[i];
        }
    }
    
    // Insert expander drawer immediately after the last card of this visual row
    lastInRow.after(drawer);
    
    // Smooth scroll drawer into view
    drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// discoverSearchQuery is declared at the top of the file with other state variables

function renderDiscoverPage() {
    if (!discoverData) return;
    renderDiscoverSongsTable(discoverSearchQuery);
    renderDiscoverArtistsGrid(discoverSearchQuery);
    renderDiscoverAlbumsGrid(discoverSearchQuery);
    renderDiscoverGenresGrid(discoverSearchQuery);
}

function renderDiscoverArtistsGrid(query = "") {
    if (!discoverData || !discoverArtistsGrid) return;
    discoverArtistsGrid.innerHTML = "";
    let artists = Object.keys(discoverData.artists).sort();
    const q = query.trim().toLowerCase();
    
    if (q) {
        artists = artists.filter(art => {
            if (art.toLowerCase().includes(q)) return true;
            const tracks = discoverData.artists[art] || [];
            return tracks.some(t => (t.title && t.title.toLowerCase().includes(q)) || (t.album && t.album.toLowerCase().includes(q)));
        });
    }

    if (artists.length === 0) {
        discoverArtistsGrid.innerHTML = `<div class="empty-sources">${q ? 'No artists matching "' + escapeHtml(query) + '" found.' : 'No downloaded songs found yet.'}</div>`;
    } else {
        artists.forEach(art => {
            const tracks = discoverData.artists[art];
            const primaryArt = art.split(",")[0].trim();
            const artistImgUrl = `/api/artist-image?artist=${encodeURIComponent(primaryArt)}`;
            const card = document.createElement("div");
            card.className = "discover-card";
            card.innerHTML = `
                <div class="discover-card-icon" style="position: relative; overflow: hidden; border-radius: 50%;">
                    <span style="position: absolute; z-index: 1;">👤</span>
                    <img src="${artistImgUrl}" loading="lazy" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; z-index: 2;">
                </div>
                <div class="discover-card-title">${escapeHtml(art)}</div>
            `;
            card.addEventListener("click", () => toggleInlineExpander(card, discoverArtistsGrid, art, "artist", tracks));
            discoverArtistsGrid.appendChild(card);
        });
    }
}

function renderDiscoverAlbumsGrid(query = "") {
    if (!discoverData || !discoverAlbumsGrid) return;
    discoverAlbumsGrid.innerHTML = "";
    let albums = Object.keys(discoverData.albums).sort();
    const q = query.trim().toLowerCase();
    
    if (q) {
        albums = albums.filter(alb => {
            if (alb.toLowerCase().includes(q)) return true;
            const tracks = discoverData.albums[alb] || [];
            return tracks.some(t => (t.title && t.title.toLowerCase().includes(q)) || (t.artist && t.artist.toLowerCase().includes(q)));
        });
    }

    if (albums.length === 0) {
        discoverAlbumsGrid.innerHTML = `<div class="empty-sources">${q ? 'No albums matching "' + escapeHtml(query) + '" found.' : 'No downloaded songs found yet.'}</div>`;
    } else {
        albums.forEach(alb => {
            const tracks = discoverData.albums[alb];
            const firstWithThumb = tracks.find(t => t.thumbnail_url);
            const thumbSrc = firstWithThumb ? firstWithThumb.thumbnail_url : "";
            const card = document.createElement("div");
            card.className = "discover-card";
            card.innerHTML = `
                <div class="discover-card-icon" style="position: relative; overflow: hidden; border-radius: var(--radius-md);">
                    <span style="position: absolute; z-index: 1;">💿</span>
                    ${thumbSrc ? `<img src="${thumbSrc}" loading="lazy" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); z-index: 2;">` : ""}
                </div>
                <div class="discover-card-title">${escapeHtml(alb)}</div>
            `;
            card.addEventListener("click", () => toggleInlineExpander(card, discoverAlbumsGrid, alb, "album", tracks));
            discoverAlbumsGrid.appendChild(card);
        });
    }
}

function renderDiscoverGenresGrid(query = "") {
    if (!discoverData || !discoverGenresGrid) return;
    discoverGenresGrid.innerHTML = "";
    let genres = Object.keys(discoverData.genres).sort();
    const q = query.trim().toLowerCase();
    
    if (q) {
        genres = genres.filter(gen => {
            if (gen.toLowerCase().includes(q)) return true;
            const tracks = discoverData.genres[gen] || [];
            return tracks.some(t => (t.title && t.title.toLowerCase().includes(q)) || (t.artist && t.artist.toLowerCase().includes(q)));
        });
    }

    if (genres.length === 0) {
        discoverGenresGrid.innerHTML = `<div class="empty-sources">${q ? 'No genres matching "' + escapeHtml(query) + '" found.' : 'No downloaded songs found yet.'}</div>`;
    } else {
        genres.forEach(gen => {
            const tracks = discoverData.genres[gen];
            const firstWithThumb = tracks.find(t => t.thumbnail_url);
            const thumbSrc = firstWithThumb ? firstWithThumb.thumbnail_url : "";
            const card = document.createElement("div");
            card.className = "discover-card";
            card.innerHTML = `
                <div class="discover-card-icon" style="position: relative; overflow: hidden; border-radius: var(--radius-md);">
                    <span style="position: absolute; z-index: 1;">🎸</span>
                    ${thumbSrc ? `<img src="${thumbSrc}" loading="lazy" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); z-index: 2;">` : ""}
                </div>
                <div class="discover-card-title">${escapeHtml(gen)}</div>
            `;
            card.addEventListener("click", () => toggleInlineExpander(card, discoverGenresGrid, gen, "genre", tracks));
            discoverGenresGrid.appendChild(card);
        });
    }
}

let activeContextMenuTrack = null;

function formatTrackDuration(sec) {
    if (!sec || isNaN(sec) || sec <= 0) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function openContextMenu(x, y, track) {
    activeContextMenuTrack = track;
    const menu = document.getElementById("custom-context-menu");
    if (!menu) return;

    menu.style.display = "block";
    const menuWidth = 220;
    const menuHeight = 240;

    let posX = x;
    let posY = y;
    if (x + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
}

function closeContextMenu() {
    const menu = document.getElementById("custom-context-menu");
    if (menu) menu.style.display = "none";
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("custom-context-menu");
    if (menu && !menu.contains(e.target)) {
        closeContextMenu();
    }
});

function initContextMenu() {
    const btnPlayNow = document.getElementById("ctx-play-now");
    const btnPlayNext = document.getElementById("ctx-play-next");
    const btnAddQueue = document.getElementById("ctx-add-queue");
    const btnAddPlaylist = document.getElementById("ctx-add-playlist");
    const btnEditMeta = document.getElementById("ctx-edit-metadata");
    const btnDelete = document.getElementById("ctx-delete-track");

    if (btnPlayNow) {
        btnPlayNow.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) playTrack(activeContextMenuTrack);
        });
    }
    if (btnPlayNext) {
        btnPlayNext.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) {
                const insertIdx = currentQueueIndex + 1;
                playerQueue.splice(insertIdx, 0, activeContextMenuTrack);
                showToast(`"${activeContextMenuTrack.title || activeContextMenuTrack.filename}" will play next.`, "success");
            }
        });
    }
    if (btnAddQueue) {
        btnAddQueue.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) {
                playerQueue.push(activeContextMenuTrack);
                showToast(`Added "${activeContextMenuTrack.title || activeContextMenuTrack.filename}" to play queue.`, "success");
            }
        });
    }
    if (btnAddPlaylist) {
        btnAddPlaylist.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) openAddToPlaylistModal(activeContextMenuTrack);
        });
    }
    if (btnEditMeta) {
        btnEditMeta.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) openMetadataEditModal(activeContextMenuTrack);
        });
    }
    if (btnDelete) {
        btnDelete.addEventListener("click", () => {
            closeContextMenu();
            if (activeContextMenuTrack) deleteTrackFromLibrary(activeContextMenuTrack);
        });
    }
}

async function deleteTrackFromLibrary(track) {
    if (!activeProfile || !track) return;
    const filename = track.filename || track.local_filename || track.name || track.path || "";
    if (!filename) return;

    try {
        const res = await fetch(`/api/delete-track?username=${activeProfile}&filename=${encodeURIComponent(filename)}`, {
            method: "POST"
        });
        let data = {};
        try {
            data = await res.json();
        } catch (err) {
            data = { detail: res.statusText };
        }
        if (res.ok) {
            showToast(data.message || "Track deleted successfully.", "success");
            if (typeof loadFiles === "function") loadFiles();
            if (typeof loadDiscoverData === "function") loadDiscoverData();
        } else {
            showToast("Failed to delete track: " + (data.detail || "Error"), "danger");
        }
    } catch (e) {
        showToast("Error deleting track: " + e.message, "danger");
    }
}

function openMetadataEditModal(track) {
    const modal = document.getElementById("metadata-edit-modal");
    if (!modal) return;
    modal.style.display = "flex";

    const inputTitle = document.getElementById("meta-input-title");
    const inputArtist = document.getElementById("meta-input-artist");
    const inputAlbum = document.getElementById("meta-input-album");
    const inputGenre = document.getElementById("meta-input-genre");
    const inputYear = document.getElementById("meta-input-year");
    const inputCover = document.getElementById("meta-input-cover");
    const inputLyrics = document.getElementById("meta-input-lyrics");
    const imgPreview = document.getElementById("meta-preview-artwork");

    const candidatesWrapper = document.getElementById("meta-candidates-wrapper");
    const candidatesList = document.getElementById("meta-candidates-list");
    const candidatesCount = document.getElementById("meta-candidates-count");
    const lyricsSourcesWrapper = document.getElementById("meta-lyrics-sources-wrapper");
    const lyricsSourcesList = document.getElementById("meta-lyrics-sources-list");
    if (candidatesWrapper) candidatesWrapper.style.display = "none";
    if (candidatesList) candidatesList.innerHTML = "";
    if (lyricsSourcesWrapper) lyricsSourcesWrapper.style.display = "none";

    if (inputTitle) inputTitle.value = track.title || "";
    if (inputArtist) inputArtist.value = track.artist || "";
    if (inputAlbum) inputAlbum.value = track.album || "";
    if (inputGenre) inputGenre.value = track.genre || "";
    if (inputYear) inputYear.value = track.year || "";
    if (inputCover) inputCover.value = track.cover_url || track.thumbnail_url || "";
    if (inputLyrics) inputLyrics.value = track.lyrics || "";

    const artSrc = track.thumbnail_url || track.cover_url || "";
    if (imgPreview) {
        if (artSrc) {
            imgPreview.src = artSrc;
            imgPreview.style.display = "block";
        } else {
            imgPreview.style.display = "none";
        }
    }

    if (inputCover) {
        inputCover.oninput = () => {
            const val = inputCover.value.trim();
            if (val && imgPreview) {
                imgPreview.src = val;
                imgPreview.style.display = "block";
            }
        };
    }

    const autoFetchBtn = document.getElementById("meta-auto-fetch-btn");
    if (autoFetchBtn) {
        autoFetchBtn.onclick = async () => {
            const rawTitle = inputTitle ? inputTitle.value.trim() : (track.title || "");
            const rawArtist = inputArtist ? inputArtist.value.trim() : (track.artist || "");

            const cleanTitle = rawTitle
                .replace(/#(Lyrical|Video|Full|Song|Official|HD|4K)/gi, "")
                .replace(/\|\|?/g, " ")
                .replace(/\b(Full Video Song|Lyrical Video|Official Video|Audio Song|Video Song|Official Audio|Lyric Video)\b/gi, "")
                .replace(/\s+/g, " ")
                .trim();

            const isGenericArtist = !rawArtist || rawArtist.toLowerCase().includes("aditya music") || rawArtist.toLowerCase().includes("unknown") || rawArtist.toLowerCase().includes("channel");
            const cleanArtist = isGenericArtist ? "" : rawArtist;

            const query = `${cleanTitle} ${cleanArtist}`.trim() || cleanTitle;
            if (!query) {
                showToast("Please enter a song title or artist to search.", "warning");
                return;
            }

            if (candidatesWrapper) candidatesWrapper.style.display = "block";
            if (candidatesList) candidatesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-dim); padding: 8px;"><span class="spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 6px; display: inline-block; vertical-align: middle;"></span> Searching iTunes, MusicBrainz, LRCLIB for "${escapeHtml(query)}"...</div>`;
            if (candidatesCount) candidatesCount.textContent = "Searching...";

            try {
                let res = await fetch(`/api/fetch-metadata-candidates?query=${encodeURIComponent(query)}`);
                let data = await res.json();
                let candidates = data.candidates || [];

                if (candidates.length === 0 && cleanTitle && cleanArtist) {
                    res = await fetch(`/api/fetch-metadata-candidates?query=${encodeURIComponent(cleanTitle)}`);
                    data = await res.json();
                    candidates = data.candidates || [];
                }

                if (candidates.length === 0) {
                    if (candidatesList) candidatesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-dim); padding: 8px;">No online metadata candidates found. You can still manually edit any fields below.</div>`;
                    if (candidatesCount) candidatesCount.textContent = "0 candidates found";
                } else {
                    if (candidatesCount) candidatesCount.textContent = `${candidates.length} candidate(s) found - click to apply`;
                    if (candidatesList) {
                        candidatesList.innerHTML = "";
                        candidates.forEach(cand => {
                            const card = document.createElement("div");
                            card.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); cursor: pointer; transition: background 0.2s;";
                            card.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                                    ${cand.cover_url ? `<img src="${cand.cover_url}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover; flex-shrink: 0;">` : `<span style="font-size: 1.2rem;">🎵</span>`}
                                    <div style="min-width: 0;">
                                        <strong style="font-size: 0.82rem; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cand.title)}</strong>
                                        <span style="font-size: 0.72rem; color: var(--text-dim); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cand.artist)} ${cand.album ? '• ' + escapeHtml(cand.album) : ''} ${cand.year ? '(' + cand.year + ')' : ''}</span>
                                    </div>
                                </div>
                                <span class="badge" style="font-size: 0.65rem; background: rgba(99, 102, 241, 0.2); color: var(--primary); font-weight: 600;">${cand.source}</span>
                            `;
                            card.onclick = () => {
                                if (cand.title && inputTitle) inputTitle.value = cand.title;
                                if (cand.artist && inputArtist) inputArtist.value = cand.artist;
                                if (cand.album && inputAlbum) inputAlbum.value = cand.album;
                                if (cand.genre && inputGenre) inputGenre.value = cand.genre;
                                if (cand.year && inputYear) inputYear.value = cand.year;
                                if (cand.cover_url && inputCover) {
                                    inputCover.value = cand.cover_url;
                                    if (imgPreview) {
                                        imgPreview.src = cand.cover_url;
                                        imgPreview.style.display = "block";
                                    }
                                }
                                showToast(`Applied metadata from ${cand.source}!`, "success");
                            };
                            candidatesList.appendChild(card);
                        });
                    }
                }
            } catch (e) {
                if (candidatesList) candidatesList.innerHTML = `<div style="font-size: 0.8rem; color: var(--danger); padding: 8px;">Error searching candidates: ${e.message}</div>`;
            }
        };
    }

    const fetchLyricsBtn = document.getElementById("meta-fetch-lyrics-btn");

    if (fetchLyricsBtn) {
        fetchLyricsBtn.onclick = async () => {
            const t = inputTitle ? inputTitle.value.trim() : (track.title || "");
            const a = inputArtist ? inputArtist.value.trim() : (track.artist || "");
            if (!t) {
                showToast("Please enter a title to fetch lyrics.", "warning");
                return;
            }
            try {
                fetchLyricsBtn.textContent = "Fetching...";
                const res = await fetch(`/api/lyrics-candidates?artist=${encodeURIComponent(a)}&title=${encodeURIComponent(t)}`);
                if (res.ok) {
                    const data = await res.json();
                    const candidates = data.candidates || [];
                    if (candidates.length > 0) {
                        if (lyricsSourcesWrapper) lyricsSourcesWrapper.style.display = "flex";
                        if (lyricsSourcesList) {
                            lyricsSourcesList.innerHTML = "";
                            candidates.forEach((cand, idx) => {
                                const badge = document.createElement("button");
                                badge.type = "button";
                                badge.className = "btn btn-secondary btn-sm";
                                badge.style.cssText = "font-size: 0.7rem; padding: 3px 10px; border: 1px solid var(--border-glass); background: rgba(99, 102, 241, 0.18); border-radius: 12px; cursor: pointer; color: var(--text-main); font-weight: 500;";
                                badge.innerHTML = `<span>🎵 ${cand.source}</span> <span style="opacity:0.75; font-size:0.65rem;">(${cand.type})</span>`;
                                badge.onclick = (e) => {
                                    e.preventDefault();
                                    if (inputLyrics) inputLyrics.value = cand.lyrics;
                                    showToast(`Applied lyrics from ${cand.source}!`, "success");
                                };
                                lyricsSourcesList.appendChild(badge);
                            });
                        }
                        if (inputLyrics) inputLyrics.value = candidates[0].lyrics;
                        showToast(`Found ${candidates.length} lyrics source(s). Loaded from ${candidates[0].source}!`, "success");
                    } else {
                        showToast("No lyrics candidates found for this track.", "warning");
                    }
                } else {
                    showToast("No lyrics candidates found.", "warning");
                }
            } catch (e) {
                showToast("Error fetching lyrics: " + e.message, "danger");
            } finally {
                fetchLyricsBtn.textContent = "Fetch Lyrics Only";
            }
        };
    }

    const saveBtn = document.getElementById("meta-modal-save");
    const cancelBtn = document.getElementById("meta-modal-cancel");

    const onSave = async () => {
        const updatedMeta = {
            username: activeProfile,
            filename: track.filename || track.local_filename || track.name || track.path || "",
            title: inputTitle ? inputTitle.value.trim() : track.title,
            artist: inputArtist ? inputArtist.value.trim() : track.artist,
            album: inputAlbum ? inputAlbum.value.trim() : track.album,
            genre: inputGenre ? inputGenre.value.trim() : track.genre,
            year: inputYear ? inputYear.value.trim() : track.year,
            cover_url: inputCover ? inputCover.value.trim() : (track.cover_url || track.thumbnail_url),
            lyrics: inputLyrics ? inputLyrics.value.trim() : track.lyrics
        };

        track.title = updatedMeta.title || track.title;
        track.artist = updatedMeta.artist || track.artist;
        track.album = updatedMeta.album || track.album;
        track.genre = updatedMeta.genre || track.genre;
        track.year = updatedMeta.year || track.year;
        if (updatedMeta.cover_url) {
            track.cover_url = updatedMeta.cover_url;
            track.thumbnail_url = updatedMeta.cover_url;
        }

        try {
            await fetch("/api/update-track-metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedMeta)
            });
        } catch (e) {
            console.error("Backend metadata update error:", e);
        }

        modal.style.display = "none";
        showToast("Metadata saved successfully.", "success");
        if (typeof renderDiscoverSongsTable === "function") renderDiscoverSongsTable();
        if (typeof loadDiscoverData === "function") loadDiscoverData();
        if (currentPlayingTrack === track) updatePlaybackUI();
    };

    const onCancel = () => {
        modal.style.display = "none";
    };

    if (saveBtn) saveBtn.onclick = onSave;
    if (cancelBtn) cancelBtn.onclick = onCancel;
}

function initLocalPlaylists() {
    if (!activeConfig) return;
    if (!activeConfig.local_playlists) activeConfig.local_playlists = [];

    renderLocalPlaylistsList();

    const createBtn = document.getElementById("create-local-playlist-btn");
    if (createBtn) {
        createBtn.onclick = () => {
            const inputName = document.getElementById("new-playlist-input");
            const val = inputName ? inputName.value.trim() : "";
            const name = val || prompt("Enter new playlist name:");
            if (name && name.trim()) {
                createNewLocalPlaylist(name.trim());
            }
        };
    }
}

function createNewLocalPlaylist(name) {
    if (!activeConfig) return;
    if (!activeConfig.local_playlists) activeConfig.local_playlists = [];

    const newPl = {
        id: "lp_" + Date.now(),
        name: name,
        tracks: []
    };
    activeConfig.local_playlists.push(newPl);
    saveConfig(activeProfile, activeConfig);
    renderLocalPlaylistsList();
    showToast(`Created playlist "${name}".`, "success");
}

function renderLocalPlaylistsList() {
    const listEl = document.getElementById("local-playlists-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const playlists = (activeConfig && activeConfig.local_playlists) ? activeConfig.local_playlists : [];
    if (playlists.length === 0) {
        listEl.innerHTML = `<div class="empty-table" style="padding: 20px 0;">No playlists created yet. Click "+ Create" to make one.</div>`;
        return;
    }

    playlists.forEach(pl => {
        const item = document.createElement("div");
        item.style.cssText = "padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; justify-content: space-between;";
        item.innerHTML = `
            <div>
                <strong style="font-size: 0.9rem; color: var(--text-main); display: block;">${escapeHtml(pl.name)}</strong>
                <span style="font-size: 0.75rem; color: var(--text-dim);">${pl.tracks ? pl.tracks.length : 0} songs</span>
            </div>
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;">View</button>
        `;
        item.addEventListener("click", () => openLocalPlaylistView(pl));
        listEl.appendChild(item);
    });
}

function openLocalPlaylistView(pl) {
    const emptyState = document.getElementById("local-playlist-empty-state");
    const content = document.getElementById("local-playlist-content");
    const titleEl = document.getElementById("local-playlist-title");
    const countEl = document.getElementById("local-playlist-count");
    const tbody = document.getElementById("local-playlist-table-body");

    if (emptyState) emptyState.style.display = "none";
    if (content) content.style.display = "flex";
    if (titleEl) titleEl.textContent = pl.name;
    if (countEl) countEl.textContent = `${pl.tracks ? pl.tracks.length : 0} songs`;

    if (tbody) {
        tbody.innerHTML = "";
        const tracks = pl.tracks || [];
        if (tracks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-table">No tracks in this playlist yet. Right-click or use the action menu on any song in your library to add it here.</td></tr>`;
        } else {
            tracks.forEach((t, idx) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td style="text-align: center;">${idx + 1}</td>
                    <td><strong>${escapeHtml(t.title || t.filename || "Unknown")}</strong></td>
                    <td>${escapeHtml(t.artist || "Unknown")}</td>
                    <td>${escapeHtml(t.album || "Unknown")}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-danger btn-sm remove-pl-track-btn" style="padding: 2px 8px; font-size: 0.75rem;">Remove</button>
                    </td>
                `;
                tr.querySelector(".remove-pl-track-btn").addEventListener("click", () => {
                    pl.tracks.splice(idx, 1);
                    saveConfig(activeProfile, activeConfig);
                    openLocalPlaylistView(pl);
                    renderLocalPlaylistsList();
                });
                tbody.appendChild(tr);
            });
        }
    }

    const playAllBtn = document.getElementById("play-local-playlist-btn");
    if (playAllBtn) {
        playAllBtn.onclick = () => {
            if (pl.tracks && pl.tracks.length > 0) {
                playTrack(pl.tracks[0], pl.tracks, 0);
            }
        };
    }

    const deletePlBtn = document.getElementById("delete-local-playlist-btn");
    if (deletePlBtn) {
        deletePlBtn.onclick = () => {
            if (activeConfig && activeConfig.local_playlists) {
                activeConfig.local_playlists = activeConfig.local_playlists.filter(p => p.id !== pl.id);
                saveConfig(activeProfile, activeConfig);
                renderLocalPlaylistsList();
                if (content) content.style.display = "none";
                if (emptyState) emptyState.style.display = "flex";
                showToast(`Deleted playlist "${pl.name}".`, "success");
            }
        };
    }
}

function openAddToPlaylistModal(track) {
    const modal = document.getElementById("add-to-playlist-modal");
    const list = document.getElementById("playlist-picker-list");
    if (!modal || !list) return;

    modal.style.display = "flex";
    list.innerHTML = "";

    const playlists = (activeConfig && activeConfig.local_playlists) ? activeConfig.local_playlists : [];
    if (playlists.length === 0) {
        list.innerHTML = `<div class="empty-table" style="padding: 10px 0;">No local playlists created yet. Type a name below to create your first playlist.</div>`;
    } else {
        playlists.forEach(pl => {
            const btn = document.createElement("button");
            btn.className = "btn btn-secondary btn-block";
            btn.style.cssText = "justify-content: space-between; text-align: left; padding: 10px 14px; margin-bottom: 4px; display: flex; align-items: center;";
            btn.innerHTML = `<span>📁 ${escapeHtml(pl.name)}</span> <small style="opacity: 0.7;">(${pl.tracks ? pl.tracks.length : 0} songs)</small>`;
            btn.onclick = () => {
                if (!pl.tracks) pl.tracks = [];
                pl.tracks.push(track);
                saveConfig(activeProfile, activeConfig);
                modal.style.display = "none";
                showToast(`Added "${track.title || track.filename}" to playlist "${pl.name}".`, "success");
            };
            list.appendChild(btn);
        });
    }

    const createAddBtn = document.getElementById("create-and-add-playlist-btn");
    const inputEl = document.getElementById("new-playlist-input");

    if (createAddBtn) {
        createAddBtn.onclick = () => {
            const name = inputEl ? inputEl.value.trim() : "";
            if (name) {
                if (!activeConfig.local_playlists) activeConfig.local_playlists = [];
                const newPl = { id: "lp_" + Date.now(), name: name, tracks: [track] };
                activeConfig.local_playlists.push(newPl);
                saveConfig(activeProfile, activeConfig);
                if (inputEl) inputEl.value = "";
                modal.style.display = "none";
                renderLocalPlaylistsList();
                showToast(`Created playlist "${name}" and added "${track.title || track.filename}".`, "success");
            }
        };
    }

    const cancelBtn = document.getElementById("playlist-picker-cancel");
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.style.display = "none";
        };
    }
}

function initSyncSubtabs() {
    const btnFiles = document.getElementById("sync-subtab-files-btn");
    const btnSources = document.getElementById("sync-subtab-sources-btn");
    const paneFiles = document.getElementById("sync-pane-files");
    const paneSources = document.getElementById("sync-pane-sources");

    if (btnFiles && btnSources) {
        btnFiles.addEventListener("click", () => {
            btnFiles.classList.add("active");
            btnSources.classList.remove("active");
            if (paneFiles) paneFiles.style.display = "block";
            if (paneSources) paneSources.style.display = "none";
        });
        btnSources.addEventListener("click", () => {
            btnSources.classList.add("active");
            btnFiles.classList.remove("active");
            if (paneSources) paneSources.style.display = "block";
            if (paneFiles) paneFiles.style.display = "none";
        });
    }
}

let tableSortCol = "title";
let tableSortAsc = true;
let activeFunnelCol = null;
let isLibraryToolbarInited = false;
const columnFilters = { title: "", artist: "", album: "", genre: "" };

function initLibraryToolbar() {
    if (isLibraryToolbarInited) return;
    isLibraryToolbarInited = true;
    const genreFilter = document.getElementById("library-genre-filter");
    const sortBy = document.getElementById("library-sort-by");
    const colsBtn = document.getElementById("library-columns-btn");
    const colsPopover = document.getElementById("library-columns-popover");

    if (genreFilter) genreFilter.addEventListener("change", () => renderDiscoverSongsTable());
    if (sortBy) sortBy.addEventListener("change", () => renderDiscoverSongsTable());

    // Delegated Funnel & Sort Handlers
    document.addEventListener("click", (e) => {
        const funnelBtn = e.target.closest(".col-funnel-btn");
        if (funnelBtn) {
            e.stopPropagation();
            e.preventDefault();
            const col = funnelBtn.getAttribute("data-col");
            activeFunnelCol = col;

            const popover = document.getElementById("col-filter-popover");
            const popTitle = document.getElementById("popover-col-title");
            const popInput = document.getElementById("col-filter-popover-input");

            if (!popover) return;

            const rect = funnelBtn.getBoundingClientRect();
            popover.style.position = "fixed";
            popover.style.display = "block";
            popover.style.top = `${rect.bottom + 6}px`;
            popover.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;

            if (popTitle) popTitle.textContent = `FILTER ${col.toUpperCase()}`;
            if (popInput) {
                popInput.value = columnFilters[col] || "";
                popInput.focus();
            }
            return;
        }

        const sortBtn = e.target.closest(".col-sort-btn");
        if (sortBtn) {
            const col = sortBtn.getAttribute("data-sort");
            if (tableSortCol === col) {
                tableSortAsc = !tableSortAsc;
            } else {
                tableSortCol = col;
                tableSortAsc = true;
            }
            updateSortIconsUI();
            renderDiscoverSongsTable();
            return;
        }

        const popover = document.getElementById("col-filter-popover");
        if (popover && popover.style.display === "block") {
            if (!popover.contains(e.target) && !e.target.closest(".col-funnel-btn")) {
                popover.style.display = "none";
            }
        }
    });

    const popInput = document.getElementById("col-filter-popover-input");
    if (popInput) {
        popInput.addEventListener("input", (e) => {
            if (activeFunnelCol) {
                columnFilters[activeFunnelCol] = e.target.value.trim();
                updateFunnelButtonsUI();
                renderDiscoverSongsTable();
            }
        });
    }

    const popClearBtn = document.getElementById("popover-clear-btn");
    if (popClearBtn) {
        popClearBtn.addEventListener("click", () => {
            if (activeFunnelCol) {
                columnFilters[activeFunnelCol] = "";
                if (popInput) popInput.value = "";
                updateFunnelButtonsUI();
                renderDiscoverSongsTable();
            }
        });
    }

    if (colsBtn && colsPopover) {
        colsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            colsPopover.style.display = colsPopover.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", (e) => {
            if (colsPopover && !colsPopover.contains(e.target) && e.target !== colsBtn) {
                colsPopover.style.display = "none";
            }
        });
    }

    // Column Toggles with LocalStorage Persistence
    const colToggles = [
        { id: "col-toggle-artist", class: "col-artist" },
        { id: "col-toggle-album", class: "col-album" },
        { id: "col-toggle-genre", class: "col-genre" },
        { id: "col-toggle-duration", class: "col-duration" },
        { id: "col-toggle-size", class: "col-size" },
    ];

    let savedCols = null;
    try {
        const raw = localStorage.getItem(`musicgrabber_visible_columns_${activeProfile || 'global'}`);
        if (raw) savedCols = JSON.parse(raw);
    } catch (e) {}

    colToggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            if (savedCols && typeof savedCols[t.id] === "boolean") {
                el.checked = savedCols[t.id];
            }
            document.querySelectorAll(`.${t.class}`).forEach(c => {
                if (el.checked) c.classList.remove("col-hidden");
                else c.classList.add("col-hidden");
            });

            el.addEventListener("change", (e) => {
                const show = e.target.checked;
                document.querySelectorAll(`.${t.class}`).forEach(c => {
                    if (show) c.classList.remove("col-hidden");
                    else c.classList.add("col-hidden");
                });
                saveColumnVisibilityState();
            });
        }
    });
}

function saveColumnVisibilityState() {
    const colState = {
        "col-toggle-artist": document.getElementById("col-toggle-artist")?.checked ?? true,
        "col-toggle-album": document.getElementById("col-toggle-album")?.checked ?? true,
        "col-toggle-genre": document.getElementById("col-toggle-genre")?.checked ?? true,
        "col-toggle-duration": document.getElementById("col-toggle-duration")?.checked ?? true,
        "col-toggle-size": document.getElementById("col-toggle-size")?.checked ?? true,
    };
    try {
        localStorage.setItem(`musicgrabber_visible_columns_${activeProfile || 'global'}`, JSON.stringify(colState));
    } catch (e) {}
}

function updateFunnelButtonsUI() {
    document.querySelectorAll(".col-funnel-btn").forEach(btn => {
        const col = btn.getAttribute("data-col");
        if (columnFilters[col]) {
            btn.style.opacity = "1";
            btn.style.color = "var(--primary)";
            btn.style.background = "rgba(99, 102, 241, 0.25)";
            btn.style.boxShadow = "0 0 8px rgba(99, 102, 241, 0.4)";
        } else {
            btn.style.opacity = "0.6";
            btn.style.color = "currentColor";
            btn.style.background = "transparent";
            btn.style.boxShadow = "none";
        }
    });
}

function updateSortIconsUI() {
    document.querySelectorAll("[data-sort-icon]").forEach(span => {
        const col = span.getAttribute("data-sort-icon");
        if (col === tableSortCol) {
            span.style.opacity = "1";
            span.style.color = "#06b6d4";
            if (tableSortAsc) {
                span.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#06b6d4" stroke-width="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
            } else {
                span.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#06b6d4" stroke-width="3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
            }
        } else {
            span.style.opacity = "0.4";
            span.style.color = "var(--text-dim)";
            span.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 10l5-5 5 5M7 14l5 5 5-5"/></svg>`;
        }
    });
}

function renderDiscoverSongsTable(query = "") {
    initLibraryToolbar();
    if (!discoverData || !discoverSongsTableBody) return;
    discoverSongsTableBody.innerHTML = "";
    let songs = discoverData.all_songs || [];
    const q = query.trim().toLowerCase();

    const fTitle = (columnFilters.title || "").toLowerCase();
    const fArtist = (columnFilters.artist || "").toLowerCase();
    const fAlbum = (columnFilters.album || "").toLowerCase();
    const fGenre = (columnFilters.genre || "").toLowerCase();

    if (fTitle) songs = songs.filter(s => (s.title || "").toLowerCase().includes(fTitle));
    if (fArtist) songs = songs.filter(s => (s.artist || "").toLowerCase().includes(fArtist));
    if (fAlbum) songs = songs.filter(s => (s.album || "").toLowerCase().includes(fAlbum));
    if (fGenre) songs = songs.filter(s => (s.genre || "").toLowerCase().includes(fGenre));

    const genreSelect = document.getElementById("library-genre-filter");
    if (genreSelect && genreSelect.options.length <= 1) {
        const uniqueGenres = Array.from(new Set(songs.map(s => s.genre).filter(Boolean))).sort();
        uniqueGenres.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g;
            opt.textContent = g;
            genreSelect.appendChild(opt);
        });
    }

    if (genreSelect && genreSelect.value !== "all") {
        songs = songs.filter(s => s.genre === genreSelect.value);
    }

    if (q) {
        songs = songs.filter(s => 
            (s.title && s.title.toLowerCase().includes(q)) ||
            (s.artist && s.artist.toLowerCase().includes(q)) ||
            (s.album && s.album.toLowerCase().includes(q)) ||
            (s.genre && s.genre.toLowerCase().includes(q))
        );
    }

    songs.sort((a, b) => {
        let valA = a[tableSortCol] || "";
        let valB = b[tableSortCol] || "";
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        
        if (valA < valB) return tableSortAsc ? -1 : 1;
        if (valA > valB) return tableSortAsc ? 1 : -1;
        return 0;
    });

    if (songs.length === 0) {
        discoverSongsTableBody.innerHTML = `<tr><td colspan="8" class="empty-table">${q || fTitle || fArtist || fAlbum || fGenre ? 'No songs matching filters.' : 'No downloaded songs found yet.'}</td></tr>`;
    } else {
        songs.forEach((s, idx) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.className = "discover-song-row";
            tr.dataset.title = s.title;
            tr.dataset.path = s.path || "";
            tr.dataset.filename = s.filename || s.name || "";
            
            const trackThumb = s.thumbnail_url || "";
            const durationStr = formatTrackDuration(s.duration);
            const sizeStr = s.size ? `${(s.size / (1024 * 1024)).toFixed(1)} MB` : "-";
            
            tr.innerHTML = `
                <td class="play-indicator-cell" style="width: 50px; min-width: 50px; text-align: center; color: var(--text-dim); white-space: nowrap;">
                    <span class="row-index">${idx + 1}</span>
                    <span class="row-play-icon" style="display: none; color: var(--primary);">▶</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--bg-card); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid var(--border-glass); position: relative;">
                            <span style="font-size: 1rem; position: absolute; z-index: 1;">🎵</span>
                            ${trackThumb ? `<img src="${trackThumb}" loading="lazy" onerror="this.style.display='none';" style="width: 100%; height: 100%; object-fit: cover; position: absolute; left: 0; top: 0; z-index: 2;">` : ""}
                        </div>
                        <strong style="font-size: 0.95rem;">${escapeHtml(s.title)}</strong>
                    </div>
                </td>
                <td class="col-artist">${escapeHtml(s.artist)}</td>
                <td class="col-album">${escapeHtml(s.album)}</td>
                <td class="col-genre" style="white-space: nowrap;">
                    <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <span style="font-size: 0.9rem; opacity: 0.85;">🎸</span>
                        <span class="badge" style="background: rgba(255, 255, 255, 0.06); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; border: 1px solid var(--border-glass); white-space: nowrap; display: inline-block;">${escapeHtml(s.genre)}</span>
                    </div>
                </td>
                <td class="col-duration" style="text-align: center; font-size: 0.85rem; color: var(--text-dim); font-variant-numeric: tabular-nums;">${durationStr}</td>
                <td class="col-size" style="text-align: center; font-size: 0.8rem; color: var(--text-dim);">${sizeStr}</td>
                <td style="text-align: right; width: 90px; white-space: nowrap;">
                    <button class="btn btn-primary btn-icon play-btn-row" title="Play Song" style="width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--primary); border: none; color: #fff; padding: 0; margin-right: 4px;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <button class="btn btn-secondary btn-icon track-options-btn" title="More Options" style="width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 0; font-size: 1.1rem; line-height: 1;">⋮</button>
                </td>
            `;
            
            tr.addEventListener("click", (e) => {
                if (e.target.closest(".play-btn-row") || e.target.closest(".track-options-btn") || e.target.closest("input")) return;

                const existingNext = tr.nextElementSibling;
                if (existingNext && existingNext.classList.contains("song-inline-details-drawer")) {
                    existingNext.remove();
                    tr.classList.remove("row-selected");
                    return;
                }

                discoverSongsTableBody.querySelectorAll(".song-inline-details-drawer").forEach(d => d.remove());
                discoverSongsTableBody.querySelectorAll(".discover-song-row").forEach(r => r.classList.remove("row-selected"));

                tr.classList.add("row-selected");

                const drawerTr = document.createElement("tr");
                drawerTr.className = "song-inline-details-drawer";
                drawerTr.innerHTML = `
                    <td colspan="8" style="padding: 0; background: rgba(14, 17, 28, 0.95); border-bottom: 1px solid var(--primary);">
                        <div style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1;">
                                <div style="width: 60px; height: 60px; border-radius: var(--radius-md); overflow: hidden; background: rgba(0,0,0,0.4); border: 1px solid var(--border-glass); flex-shrink: 0; position: relative; display: flex; align-items: center; justify-content: center;">
                                    <span style="font-size: 1.8rem; position: absolute; z-index: 1;">🎵</span>
                                    ${trackThumb ? `<img src="${trackThumb}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; left: 0; top: 0; z-index: 2;">` : ''}
                                </div>
                                <div style="min-width: 0; flex: 1;">
                                    <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.title)}</h4>
                                    <p style="margin: 0 0 6px 0; font-size: 0.8rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.artist)} ${s.album ? '• ' + escapeHtml(s.album) : ''} ${s.year ? '(' + s.year + ')' : ''}</p>
                                    <div style="display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap;">
                                        <span>Genre: <strong style="color: var(--text-main);">${escapeHtml(s.genre)}</strong></span>
                                        <span>Duration: <strong style="color: var(--text-main);">${durationStr}</strong></span>
                                        <span>Size: <strong style="color: var(--text-main);">${sizeStr}</strong></span>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <button class="btn btn-primary btn-sm drawer-play-btn" style="display: flex; align-items: center; gap: 6px; border-radius: 20px; font-weight: 600;">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play Now
                                </button>
                                <button class="btn btn-secondary btn-sm drawer-edit-btn" style="display: flex; align-items: center; gap: 6px;">✏️ Edit Metadata</button>
                                <button class="btn btn-secondary btn-sm drawer-playlist-btn" style="display: flex; align-items: center; gap: 6px;">➕ Add to Playlist</button>
                                <button class="btn btn-danger btn-sm drawer-delete-btn" style="display: flex; align-items: center; gap: 6px; color: #f87171;">🗑️ Delete</button>
                            </div>
                        </div>
                    </td>
                `;

                drawerTr.querySelector(".drawer-play-btn").onclick = () => playTrack(s, songs, idx);
                drawerTr.querySelector(".drawer-edit-btn").onclick = () => openMetadataEditModal(s);
                drawerTr.querySelector(".drawer-playlist-btn").onclick = () => openAddToPlaylistModal(s);
                drawerTr.querySelector(".drawer-delete-btn").onclick = () => deleteTrackFromLibrary(s);

                tr.after(drawerTr);
            });

            tr.addEventListener("dblclick", () => {
                playTrack(s, songs, idx);
            });

            tr.querySelector(".play-btn-row").addEventListener("click", (e) => {
                e.stopPropagation();
                playTrack(s, songs, idx);
            });

            tr.querySelector(".track-options-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                const rect = e.target.getBoundingClientRect();
                openContextMenu(rect.left - 180, rect.bottom + 4, s);
            });

            tr.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                openContextMenu(e.clientX, e.clientY, s);
            });

            discoverSongsTableBody.appendChild(tr);
        });
        highlightActivePlayingRows();
        applyColumnVisibilityState();
    }
}

function applyColumnVisibilityState() {
    const colToggles = [
        { id: "col-toggle-artist", class: "col-artist" },
        { id: "col-toggle-album", class: "col-album" },
        { id: "col-toggle-genre", class: "col-genre" },
        { id: "col-toggle-duration", class: "col-duration" },
        { id: "col-toggle-size", class: "col-size" },
    ];
    colToggles.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            document.querySelectorAll(`.${t.class}`).forEach(c => {
                if (el.checked) c.classList.remove("col-hidden");
                else c.classList.add("col-hidden");
            });
        }
    });
}

function openDiscoverDetails(title, tracks) {
    let cleanName = title;
    let icon = "🎵";
    if (title.startsWith("Artist: ")) {
        cleanName = title.substring(8);
        icon = "👤";
    } else if (title.startsWith("Album: ")) {
        cleanName = title.substring(7);
        icon = "💿";
    } else if (title.startsWith("Genre: ")) {
        cleanName = title.substring(7);
        icon = "🎸";
    }
    
    const avatarEl = document.getElementById("discover-details-avatar");
    const nameEl = document.getElementById("discover-details-name");
    const countEl = document.getElementById("discover-details-count");
    
    if (avatarEl) {
        avatarEl.style.position = "relative";
        avatarEl.style.overflow = "hidden";
        const isArtist = title.startsWith("Artist: ");
        const rad = isArtist ? "50%" : "var(--radius-md)";
        avatarEl.style.borderRadius = rad;
        
        let thumbSrc = "";
        if (isArtist) {
            thumbSrc = `/api/artist-image?artist=${encodeURIComponent(cleanName)}`;
        } else {
            const firstWithThumb = tracks.find(t => t.thumbnail_url);
            thumbSrc = firstWithThumb ? firstWithThumb.thumbnail_url : "";
        }
        
        avatarEl.innerHTML = `
            <span style="position: absolute; z-index: 1;">${icon}</span>
            ${thumbSrc ? `<img src="${thumbSrc}" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: ${rad}; z-index: 2;">` : ""}
        `;
    }
    if (nameEl) nameEl.textContent = cleanName;
    if (countEl) {
        const count = tracks.length;
        countEl.textContent = `${count} song${count !== 1 ? 's' : ''}`;
    }
    
    discoverDetailsList.innerHTML = "";
    
    tracks.forEach(t => {
        const item = document.createElement("div");
        item.className = "dir-item discover-modal-song-row";
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.justifyContent = "space-between";
        item.style.padding = "10px 14px";
        item.style.background = "rgba(255, 255, 255, 0.02)";
        item.style.border = "1px solid rgba(255, 255, 255, 0.05)";
        item.style.borderRadius = "var(--radius-md)";
        item.style.cursor = "pointer";
        item.style.transition = "background 0.2s, transform 0.2s";
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <span class="row-play-indicator" style="font-size: 0.85rem; color: var(--text-dim);">🎵</span>
                <span class="row-play-indicator-hover" style="display: none; font-size: 0.85rem; color: var(--primary);">▶</span>
                <span style="font-weight: 500; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${escapeHtml(t.title)}</span>
            </div>
            <button class="btn btn-primary play-modal-btn" style="width: 32px; height: 32px; border-radius: 50%; min-width: 0; padding: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(99,102,241,0.3); border: none; margin-left: 12px; flex-shrink: 0;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" style="transform: translateX(1px);"><path d="M8 5v14l11-7z"/></svg>
            </button>
        `;
        
        item.addEventListener("mouseenter", () => {
            item.style.background = "rgba(255, 255, 255, 0.06)";
            item.querySelector(".row-play-indicator").style.display = "none";
            item.querySelector(".row-play-indicator-hover").style.display = "inline";
        });
        item.addEventListener("mouseleave", () => {
            item.style.background = "rgba(255, 255, 255, 0.02)";
            item.querySelector(".row-play-indicator").style.display = "inline";
            item.querySelector(".row-play-indicator-hover").style.display = "none";
        });
        
        item.addEventListener("click", (e) => {
            if (e.target.closest(".play-modal-btn")) return;
            playTrack(t, tracks);
        });
        
        item.querySelector(".play-modal-btn").addEventListener("click", () => {
            playTrack(t, tracks);
        });
        
        discoverDetailsList.appendChild(item);
    });
    
    discoverDetailsModal.style.display = "flex";
}

discoverDetailsClose.addEventListener("click", () => {
    discoverDetailsModal.style.display = "none";
});


// Toast notifications
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";
    if (type === "warning") icon = "⚠️";
    
    toast.innerHTML = `
        <span style="font-size: 1.1rem; flex-shrink: 0;">${icon}</span>
        <div style="flex: 1; word-break: break-word; padding-right: 8px;">${escapeHtml(message)}</div>
        <button class="toast-close-btn" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px; flex-shrink: 0;" title="Close">×</button>
    `;
    
    const closeBtn = toast.querySelector(".toast-close-btn");
    closeBtn.addEventListener("mouseover", () => { closeBtn.style.color = "var(--text-main)"; });
    closeBtn.addEventListener("mouseout", () => { closeBtn.style.color = "var(--text-dim)"; });
    closeBtn.addEventListener("click", () => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 300);
    });
    
    container.appendChild(toast);
    
    const duration = (type === "error" || type === "warning") ? 300000 : 5000;
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add("toast-fade-out");
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Override window.alert to automatically use toasts instead of browser dialogs
window.alert = function(message) {
    let type = "info";
    const msg = message.toLowerCase();
    if (msg.includes("error") || msg.includes("failed") || msg.includes("invalid") || msg.includes("not found")) {
        type = "error";
    } else if (msg.includes("success") || msg.includes("complete") || msg.includes("saved") || msg.includes("uploaded") || msg.includes("deleted")) {
        type = "success";
    } else if (msg.includes("warning") || msg.includes("please")) {
        type = "warning";
    }
    showToast(message, type);
};

// Sync Controls: Pause / Stop
if (syncPauseBtn) {
    syncPauseBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        try {
            const res = await fetch(`/api/sync/pause?username=${activeProfile}`, { method: "POST" });
            const data = await res.json();
            if (data.paused) {
                syncPauseText.textContent = "Resume Sync";
                syncPauseIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`; // Play icon
                showToast("Synchronization paused.", "info");
                appendTerminalLine("[System] Synchronization paused by user.");
            } else {
                syncPauseText.textContent = "Pause Sync";
                syncPauseIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`; // Pause icon
                showToast("Synchronization resumed.", "info");
                appendTerminalLine("[System] Synchronization resumed.");
            }
        } catch (e) {
            console.error("Failed to pause sync", e);
        }
    });
}

if (syncStopBtn) {
    syncStopBtn.addEventListener("click", async () => {
        if (!activeProfile) return;
        try {
            await fetch(`/api/sync/stop?username=${activeProfile}`, { method: "POST" });
            showToast("Stopping synchronization...", "warning");
            appendTerminalLine("[System] Stop request sent. Aborting remaining downloads...");
        } catch (e) {
            console.error("Failed to stop sync", e);
        }
    });
}

// Toggle Logs Header collapse/expand
const toggleLogsHeader = document.getElementById("toggle-logs-header");
const logsToggleArrow = document.getElementById("logs-toggle-arrow");

if (toggleLogsHeader && terminalBody) {
    toggleLogsHeader.addEventListener("click", (e) => {
        if (e.target.closest("#copy-logs-btn") || e.target.closest("#clear-logs-btn") || e.target.closest("#maximize-logs-btn")) return;
        
        // If maximized, keep it open (do not toggle collapse)
        if (terminalCard.classList.contains("terminal-maximized")) return;
        
        const isHidden = terminalBody.style.display === "none";
        terminalBody.style.display = isHidden ? "flex" : "none";
        if (logsToggleArrow) {
            logsToggleArrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
        }
    });
}

// Seek Bar Music Visualizer Logic
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let biquadFilter = null;
let visualizerDataArray = null;
let visualizerInitialized = false;
let visualizerAnimationId = null;

function initVisualizer() {
    if (visualizerInitialized) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // Small bin size for neat columns
        
        biquadFilter = audioCtx.createBiquadFilter();
        
        const localAudio = document.getElementById("local-audio-element");
        if (localAudio) {
            localAudio.crossOrigin = "anonymous";
            sourceNode = audioCtx.createMediaElementSource(localAudio);
            sourceNode.connect(biquadFilter);
            biquadFilter.connect(analyser);
            analyser.connect(audioCtx.destination);
            
            const bufferLength = analyser.frequencyBinCount;
            visualizerDataArray = new Uint8Array(bufferLength);
            visualizerInitialized = true;
            
            const eqPreset = document.getElementById("setting-eq-preset")?.value || "flat";
            applyEqualizerPreset(eqPreset);
        }
    } catch (e) {
        console.error("Seek bar visualizer AudioContext failed to initialize:", e);
    }
}

function applyEqualizerPreset(preset) {
    if (!biquadFilter) return;
    if (preset === "bass_boost") {
        biquadFilter.type = "lowshelf";
        biquadFilter.frequency.value = 250;
        biquadFilter.gain.value = 6;
    } else if (preset === "treble_boost") {
        biquadFilter.type = "highshelf";
        biquadFilter.frequency.value = 3500;
        biquadFilter.gain.value = 5;
    } else if (preset === "vocal_boost") {
        biquadFilter.type = "peaking";
        biquadFilter.frequency.value = 1200;
        biquadFilter.Q.value = 1;
        biquadFilter.gain.value = 4;
    } else {
        biquadFilter.type = "allpass";
        biquadFilter.gain.value = 0;
    }
}

// Unsaved Settings Protection & Settings Input Change Detectors
let isSettingsDirty = false;
let pendingTabTarget = null;

document.querySelectorAll("#tab-settings input, #tab-settings select").forEach(input => {
    input.addEventListener("change", () => { isSettingsDirty = true; });
    input.addEventListener("input", () => { isSettingsDirty = true; });
});

// Settings Seekbar Style Dropdown Listener
if (settingSeekbarStyle) {
    settingSeekbarStyle.value = visualizerStyleMode;
    settingSeekbarStyle.addEventListener("change", () => {
        visualizerStyleMode = settingSeekbarStyle.value;
        try { localStorage.setItem("musicgrabber_seekbar_style", visualizerStyleMode); } catch (e) {}
    });
}

// Settings Equalizer Preset Dropdown Listener
if (settingEqPreset) {
    settingEqPreset.addEventListener("change", () => {
        applyEqualizerPreset(settingEqPreset.value);
    });
}

// Intercept sidebar tab navigation when Settings has unsaved edits
document.querySelectorAll(".nav-item[data-tab]").forEach(nav => {
    nav.addEventListener("click", (e) => {
        const targetTab = nav.getAttribute("data-tab");
        const currentActive = document.querySelector(".tab-pane.active");
        const currentActiveId = currentActive ? currentActive.id : "";
        
        if (currentActiveId === "tab-settings" && targetTab !== "settings" && isSettingsDirty) {
            e.preventDefault();
            e.stopPropagation();
            pendingTabTarget = targetTab;
            const modal = document.getElementById("unsaved-settings-modal");
            if (modal) modal.style.display = "flex";
            return false;
        }
    }, true);
});

// Unsaved Settings Modal Button Event Handlers
const unsavedSaveBtn = document.getElementById("unsaved-save-btn");
const unsavedDiscardBtn = document.getElementById("unsaved-discard-btn");
const unsavedCancelBtn = document.getElementById("unsaved-cancel-btn");
const unsavedModal = document.getElementById("unsaved-settings-modal");

if (unsavedSaveBtn) {
    unsavedSaveBtn.addEventListener("click", async () => {
        await saveSettings();
        isSettingsDirty = false;
        if (unsavedModal) unsavedModal.style.display = "none";
        if (pendingTabTarget) {
            switchTab(pendingTabTarget);
            pendingTabTarget = null;
        }
    });
}

if (unsavedDiscardBtn) {
    unsavedDiscardBtn.addEventListener("click", () => {
        isSettingsDirty = false;
        if (unsavedModal) unsavedModal.style.display = "none";
        if (pendingTabTarget) {
            switchTab(pendingTabTarget);
            pendingTabTarget = null;
        }
    });
}

if (unsavedCancelBtn) {
    unsavedCancelBtn.addEventListener("click", () => {
        pendingTabTarget = null;
        if (unsavedModal) unsavedModal.style.display = "none";
    });
}

function getTrackWaveformPeaks(track, count) {
    const seedStr = (track ? (track.id || track.title || track.filename || "") : "default_track");
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
    }
    const absHash = Math.abs(hash);

    const peaks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const norm = i / count;
        const w1 = Math.sin(norm * Math.PI * 3.2 + (absHash % 17));
        const w2 = Math.cos(norm * Math.PI * 8.4 + (absHash % 29));
        const w3 = Math.sin(norm * Math.PI * 18.6 + (absHash % 41));
        const w4 = Math.cos(norm * Math.PI * 31.2 + (absHash % 53));
        
        let amp = 0.12 + 0.78 * Math.abs(w1 * 0.4 + w2 * 0.3 + w3 * 0.2 + w4 * 0.1);
        const envelope = Math.sin(norm * Math.PI);
        amp = amp * (0.35 + 0.65 * envelope);
        peaks[i] = Math.min(1.0, Math.max(0.08, amp));
    }
    return peaks;
}

function drawVisualizerOnCanvas(canvas, canvasCtx, progress, bufferProgress, freqs, localAudio) {
    if (!canvas || !canvasCtx) return;
    
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
            canvas.width = Math.floor(rect.width);
            canvas.height = Math.floor(rect.height);
        }
    }
    
    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) return;
    
    canvasCtx.clearRect(0, 0, width, height);
    
    const playedWidth = Math.floor(progress * width);
    const bufferedWidth = Math.floor(bufferProgress * width);
    
    if (visualizerStyleMode === "solid_envelope") {
        // MODE 1: Static Continuous Waveform Silhouette Envelope (Audacity Line Style)
        const centerY = height / 2;
        const peaksUpper = new Float32Array(width);
        const peaksLower = new Float32Array(width);
        const trackPeaks = getTrackWaveformPeaks(currentPlayingTrack, width);
        
        for (let x = 0; x < width; x++) {
            const amp = trackPeaks[x] || 0.15;
            let envH = amp * (height * 0.44);
            if (envH < 2) envH = 2;
            
            peaksUpper[x] = centerY - envH;
            peaksLower[x] = centerY + envH;
        }
        
        // 1. Played Section (Gradient)
        if (playedWidth > 0) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, centerY);
            for (let x = 0; x <= playedWidth; x++) {
                canvasCtx.lineTo(x, peaksUpper[x]);
            }
            for (let x = playedWidth; x >= 0; x--) {
                canvasCtx.lineTo(x, peaksLower[x]);
            }
            canvasCtx.closePath();
            const grad = canvasCtx.createLinearGradient(0, 0, playedWidth, 0);
            grad.addColorStop(0, "#6366f1");
            grad.addColorStop(1, "#06b6d4");
            canvasCtx.fillStyle = grad;
            canvasCtx.fill();
        }
        
        // 2. Buffered Section (Translucent White)
        if (bufferedWidth > playedWidth) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(playedWidth, centerY);
            for (let x = playedWidth; x <= bufferedWidth; x++) {
                canvasCtx.lineTo(x, peaksUpper[x]);
            }
            for (let x = bufferedWidth; x >= playedWidth; x--) {
                canvasCtx.lineTo(x, peaksLower[x]);
            }
            canvasCtx.closePath();
            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.65)";
            canvasCtx.fill();
        }
        
        // 3. Unbuffered Section (Dim Translucent Grey Envelope)
        if (bufferedWidth < width) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(bufferedWidth, centerY);
            for (let x = bufferedWidth; x < width; x++) {
                canvasCtx.lineTo(x, peaksUpper[x]);
            }
            for (let x = width - 1; x >= bufferedWidth; x--) {
                canvasCtx.lineTo(x, peaksLower[x]);
            }
            canvasCtx.closePath();
            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.14)";
            canvasCtx.fill();
        }
        
        // Center Baseline Line
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, centerY);
        canvasCtx.lineTo(playedWidth, centerY);
        canvasCtx.strokeStyle = "#06b6d4";
        canvasCtx.lineWidth = 1;
        canvasCtx.stroke();

    } else if (visualizerStyleMode === "minimal_line") {
        // MODE 4: Modern Minimal Progress Line
        const centerY = height / 2;
        
        // 1. Unbuffered background line
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, centerY);
        canvasCtx.lineTo(width, centerY);
        canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        canvasCtx.lineWidth = 3;
        canvasCtx.lineCap = "round";
        canvasCtx.stroke();
        
        // 2. Buffered line (Translucent White)
        if (bufferedWidth > 0) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, centerY);
            canvasCtx.lineTo(bufferedWidth, centerY);
            canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.65)";
            canvasCtx.lineWidth = 3;
            canvasCtx.lineCap = "round";
            canvasCtx.stroke();
        }
        
        // 3. Played line (Cyan)
        if (playedWidth > 0) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, centerY);
            canvasCtx.lineTo(playedWidth, centerY);
            canvasCtx.strokeStyle = "#06b6d4";
            canvasCtx.lineWidth = 3;
            canvasCtx.lineCap = "round";
            canvasCtx.stroke();
        }
        
    } else {
        // MODE 2 & 3: Static Beat Spectrum Bars (SoundCloud / DAW Style Bars) & Thin Spectrum
        const isThin = visualizerStyleMode === "thin_bars";
        const barWidth = isThin ? 1.8 : 2.5;
        const barGap = isThin ? 1.2 : 1.8;
        const totalBarWidth = barWidth + barGap;
        const barCount = Math.floor(width / totalBarWidth);
        const barPeaks = getTrackWaveformPeaks(currentPlayingTrack, barCount);
        
        for (let i = 0; i < barCount; i++) {
            const amp = barPeaks[i] || 0.15;
            let barHeight = amp * height * 0.88;
            if (barHeight < 3) barHeight = 3;
            
            const x = i * totalBarWidth;
            const y = (height - barHeight) / 2;
            const isPlayed = x <= playedWidth;
            const isBuffered = x <= bufferedWidth;
            
            canvasCtx.beginPath();
            if (isPlayed) {
                const grad = canvasCtx.createLinearGradient(0, y, 0, y + barHeight);
                grad.addColorStop(0, "#6366f1");
                grad.addColorStop(1, "#06b6d4");
                canvasCtx.fillStyle = grad;
            } else if (isBuffered) {
                canvasCtx.fillStyle = "rgba(255, 255, 255, 0.75)";
            } else {
                canvasCtx.fillStyle = "rgba(255, 255, 255, 0.14)";
            }
            
            drawVisualizerBar(canvasCtx, x, y, barWidth, barHeight, 1);
            canvasCtx.fill();
        }
    }
}

function startVisualizerDrawLoop() {
    const miniCanvas = document.getElementById("player-progress-visualizer");
    const maxCanvas = document.getElementById("maximized-progress-visualizer");
    
    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);
        
        const localAudio = document.getElementById("local-audio-element");
        const duration = (localAudio && localAudio.duration && !isNaN(localAudio.duration)) ? localAudio.duration : 0;
        const currentTime = (localAudio && localAudio.currentTime) ? localAudio.currentTime : 0;
        
        let progress = duration > 0 ? (currentTime / duration) : 0;
        
        let bufferedEnd = 0;
        if (localAudio && localAudio.buffered && localAudio.buffered.length > 0 && duration > 0) {
            for (let i = 0; i < localAudio.buffered.length; i++) {
                if (localAudio.buffered.start(i) <= currentTime && currentTime <= localAudio.buffered.end(i)) {
                    bufferedEnd = localAudio.buffered.end(i);
                    break;
                }
                if (localAudio.buffered.end(i) > bufferedEnd) {
                    bufferedEnd = localAudio.buffered.end(i);
                }
            }
        }
        
        let bufferProgress = duration > 0 ? (bufferedEnd / duration) : 0;
        if (bufferProgress < progress) bufferProgress = progress;
        
        let freqs = [];
        if (analyser && localAudio && !localAudio.paused) {
            analyser.getByteFrequencyData(visualizerDataArray);
            for (let i = 0; i < visualizerDataArray.length; i++) {
                freqs.push(visualizerDataArray[i]);
            }
        }
        
        if (miniCanvas) {
            const miniCtx = miniCanvas.getContext("2d");
            drawVisualizerOnCanvas(miniCanvas, miniCtx, progress, bufferProgress, freqs, localAudio);
        }
        
        if (maxCanvas && (isMaximizedPlayerOpen || maxCanvas.offsetParent !== null)) {
            const maxCtx = maxCanvas.getContext("2d");
            drawVisualizerOnCanvas(maxCanvas, maxCtx, progress, bufferProgress, freqs, localAudio);
        }
    }
    
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
    }
    draw();
}

function drawVisualizerBar(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) {
        ctx.roundRect(x, y, width, height, radius);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function initHeaderClock() {
    const timeEl1 = document.getElementById("hdr-clock-time");
    const dateEl1 = document.getElementById("hdr-clock-date");
    const timeEl2 = document.getElementById("max-hdr-clock-time");
    const dateEl2 = document.getElementById("max-hdr-clock-date");
    
    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

        if (timeEl1) timeEl1.textContent = timeStr;
        if (dateEl1) dateEl1.textContent = dateStr;
        if (timeEl2) timeEl2.textContent = timeStr;
        if (dateEl2) dateEl2.textContent = dateStr;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function initHeaderWeather() {
    const iconEl1 = document.getElementById("hdr-weather-icon");
    const tempEl1 = document.getElementById("hdr-weather-temp");
    const descEl1 = document.getElementById("hdr-weather-desc");
    
    const iconEl2 = document.getElementById("max-hdr-weather-icon");
    const tempEl2 = document.getElementById("max-hdr-weather-temp");
    const descEl2 = document.getElementById("max-hdr-weather-desc");

    const hour = new Date().getHours();
    let currentW = { icon: "☀️", temp: "27°C", desc: "Sunny" };
    if (hour >= 19 || hour < 6) {
        currentW = { icon: "🌙", temp: "23°C", desc: "Clear Night" };
    } else if (hour >= 6 && hour < 12) {
        currentW = { icon: "☀️", temp: "26°C", desc: "Sunny" };
    } else if (hour >= 12 && hour < 17) {
        currentW = { icon: "🌤️", temp: "28°C", desc: "Partly Cloudy" };
    } else {
        currentW = { icon: "⛅", temp: "25°C", desc: "Clear" };
    }

    if (iconEl1) iconEl1.textContent = currentW.icon;
    if (tempEl1) tempEl1.textContent = currentW.temp;
    if (descEl1) descEl1.textContent = currentW.desc;

    if (iconEl2) iconEl2.textContent = currentW.icon;
    if (tempEl2) tempEl2.textContent = currentW.temp;
    if (descEl2) descEl2.textContent = currentW.desc;
}

function initHeaderWidgetsConfig() {
    const btn = document.getElementById("hdr-widgets-config-btn");
    const popover = document.getElementById("hdr-widgets-config-popover");
    const toggleWeather = document.getElementById("hdr-toggle-weather");
    const toggleClock = document.getElementById("hdr-toggle-clock");
    const toggleStats = document.getElementById("hdr-toggle-stats");

    const weatherWidget1 = document.getElementById("hdr-weather-widget");
    const clockWidget1 = document.getElementById("hdr-clock-widget");
    const statsWidget = document.getElementById("header-stats-widget");

    const weatherWidget2 = document.getElementById("max-hdr-weather-widget");
    const clockWidget2 = document.getElementById("max-hdr-clock-widget");

    let savedConfig = { weather: true, clock: true, stats: true };
    try {
        const str = localStorage.getItem("musicgrabber_header_widgets");
        if (str) savedConfig = Object.assign(savedConfig, JSON.parse(str));
    } catch (e) {}

    function applyVisibility() {
        const wDisplay = savedConfig.weather ? "flex" : "none";
        const cDisplay = savedConfig.clock ? "flex" : "none";
        const sDisplay = savedConfig.stats ? "flex" : "none";

        if (weatherWidget1) weatherWidget1.style.display = wDisplay;
        if (weatherWidget2) weatherWidget2.style.display = wDisplay;

        if (clockWidget1) clockWidget1.style.display = cDisplay;
        if (clockWidget2) clockWidget2.style.display = cDisplay;

        if (statsWidget) statsWidget.style.display = sDisplay;

        if (toggleWeather) toggleWeather.checked = savedConfig.weather;
        if (toggleClock) toggleClock.checked = savedConfig.clock;
        if (toggleStats) toggleStats.checked = savedConfig.stats;

        try {
            localStorage.setItem("musicgrabber_header_widgets", JSON.stringify(savedConfig));
        } catch (e) {}
    }

    if (btn && popover) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = popover.style.display === "block";
            popover.style.display = isOpen ? "none" : "block";
        });

        document.addEventListener("click", (e) => {
            if (popover && !popover.contains(e.target) && e.target !== btn) {
                popover.style.display = "none";
            }
        });
    }

    if (toggleWeather) {
        toggleWeather.addEventListener("change", (e) => {
            savedConfig.weather = e.target.checked;
            applyVisibility();
        });
    }
    if (toggleClock) {
        toggleClock.addEventListener("change", (e) => {
            savedConfig.clock = e.target.checked;
            applyVisibility();
        });
    }
    if (toggleStats) {
        toggleStats.addEventListener("change", (e) => {
            savedConfig.stats = e.target.checked;
            applyVisibility();
        });
    }

    applyVisibility();
}

// Window Load Handler
window.addEventListener("load", () => {
    restoreSavedVolume();
    loadProfiles();
    startVisualizerDrawLoop();
    initSeekbarRadioCards();
    initHeaderClock();
    initHeaderWeather();
    initHeaderWidgetsConfig();

    // Bottom Player Artwork Hover Popover handlers
    const artBtn = document.getElementById("player-album-art");
    const trackInfoBtn = document.querySelector(".player-track-info");
    const hoverPreview = document.getElementById("player-art-hover-preview");
    if (hoverPreview && (artBtn || trackInfoBtn)) {
        const showHover = () => hoverPreview.classList.add("show-hover");
        const hideHover = () => hoverPreview.classList.remove("show-hover");
        if (artBtn) {
            artBtn.addEventListener("mouseenter", showHover);
            artBtn.addEventListener("mouseleave", hideHover);
        }
        if (trackInfoBtn) {
            trackInfoBtn.addEventListener("mouseenter", showHover);
            trackInfoBtn.addEventListener("mouseleave", hideHover);
        }
    }

    // Dual Subtab Switching (To Be Downloaded vs Downloaded Files)
    const subtabToDownloadBtn = document.getElementById("subtab-to-download-btn");
    const subtabDownloadedBtn = document.getElementById("subtab-downloaded-btn");
    const paneToDownload = document.getElementById("pane-to-download");
    const paneDownloadedFiles = document.getElementById("pane-downloaded-files");

    if (subtabToDownloadBtn && subtabDownloadedBtn && paneToDownload && paneDownloadedFiles) {
        subtabToDownloadBtn.addEventListener("click", () => {
            subtabToDownloadBtn.classList.add("active");
            subtabDownloadedBtn.classList.remove("active");
            paneToDownload.style.display = "block";
            paneDownloadedFiles.style.display = "none";
            if (activeProfile) {
                localStorage.setItem(`musicgrabber_sync_subtab_${activeProfile}`, "to-download");
            }
        });
        
        subtabDownloadedBtn.addEventListener("click", () => {
            subtabDownloadedBtn.classList.add("active");
            subtabToDownloadBtn.classList.remove("active");
            paneDownloadedFiles.style.display = "block";
            paneToDownload.style.display = "none";
            if (activeProfile) {
                localStorage.setItem(`musicgrabber_sync_subtab_${activeProfile}`, "downloaded");
            }
        });

        // Restore saved sync subtab
        try {
            const savedSyncSubtab = activeProfile ? localStorage.getItem(`musicgrabber_sync_subtab_${activeProfile}`) : "to-download";
            if (savedSyncSubtab === "downloaded") {
                subtabDownloadedBtn.classList.add("active");
                subtabToDownloadBtn.classList.remove("active");
                paneDownloadedFiles.style.display = "block";
                paneToDownload.style.display = "none";
            }
        } catch(e) {}
    }

    // Multi-tab Storage Event Listener for Cross-Tab Sync
    window.addEventListener("storage", (e) => {
        if (e.key === "musicgrabber_volume" && e.newValue) {
            restoreSavedVolume();
        }
        if (activeProfile && e.key === `musicgrabber_active_tab_${activeProfile}` && e.newValue) {
            switchTab(e.newValue);
        }
    });

    // Discover Search Input Handler
    const discoverSearchInput = document.getElementById("discover-search-input");
    if (discoverSearchInput) {
        discoverSearchInput.addEventListener("input", (e) => {
            discoverSearchQuery = e.target.value;
            renderDiscoverPage();
        });
    }

    // Manual Refresh Button
    const refreshFilesBtn = document.getElementById("refresh-files-btn");
    if (refreshFilesBtn) {
        refreshFilesBtn.addEventListener("click", async () => {
            showToast("Refreshing files and queued tracks...", "info");
            await loadFiles();
            await loadToDownloadList();
            showToast("Files list refreshed.", "success");
        });
    }

    // Refresh YouTube Music Recommendations Button
    const refreshYtDiscoverBtn = document.getElementById("refresh-ytmusic-discover-btn");
    if (refreshYtDiscoverBtn) {
        refreshYtDiscoverBtn.addEventListener("click", () => {
            loadYtMusicDiscoverData();
        });
    }

    // YouTube Music Search Bar & Suggestions Handler
    const ytSearchInput = document.getElementById("ytmusic-search-input");
    const ytSearchBtn = document.getElementById("ytmusic-search-btn");
    const suggestionsBox = document.getElementById("ytmusic-suggestions-box");
    let suggestDebounce = null;

    if (ytSearchInput) {
        ytSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            if (suggestDebounce) clearTimeout(suggestDebounce);
            if (!query) {
                if (suggestionsBox) suggestionsBox.style.display = "none";
                return;
            }
            suggestDebounce = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/ytmusic/suggestions?query=${encodeURIComponent(query)}`);
                    if (res.ok) {
                        const data = await res.json();
                        const suggestions = data.suggestions || [];
                        if (suggestions.length > 0 && suggestionsBox) {
                            suggestionsBox.innerHTML = "";
                            suggestions.forEach(item => {
                                const div = document.createElement("div");
                                div.style.cssText = "padding: 8px 12px; font-size: 0.82rem; color: var(--text-main); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 8px;";
                                div.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> ${escapeHtml(item)}`;
                                div.addEventListener("click", () => {
                                    ytSearchInput.value = item;
                                    suggestionsBox.style.display = "none";
                                    searchYtMusic(item);
                                });
                                div.addEventListener("mouseenter", () => {
                                    div.style.background = "rgba(255,255,255,0.08)";
                                });
                                div.addEventListener("mouseleave", () => {
                                    div.style.background = "transparent";
                                });
                                suggestionsBox.appendChild(div);
                            });
                            suggestionsBox.style.display = "flex";
                        } else if (suggestionsBox) {
                            suggestionsBox.style.display = "none";
                        }
                    }
                } catch (err) {
                    console.error("Error fetching suggestions:", err);
                }
            }, 200);
        });

        ytSearchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                if (suggestionsBox) suggestionsBox.style.display = "none";
                searchYtMusic(ytSearchInput.value);
            }
        });
        
        document.addEventListener("click", (e) => {
            if (suggestionsBox && !ytSearchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = "none";
            }
        });
    }

    if (ytSearchBtn && ytSearchInput) {
        ytSearchBtn.addEventListener("click", () => {
            if (suggestionsBox) suggestionsBox.style.display = "none";
            searchYtMusic(ytSearchInput.value);
        });
    }

    // Export Playlists Button
    const exportPlaylistsBtn = document.getElementById("export-playlists-btn");
    if (exportPlaylistsBtn) {
        exportPlaylistsBtn.addEventListener("click", () => {
            if (!activeProfile) return;
            window.location.href = `/api/playlists/export?username=${activeProfile}`;
        });
    }

    // Import Playlists Button & File Input
    const importPlaylistsBtn = document.getElementById("import-playlists-btn");
    const importPlaylistsFileInput = document.getElementById("import-playlists-file-input");
    if (importPlaylistsBtn && importPlaylistsFileInput) {
        importPlaylistsBtn.addEventListener("click", () => {
            if (!activeProfile) return;
            importPlaylistsFileInput.click();
        });

        importPlaylistsFileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                const sources = json.sources || (Array.isArray(json) ? json : []);
                if (sources.length === 0) {
                    showToast("No valid playlist sources found in JSON file.", "warning");
                    return;
                }
                const res = await fetch("/api/playlists/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: activeProfile,
                        sources: sources
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message, "success");
                    await loadConfig(activeProfile);
                    renderSourcesList();
                } else {
                    showToast("Failed to import playlists: " + (data.detail || "Error"), "danger");
                }
            } catch (err) {
                showToast("Invalid JSON file format: " + err.message, "danger");
            } finally {
                importPlaylistsFileInput.value = "";
            }
        });
    }
});

// YouTube Music Recommendations Handler
async function loadYtMusicDiscoverData() {
    if (!activeProfile) return;
    const playlistsGrid = document.getElementById("ytmusic-playlists-grid");
    const songsBody = document.getElementById("ytmusic-songs-table-body");
    
    if (playlistsGrid) playlistsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 24px;"><span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Loading YouTube Music recommendations...</div>`;
    if (songsBody) songsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 24px;"><span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Loading recommendations...</td></tr>`;
    
    const resetBtn = document.getElementById("ytmusic-reset-songs-btn");
    if (resetBtn) {
        resetBtn.onclick = () => {
            resetBtn.style.display = "none";
            const titleEl = document.getElementById("ytmusic-songs-section-title");
            if (titleEl) titleEl.textContent = "Recommended Songs for You";
            if (window.ytmusicQuickPicksData) {
                renderYtMusicSongsTable(window.ytmusicQuickPicksData);
            } else {
                loadYtMusicDiscoverData();
            }
        };
    }

    try {
        const res = await fetch(`/api/ytmusic/discover?username=${activeProfile}`);
        if (!res.ok) throw new Error("Failed to load recommendations");
        const data = await res.json();
        
        // Render Recommended Playlists
        if (playlistsGrid) {
            playlistsGrid.innerHTML = "";
            const playlists = data.recommended_playlists || [];
            playlists.forEach(pl => {
                const card = document.createElement("div");
                card.className = "glass-card";
                card.style.cssText = "width: 200px; min-width: 200px; max-width: 200px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: rgba(255,255,255,0.02); transition: transform 0.2s, border-color 0.2s; cursor: pointer;";
                const thumbUrl = pl.thumbnail || "";
                card.innerHTML = `
                    <div>
                        <div style="width: 100%; aspect-ratio: 1/1; border-radius: var(--radius-sm); overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); flex-shrink: 0; position: relative;">
                            <svg viewBox="0 0 24 24" width="44" height="44" fill="white" style="opacity: 0.9;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                            ${thumbUrl ? `<img src="${thumbUrl}" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover;" onerror="this.remove();">` : ""}
                        </div>
                        <div style="min-width: 0; margin-bottom: 10px;">
                            <h4 style="margin: 0 0 4px 0; font-size: 0.92rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</h4>
                            <p style="font-size: 0.75rem; color: var(--text-dim); margin: 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(pl.description)}</p>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm add-yt-playlist-btn" style="padding: 5px 12px; font-size: 0.75rem; font-weight: 600; align-self: flex-start; border-radius: 20px; width: auto; display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        <span>Add to Library</span>
                    </button>
                `;
                
                // Clicking Add to Library button
                card.querySelector(".add-yt-playlist-btn").addEventListener("click", (e) => {
                    e.stopPropagation();
                    addYtMusicPlaylistSource(pl.name, pl.url);
                });
                
                // Clicking card previews tracks on page
                card.addEventListener("click", () => {
                    previewYtMusicPlaylist(pl.name, pl.url);
                });
                
                playlistsGrid.appendChild(card);
            });
        }
        
        // Render Quick Picks / Recommended Songs
        const songs = data.quick_picks || data.trending_songs || [];
        window.ytmusicQuickPicksData = songs;
        renderYtMusicSongsTable(songs);
    } catch (e) {
        console.error("Error in loadYtMusicDiscoverData:", e);
        if (playlistsGrid) playlistsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--danger); padding: 16px;">Failed to load recommendations: ${e.message}</div>`;
    }
}

function renderYtMusicSongsTable(songs) {
    const songsBody = document.getElementById("ytmusic-songs-table-body");
    if (!songsBody) return;
    songsBody.innerHTML = "";
    if (!songs || songs.length === 0) {
        songsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 20px;">No songs found at this moment.</td></tr>`;
        return;
    }
    songs.forEach((s, idx) => {
        const tr = document.createElement("tr");
        const title = cleanMediaExtension(s.title || s.display_name || "Unknown Track");
        const artist = s.artist || "YouTube Artist";
        const songThumb = s.thumbnail || (s.id ? `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg` : "");
        const trackUrl = s.url || (s.id ? `https://www.youtube.com/watch?v=${s.id}` : "");
        const videoId = s.id || (trackUrl ? getSourceId(trackUrl) : "");
        const isLocal = isLocalTrack(s);
        let isLiked = (videoId && allLikedTracksSet.has(videoId)) || (trackUrl && allLikedTracksSet.has(trackUrl)) || allLikedTracksSet.has(title.toLowerCase());
        
        tr.dataset.title = title;
        tr.dataset.url = trackUrl;
        if (videoId) tr.dataset.videoid = videoId;

        tr.innerHTML = `
            <td style="text-align: center; font-size: 0.8rem; color: var(--text-dim); font-weight: 600;">${idx + 1}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 6px; overflow: hidden; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-glass);">
                        ${songThumb ? `<img src="${songThumb}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">` : `<svg viewBox="0 0 24 24" width="18" height="18" fill="var(--primary)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${escapeHtml(title)}</div>
                    </div>
                </div>
            </td>
            <td style="color: var(--text-dim); font-size: 0.85rem;">${escapeHtml(artist)}</td>
            <td style="text-align: right; padding-right: 12px; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                    <!-- Play Icon Button -->
                    <button class="btn btn-icon btn-sm play-yt-song-btn" title="Play Song" style="width: 30px; height: 30px; border-radius: 50%; color: var(--primary); padding: 0; display: inline-flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.15); border: 1px solid var(--primary); cursor: pointer; transition: all 0.2s ease;">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>

                    <!-- Download Icon Button -->
                    <button class="btn btn-icon btn-sm download-yt-song-btn" title="${isLocal ? 'Downloaded' : 'Download to Library'}" style="width: 30px; height: 30px; border-radius: 50%; color: ${isLocal ? '#10b981' : '#a78bfa'}; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: ${isLocal ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)'}; border: 1px solid ${isLocal ? '#10b981' : '#8b5cf6'}; cursor: pointer; transition: all 0.2s ease;">
                        ${isLocal ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`}
                    </button>

                    <!-- Like Icon Button -->
                    <button class="btn btn-icon btn-sm like-yt-song-btn" title="Like on YouTube Music" style="width: 30px; height: 30px; border-radius: 50%; color: ${isLiked ? '#ef4444' : 'var(--text-dim)'}; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-glass); cursor: pointer; transition: all 0.2s ease;">
                        ${isLiked ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`}
                    </button>
                </div>
            </td>
        `;
        
        // 1. Play Button listener
        tr.querySelector(".play-yt-song-btn").addEventListener("click", () => {
            const mockTrack = {
                title: title,
                artist: artist,
                url: trackUrl,
                thumbnail_url: songThumb
            };
            const fullQueue = songs.map(item => {
                const itemTitle = cleanMediaExtension(item.title || item.display_name || "Unknown Track");
                return {
                    title: itemTitle,
                    artist: item.artist || "YouTube Artist",
                    url: item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : ""),
                    thumbnail_url: item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg` : "")
                };
            });
            playTrack(mockTrack, fullQueue, idx);
        });

        // 2. Download Button listener
        const dlBtn = tr.querySelector(".download-yt-song-btn");
        if (dlBtn) {
            dlBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (isLocalTrack(s)) {
                    showToast(`"${title}" is already in your library!`, "info");
                    return;
                }
                dlBtn.disabled = true;
                dlBtn.innerHTML = `<div class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></div>`;
                showToast(`Downloading "${title}" to your library...`, "info");
                
                try {
                    const res = await fetch("/api/ytmusic/download-track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: activeProfile,
                            url: trackUrl,
                            title: title,
                            artist: artist
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast(`Downloaded "${title}" to Library!`, "success");
                        updateDownloadedFilesSet([{ name: title }]);
                        dlBtn.style.color = "#10b981";
                        dlBtn.style.background = "rgba(16, 185, 129, 0.15)";
                        dlBtn.style.borderColor = "#10b981";
                        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                        if (typeof loadFiles === "function") loadFiles();
                    } else {
                        throw new Error(data.detail || "Download failed");
                    }
                } catch (err) {
                    showToast(`Download failed: ${err.message}`, "danger");
                    dlBtn.disabled = false;
                    dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
                }
            });
        }

        // 3. Like Button listener
        const likeBtn = tr.querySelector(".like-yt-song-btn");
        if (likeBtn) {
            likeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                isLiked = !isLiked;
                const newRating = isLiked ? "LIKE" : "INDIFFERENT";
                if (isLiked) {
                    if (videoId) allLikedTracksSet.add(videoId);
                    if (trackUrl) allLikedTracksSet.add(trackUrl);
                    allLikedTracksSet.add(title.toLowerCase());

                    likeBtn.style.color = "#ef4444";
                    likeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                    showToast(`Liked "${title}" on YouTube Music & added to Liked Music!`, "success");
                } else {
                    if (videoId) allLikedTracksSet.delete(videoId);
                    if (trackUrl) allLikedTracksSet.delete(trackUrl);
                    allLikedTracksSet.delete(title.toLowerCase());

                    likeBtn.style.color = "var(--text-dim)";
                    likeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                    showToast(`Removed rating for "${title}"`, "info");
                }
                
                try {
                    await fetch("/api/ytmusic/rate-track", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: activeProfile,
                            video_id: videoId,
                            url: trackUrl,
                            rating: newRating,
                            title: title,
                            artist: artist
                        })
                    });
                } catch (err) {
                    console.error("Error liking song from row:", err);
                }
            });
        }
        
        songsBody.appendChild(tr);
    });

    // 1 SINGLE BATCH RATING QUERY FOR ALL SONGS IN PLAYLIST
    if (activeProfile && songs.length > 0) {
        const videoIdsToFetch = songs
            .map(item => item.id || (item.url ? getSourceId(item.url) : ""))
            .filter(id => id && !allLikedTracksSet.has(id));
            
        if (videoIdsToFetch.length > 0) {
            fetch("/api/ytmusic/batch-track-ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: activeProfile,
                    video_ids: videoIdsToFetch
                })
            })
            .then(r => r.json())
            .then(data => {
                const ratings = data.ratings || {};
                Object.keys(ratings).forEach(vId => {
                    if (ratings[vId] === "LIKE") {
                        allLikedTracksSet.add(vId);
                        const trEl = songsBody.querySelector(`tr[data-videoid="${vId}"]`);
                        if (trEl) {
                            const likeBtnEl = trEl.querySelector(".like-yt-song-btn");
                            if (likeBtnEl) {
                                likeBtnEl.style.color = "#ef4444";
                                likeBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                            }
                        }
                    }
                });
            })
            .catch(e => console.error("Batch track ratings fetch error:", e));
        }
    }

    highlightActivePlayingRows();
}

async function searchYtMusic(query) {
    if (!activeProfile || !query || !query.trim()) return;
    const playlistsGrid = document.getElementById("ytmusic-playlists-grid");
    const songsBody = document.getElementById("ytmusic-songs-table-body");
    
    const cleanQuery = query.trim();
    showToast(`Searching YouTube Music for "${cleanQuery}"...`, "info");
    
    if (playlistsGrid) playlistsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 24px;"><span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Searching playlists for "${escapeHtml(cleanQuery)}"...</div>`;
    if (songsBody) songsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 24px;"><span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Searching songs...</td></tr>`;
    
    try {
        const res = await fetch(`/api/ytmusic/search?username=${activeProfile}&query=${encodeURIComponent(cleanQuery)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        
        // Render Search Playlists
        if (playlistsGrid) {
            playlistsGrid.innerHTML = "";
            const playlists = data.playlists || [];
            if (playlists.length === 0) {
                playlistsGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-dim); padding: 16px;">No playlists found for "${escapeHtml(cleanQuery)}".</div>`;
            } else {
                playlists.forEach(pl => {
                    const card = document.createElement("div");
                    card.className = "glass-card";
                    card.style.cssText = "width: 200px; min-width: 200px; max-width: 200px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; border: 1px solid var(--border-glass); border-radius: var(--radius-md); background: rgba(255,255,255,0.02); transition: transform 0.2s, border-color 0.2s; cursor: pointer;";
                    const thumbUrl = pl.thumbnail || "";
                    card.innerHTML = `
                        <div>
                            <div style="width: 100%; aspect-ratio: 1/1; border-radius: var(--radius-sm); overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); flex-shrink: 0; position: relative;">
                                <svg viewBox="0 0 24 24" width="44" height="44" fill="white" style="opacity: 0.9;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                                ${thumbUrl ? `<img src="${thumbUrl}" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover;" onerror="this.remove();">` : ""}
                            </div>
                            <div style="min-width: 0; margin-bottom: 10px;">
                                <h4 style="margin: 0 0 4px 0; font-size: 0.92rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(pl.name)}">${escapeHtml(pl.name)}</h4>
                                <p style="font-size: 0.75rem; color: var(--text-dim); margin: 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(pl.description)}</p>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm add-yt-playlist-btn" style="padding: 5px 12px; font-size: 0.75rem; font-weight: 600; align-self: flex-start; border-radius: 20px; width: auto; display: flex; align-items: center; gap: 5px;">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            <span>Add to Library</span>
                        </button>
                    `;
                    card.querySelector(".add-yt-playlist-btn").addEventListener("click", (e) => {
                        e.stopPropagation();
                        addYtMusicPlaylistSource(pl.name, pl.url);
                    });
                    card.addEventListener("click", () => {
                        previewYtMusicPlaylist(pl.name, pl.url);
                    });
                    playlistsGrid.appendChild(card);
                });
            }
        }
        
        // Render Search Songs
        const songs = data.songs || [];
        renderYtMusicSongsTable(songs);
    } catch (e) {
        showToast("Error searching YouTube Music: " + e.message, "danger");
    }
}

async function previewYtMusicPlaylist(name, url) {
    if (!activeProfile) return;
    const titleEl = document.getElementById("ytmusic-songs-section-title");
    const resetBtn = document.getElementById("ytmusic-reset-songs-btn");
    const songsBody = document.getElementById("ytmusic-songs-table-body");
    
    if (titleEl) titleEl.textContent = `Songs in: ${name}`;
    if (resetBtn) resetBtn.style.display = "inline-flex";
    if (songsBody) songsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 24px;"><span class="spinner" style="width:20px; height:20px; border-width:2px; border-top-color:var(--primary); margin-right:8px;"></span> Loading tracks for ${escapeHtml(name)}...</td></tr>`;
    
    // Smooth scroll down to songs section
    if (titleEl) titleEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    try {
        const res = await fetch(`/api/ytmusic/playlist-tracks?username=${activeProfile}&url=${encodeURIComponent(url)}`);
        if (res.ok) {
            const data = await res.json();
            const tracks = data.tracks || [];
            renderYtMusicSongsTable(tracks);
        } else {
            if (songsBody) songsBody.innerHTML = `<tr><td colspan="4" style="color: var(--danger); padding: 16px; text-align: center;">Unable to load playlist tracks. If this is a private playlist, please upload your youtube_cookies.txt in Settings.</td></tr>`;
        }
    } catch (e) {
        if (songsBody) songsBody.innerHTML = `<tr><td colspan="4" style="color: var(--danger); padding: 16px; text-align: center;">Error loading tracks: ${e.message}</td></tr>`;
    }
}

async function addYtMusicPlaylistSource(name, url) {
    if (!activeProfile) return;
    try {
        const res = await fetch("/api/ytmusic/add-source", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: activeProfile,
                name: name,
                url: url,
                type: "youtube_music_playlist"
            })
        });
        const data = await res.json();
        if (res.ok) {
            if (data.status === "exists") {
                showToast(data.message, "warning");
            } else {
                showToast(data.message, "success");
                await loadConfig(activeProfile);
                renderSourcesList();
            }
        } else {
            showToast("Failed to add playlist: " + (data.detail || "Error"), "danger");
        }
    } catch (e) {
        showToast("Error adding playlist: " + e.message, "danger");
    }
}

// Initial Application Load - Clean Guarded Single Trigger
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        if (!hasProfilesLoaded) loadProfiles();
    });
} else {
    loadProfiles();
}
