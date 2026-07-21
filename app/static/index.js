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
let currentQueueIndex = -1;
let currentPlayingTrack = null;
let discoverData = null;

// DOM Elements
const profileSelect = document.getElementById("profile-select");
const addProfileBtn = document.getElementById("add-profile-btn");
const profileWarning = document.getElementById("profile-warning");
const tabPanes = document.querySelectorAll(".tab-pane");
const navItems = document.querySelectorAll(".nav-item");

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
const saveSettingsBtn = document.getElementById("save-settings-btn");
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

// Fetch available profiles
async function loadProfiles() {
    try {
        const res = await fetch("/api/profiles?t=" + Date.now());
        const data = await res.json();
        profiles = data.profiles || [];
        
        // Populate select
        profileSelect.innerHTML = '<option value="" disabled selected>Select Profile</option>';
        profiles.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p;
            opt.textContent = p;
            profileSelect.appendChild(opt);
        });

        // Autoselect first profile if available
        if (profiles.length > 0) {
            profileSelect.value = profiles[0];
            handleProfileChange(profiles[0]);
        }
    } catch (e) {
        console.error("Failed to load profiles", e);
    }
}

// Handle Profile Change
async function handleProfileChange(username) {
    activeProfile = username;
    
    // Hide warning and show active pane
    profileWarning.classList.remove("active-pane");
    
    // Load config
    await loadConfig(username);
    
    // Refresh status, downloaded files, discover data, and source sidebar
    refreshStatus();
    loadFiles();
    renderSourcesList();
    loadDiscoverData();
    
    // Reset playlist details pane
    noPlaylistSelectedView.style.display = "flex";
    playlistActiveView.style.display = "none";
    activePlaylistSourceId = "";
    
    // Auto switch to sync tab
    switchTab("tab-sync");
}

// Load Configuration from server
async function loadConfig(username) {
    try {
        const res = await fetch(`/api/config?username=${username}&t=${Date.now()}`);
        activeConfig = await res.json();
        populateSettingsForm();
        await refreshCookiesStatus(username);
    } catch (e) {
        console.error("Failed to load config", e);
    }
}

// Fetch and display cookies status
async function refreshCookiesStatus(username) {
    if (!username) return;
    
    // Reset file input and display
    settingCookiesFile.value = "";
    selectedCookiesFilename.textContent = "No file selected";
    uploadCookiesBtn.style.display = "none";
    
    try {
        const res = await fetch(`/api/cookies/status?username=${username}&t=${Date.now()}`);
        const data = await res.json();
        
        if (data.status === "loaded") {
            cookiesStatusBadge.className = "badge badge-success";
            cookiesStatusBadge.textContent = `Cookies Active (${data.filename})`;
            deleteCookiesBtn.style.display = "inline-block";
        } else {
            cookiesStatusBadge.className = "badge badge-danger";
            cookiesStatusBadge.textContent = "Cookies Missing";
            deleteCookiesBtn.style.display = "none";
        }
    } catch (e) {
        console.error("Failed to load cookies status", e);
        cookiesStatusBadge.className = "badge badge-warning";
        cookiesStatusBadge.textContent = "Status Unknown";
        deleteCookiesBtn.style.display = "none";
    }
}

// Directory Browser Navigation
async function fetchDirectory(path) {
    dirBrowserList.innerHTML = '<div class="spinner-container" style="padding: 20px;"><div class="spinner"></div></div>';
    
    try {
        const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}&t=${Date.now()}`);
        if (!res.ok) throw new Error("Failed to list directory");
        const data = await res.json();
        
        currentBrowserPath = data.current_path;
        parentBrowserPath = data.parent_path;
        
        dirBrowserPath.textContent = currentBrowserPath;
        
        // Show/hide up button
        if (parentBrowserPath) {
            dirBrowserUpBtn.style.display = "inline-flex";
        } else {
            dirBrowserUpBtn.style.display = "none";
        }
        
        // Render subdirectories
        dirBrowserList.innerHTML = "";
        if (data.subdirectories.length === 0) {
            dirBrowserList.innerHTML = '<div class="empty-sources" style="padding: 16px 0;">No subdirectories found.</div>';
            return;
        }
        
        data.subdirectories.forEach(sub => {
            const item = document.createElement("div");
            item.className = "dir-item";
            item.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>${escapeHtml(sub)}</span>
            `;
            item.addEventListener("click", () => {
                const slash = currentBrowserPath.endsWith("/") ? "" : "/";
                fetchDirectory(currentBrowserPath + slash + sub);
            });
            dirBrowserList.appendChild(item);
        });
    } catch (e) {
        dirBrowserList.innerHTML = `<div class="empty-sources" style="color: var(--danger); padding: 16px 0;">Error: ${e.message}</div>`;
    }
}

// Populate Settings Form from activeConfig
function populateSettingsForm() {
    if (!activeConfig) return;
    
    if (!activeConfig.additional_library_dirs) {
        activeConfig.additional_library_dirs = [];
    }
    
    settingDownloadDir.value = activeConfig.download_dir || "";
    settingFilenamePreset.value = activeConfig.filename_template || "%(title)s.%(ext)s";
    settingEmbedMetadata.checked = activeConfig.embed_metadata !== false;
    
    const maxConc = activeConfig.max_concurrent_downloads || 3;
    settingMaxConcurrent.value = maxConc;
    rangeValueDisplay.textContent = maxConc;
    
    const autoSync = activeConfig.auto_sync === true;
    settingAutoSync.checked = autoSync;
    schedulerOptions.style.display = autoSync ? "block" : "none";
    
    // Detect schedule mode based on config
    if (activeConfig.sync_interval_hours && activeConfig.sync_interval_hours !== 24) {
        settingSyncMode.value = "interval";
        settingSyncInterval.value = activeConfig.sync_interval_hours;
        scheduleIntervalField.style.display = "block";
        scheduleTimeField.style.display = "none";
    } else {
        settingSyncMode.value = "time";
        settingSyncTime.value = activeConfig.sync_time || "02:00";
        scheduleIntervalField.style.display = "none";
        scheduleTimeField.style.display = "block";
    }
    
    renderAdditionalLibraryDirs();
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
            if (syncQuoteBox) syncQuoteBox.style.display = "flex";
            if (syncCurrentSongWrapper) syncCurrentSongWrapper.style.display = "block";
            if (syncProgressBarWrapper) syncProgressBarWrapper.style.display = "block";
            if (syncStatsWrapper) syncStatsWrapper.style.display = "flex";
            if (syncTimersWrapper) syncTimersWrapper.style.display = "grid";
            if (syncControlsWrapper) syncControlsWrapper.style.display = "flex";
            
            // Auto expand logs during sync so users see lines stream in
            if (terminalBody) terminalBody.style.display = "flex";
            if (logsToggleArrow) logsToggleArrow.style.transform = "rotate(180deg)";
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
            if (syncPauseText) syncPauseText.textContent = "Pause Sync";
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
        renderFilesList(allDownloadedFiles);
        await loadToDownloadList();
    } catch (e) {
        console.error("Failed to load directory files", e);
    }
}

async function loadToDownloadList() {
    if (!activeProfile || !activeConfig || !activeConfig.sources) return;
    
    allToDownloadTracks = [];
    const downloadedNames = new Set(allDownloadedFiles.map(f => f.name.toLowerCase()));
    
    for (const src of activeConfig.sources) {
        try {
            const res = await fetch(`/api/playlist/tracks?username=${activeProfile}&source_id=${src.id}`);
            if (res.ok) {
                const tracks = await res.json();
                const disabled = new Set(src.disabled_track_ids || []);
                tracks.forEach(t => {
                    if (!disabled.has(t.id)) {
                        const title = t.title || t.display_name || "";
                        const estFilename = (activeConfig.filename_template || "%(title)s.%(ext)s")
                            .replace("%(title)s", title)
                            .replace("%(artist)s", t.artist || "")
                            .replace("%(id)s", t.id || "")
                            .replace("%(ext)s", "mp3");
                        const cleanName = estFilename.split("/").pop().split("\\").pop().toLowerCase();
                        
                        if (!downloadedNames.has(cleanName)) {
                            allToDownloadTracks.push({
                                ...t,
                                source_name: src.name || "Playlist",
                                est_path: activeConfig.download_dir ? `${activeConfig.download_dir}/${cleanName}` : cleanName
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
        tbody.innerHTML = `<tr><td colspan="4" class="empty-table">All playlist songs are downloaded and up-to-date!</td></tr>`;
        return;
    }
    
    const showPaths = document.getElementById("toggle-file-paths-checkbox")?.checked;
    const pathDisplay = showPaths ? "table-cell" : "none";
    
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
            <td class="file-path-cell" style="display: ${pathDisplay};">${escapeHtml(t.est_path)}</td>
        `;
        
        tr.querySelector(".play-queued-track-btn").addEventListener("click", () => {
            playTrack(t, tracks, idx);
        });
        
        tbody.appendChild(tr);
    });
}

function renderFilesList(files) {
    if (filesCountText) filesCountText.textContent = `${files.length} files`;
    
    if (files.length === 0) {
        filesTableBody.innerHTML = `<tr><td colspan="4" class="empty-table">No audio files found. Verify your Save Path in Settings.</td></tr>`;
        return;
    }
    
    const showPaths = document.getElementById("toggle-file-paths-checkbox")?.checked;
    const pathDisplay = showPaths ? "table-cell" : "none";
    
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
            <td class="file-path-cell" style="display: ${pathDisplay};">${escapeHtml(f.path)}</td>
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
        
        tbody.appendChild(tr);
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
        if (!res.ok) throw new Error("API failed");
        
        const data = await res.json();
        currentTracks = data.tracks || [];
        
        renderTracksList(currentTracks);
    } catch (e) {
        tracksItemsContainer.innerHTML = `<div class="empty-tracks-view"><p style="color: var(--danger)">Error fetching playlist tracks: ${e.message}</p></div>`;
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

// Save Settings Button
saveSettingsBtn.addEventListener("click", async () => {
    if (!activeProfile || !activeConfig) return;
    
    activeConfig.download_dir = settingDownloadDir.value.trim();
    activeConfig.filename_template = settingFilenamePreset.value;
    activeConfig.embed_metadata = settingEmbedMetadata.checked;
    activeConfig.max_concurrent_downloads = parseInt(settingMaxConcurrent.value);
    
    const autoSync = settingAutoSync.checked;
    activeConfig.auto_sync = autoSync;
    
    if (autoSync) {
        const mode = settingSyncMode.value;
        if (mode === "interval") {
            activeConfig.sync_interval_hours = parseInt(settingSyncInterval.value);
            activeConfig.sync_time = "";
        } else {
            activeConfig.sync_interval_hours = 24;
            activeConfig.sync_time = settingSyncTime.value;
        }
    } else {
        activeConfig.sync_interval_hours = 0;
        activeConfig.sync_time = "";
    }
    
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = "Saving...";
    
    try {
        const res = await fetch(`/api/config?username=${activeProfile}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeConfig)
        });
        if (res.ok) {
            const data = await res.json();
            alert(data.message || "Settings saved successfully.");
            await loadConfig(activeProfile);
            refreshStatus();
            loadFiles();
        } else {
            const err = await res.json();
            alert(`Error saving settings: ${err.detail}`);
        }
    } catch (e) {
        alert(`Failed to save configuration: ${e.message}`);
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = "Save Settings";
    }
});

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

// Manual Sync Triggers (SSE Logs)
syncNowBtn.addEventListener("click", () => {
    if (!activeProfile || eventSource) return;
    
    terminalBody.innerHTML = '<span class="system-line">[System] Triggering synchronization...</span>';
    syncBadge.className = "badge badge-syncing";
    syncBadge.textContent = "Syncing";
    syncNowBtn.disabled = true;
    
    // Reset and show modal
    let totalTracks = 0;
    let processedTracks = 0;
    const syncStartTime = Date.now();
    let syncTimer = null;
    let quoteTimer = null;
    
    syncProgressModal.style.display = "flex";
    syncModalClose.style.display = "none";
    syncModalTitle.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; border-top-color: var(--primary); margin: 0;"></span> Syncing Library...';
    syncCurrentSong.textContent = "Scanning local library...";

    // Ensure all stats/meters are visible during manual sync trigger
    const syncQuoteBox = document.getElementById("sync-quote-box");
    const syncCurrentSongWrapper = document.getElementById("sync-current-song-wrapper");
    const syncProgressBarWrapper = document.getElementById("sync-progress-bar-wrapper");
    const syncStatsWrapper = document.getElementById("sync-stats-wrapper");
    const syncTimersWrapper = document.getElementById("sync-timers-wrapper");

    if (syncQuoteBox) syncQuoteBox.style.display = "flex";
    if (syncCurrentSongWrapper) syncCurrentSongWrapper.style.display = "block";
    if (syncProgressBarWrapper) syncProgressBarWrapper.style.display = "block";
    if (syncStatsWrapper) syncStatsWrapper.style.display = "flex";
    if (syncTimersWrapper) syncTimersWrapper.style.display = "grid";
    if (syncControlsWrapper) syncControlsWrapper.style.display = "flex";

    // Expand the logs console so lines stream in
    if (terminalBody) terminalBody.style.display = "flex";
    if (logsToggleArrow) logsToggleArrow.style.transform = "rotate(180deg)";
    syncModalProgress.style.width = "0%";
    syncProcessedCount.textContent = "0 / 0 Songs";
    syncPercentText.textContent = "0%";
    syncElapsedTime.textContent = "0:00";
    syncEtaTime.textContent = "Calculating...";
    
    // Rotating quotes
    function updateQuote() {
        const idx = Math.floor(Math.random() * syncQuotes.length);
        syncQuoteBox.textContent = syncQuotes[idx];
    }
    updateQuote();
    quoteTimer = setInterval(updateQuote, 8000);
    
    // Elapsed and ETA Timer
    function formatTimer(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    syncTimer = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - syncStartTime) / 1000);
        syncElapsedTime.textContent = formatTimer(elapsedSec);
        
        if (processedTracks > 0 && processedTracks < totalTracks) {
            const avgTime = elapsedSec / processedTracks;
            const rem = totalTracks - processedTracks;
            syncEtaTime.textContent = formatTimer(Math.floor(avgTime * rem));
        } else if (processedTracks >= totalTracks && totalTracks > 0) {
            syncEtaTime.textContent = "0:00";
        } else {
            syncEtaTime.textContent = "Calculating...";
        }
    }, 1000);
    
    function endSyncModal(titleText) {
        if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
        if (quoteTimer) { clearInterval(quoteTimer); quoteTimer = null; }
        syncModalTitle.innerHTML = titleText;
        if (syncModalClose) syncModalClose.style.display = "none";
    }
    
    // Connect to Server Sent Events
    eventSource = new EventSource(`/api/sync/run?username=${activeProfile}`);
    
    eventSource.onmessage = (event) => {
        const line = event.data;
        
        if (line === "SYNC_COMPLETE") {
            eventSource.close();
            eventSource = null;
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
            syncModalProgress.style.width = "0%";
        } else if (line.includes("All songs are up-to-date!")) {
            syncCurrentSong.textContent = "All songs are up-to-date!";
            syncModalProgress.style.width = "100%";
            const elDl = document.getElementById("sync-metric-downloaded");
            if (elDl) elDl.textContent = "Up to date";
            syncEtaTime.textContent = "0:00";
        } else if (line.includes("Starting download: ")) {
            const parts = line.split("Starting download: ");
            if (parts.length > 1) {
                syncCurrentSong.textContent = cleanMediaExtension(parts[1]);
            }
        } else if (line.includes("SUCCESS: ") || line.includes("FAILED: ")) {
            processedTracks++;
            const elDl = document.getElementById("sync-metric-downloaded");
            if (elDl) elDl.textContent = `${processedTracks} / ${totalTracks}`;
            if (totalTracks > 0) {
                const pct = Math.min(100, Math.round((processedTracks / totalTracks) * 100));
                syncModalProgress.style.width = `${pct}%`;
            }
            // Auto refresh downloaded files periodically as songs complete
            loadFiles();
        } else if (line === "SYNC_FINISHED_SUCCESS") {
            endSyncModal("Sync Successful!");
        } else if (line === "SYNC_FINISHED_FAILED") {
            endSyncModal("<span style='color: var(--danger)'>Sync Completed with Errors</span>");
        }
        
        appendTerminalLine(line);
    };
    
    eventSource.onerror = (e) => {
        console.error("SSE stream error", e);
        eventSource.close();
        eventSource = null;
        appendTerminalLine("[System] Download stream connection lost.");
        refreshStatus();
        endSyncModal("<span style='color: var(--danger)'>Download Stream Interrupted</span>");
    };
});

function appendTerminalLine(text) {
    const span = document.createElement("span");
    
    // Classify line styling
    if (text.includes("SUCCESS") || text.includes("successfully") || text.includes("Complete")) {
        span.className = "success-line";
    } else if (text.includes("ERROR") || text.includes("FAILED")) {
        span.className = "error-line";
    } else if (text.includes("Warning") || text.includes("Retry") || text.includes("Retrying")) {
        span.className = "warning-line";
    } else if (text.startsWith("===") || text.startsWith("---") || text.startsWith("[System]")) {
        span.className = "system-line";
    } else if (text.startsWith("[")) {
        span.className = "info-line";
    }
    
    span.textContent = text;
    terminalBody.appendChild(span);
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
            profileSelect.value = val.toLowerCase();
            handleProfileChange(val.toLowerCase());
        } else {
            const err = await res.json();
            alert(`Error: ${err.detail}`);
        }
    } catch (e) {
        alert("Failed to create profile: " + e.message);
    }
});

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

// Edit playlist source
editSourceBtn.addEventListener("click", () => {
    if (!activePlaylistSourceId) return;
    const src = activeConfig.sources.find(s => s.id === activePlaylistSourceId);
    if (!src) return;
    
    editingSourceId = activePlaylistSourceId;
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
        // Edit existing source
        const src = activeConfig.sources.find(s => s.id === editingSourceId);
        if (src) {
            src.name = name;
            src.type = type;
            src.url = type !== "text_file" ? url : "";
            src.path = type === "text_file" ? path : "";
        }
    } else {
        // Add new source
        const newSource = {
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

// Move parent directory
dirBrowserUpBtn.addEventListener("click", () => {
    if (parentBrowserPath) {
        fetchDirectory(parentBrowserPath);
    }
});

// ==================== Spotify-style Player Logic ====================

function playTrack(track, queue = []) {
    if (!track) return;
    
    playerQueue = queue;
    currentQueueIndex = queue.findIndex(t => t.id === track.id || t.filename === track.filename);
    currentPlayingTrack = track;
    
    // Save last played track and queue in localStorage for instant resume
    try {
        if (activeProfile) {
            localStorage.setItem(`musicgrabber_last_track_${activeProfile}`, JSON.stringify(track));
            localStorage.setItem(`musicgrabber_last_queue_${activeProfile}`, JSON.stringify(queue));
        }
    } catch (e) {}
    
    const filename = track.local_filename || track.filename;
    if (!filename) {
        alert("Cannot play song: local filename not found.");
        return;
    }
    
    localAudioElement.src = `/api/stream?username=${activeProfile}&filename=${encodeURIComponent(filename)}`;
    localAudioElement.load();
    
    // Initialize seeker visualizer nodes
    initVisualizer();
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    localAudioElement.play().then(() => {
        musicPlayerBar.style.display = "flex";
        updatePlaybackUI();
    }).catch(e => {
        console.error("Audio playback error:", e);
        alert("Playback failed. Make sure the container finished downloading the file.");
    });
}

function updatePlaybackUI() {
    if (!currentPlayingTrack) return;
    
    const title = currentPlayingTrack.title || currentPlayingTrack.display_name || "Unknown Song";
    const artist = currentPlayingTrack.artist || "Unknown Artist";
    
    playerTrackTitle.textContent = title;
    playerTrackArtist.textContent = artist;
    
    // Update player album art
    if (playerAlbumArt) {
        if (currentPlayingTrack.thumbnail_url) {
            playerAlbumArt.innerHTML = `<img src="${currentPlayingTrack.thumbnail_url}" onerror="this.remove(); playerAlbumArt.innerHTML='🎵';" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-sm);">`;
        } else {
            playerAlbumArt.innerHTML = `🎵`;
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
}

const pipVideo = document.createElement("video");
pipVideo.muted = true;
pipVideo.playsInline = true;

const pipCanvas = document.createElement("canvas");
pipCanvas.width = 300;
pipCanvas.height = 300;
const pipCtx = pipCanvas.getContext("2d");

function updatePipCanvas(title, artist) {
    const grad = pipCtx.createLinearGradient(0, 0, 300, 300);
    grad.addColorStop(0, "#111827");
    grad.addColorStop(1, "#1f2937");
    pipCtx.fillStyle = grad;
    pipCtx.fillRect(0, 0, 300, 300);
    
    if (currentPlayingTrack && currentPlayingTrack.thumbnail_url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = currentPlayingTrack.thumbnail_url;
        img.onload = () => {
            pipCtx.drawImage(img, 75, 20, 150, 150);
            
            pipCtx.fillStyle = "#ffffff";
            pipCtx.font = "bold 16px 'Outfit', sans-serif";
            pipCtx.textAlign = "center";
            pipCtx.fillText(title, 150, 210, 260);
            
            pipCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
            pipCtx.font = "14px 'Inter', sans-serif";
            pipCtx.fillText(artist, 150, 240, 260);
        };
    } else {
        pipCtx.fillStyle = "#ffffff";
        pipCtx.font = "bold 20px 'Outfit', sans-serif";
        pipCtx.textAlign = "center";
        pipCtx.fillText(title, 150, 120, 260);
        
        pipCtx.fillStyle = "rgba(255, 255, 255, 0.7)";
        pipCtx.font = "16px 'Inter', sans-serif";
        pipCtx.fillText(artist, 150, 160, 260);
        
        pipCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
        pipCtx.font = "80px sans-serif";
        pipCtx.fillText("🎵", 150, 250);
    }
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
        playerProgressSlider.value = (cur / dur) * 100;
        playerCurrentTime.textContent = formatDuration(cur);
    }
});

localAudioElement.addEventListener("loadedmetadata", () => {
    playerTotalTime.textContent = formatDuration(localAudioElement.duration);
    playerProgressSlider.value = 0;
});

localAudioElement.addEventListener("ended", () => {
    if (playerQueue.length > 0 && currentQueueIndex < playerQueue.length - 1) {
        currentQueueIndex++;
        playTrack(playerQueue[currentQueueIndex], playerQueue);
    } else {
        updatePlaybackUI();
    }
});

localAudioElement.addEventListener("play", updatePlaybackUI);
localAudioElement.addEventListener("pause", updatePlaybackUI);

playerPlayBtn.addEventListener("click", () => {
    // If audio element is currently loaded and paused, toggle play
    if (localAudioElement.src && localAudioElement.src !== "" && !localAudioElement.src.endsWith("/")) {
        if (localAudioElement.paused) {
            localAudioElement.play();
        } else {
            localAudioElement.pause();
        }
    } else {
        // Try resuming last played track from localStorage
        try {
            const savedTrackStr = localStorage.getItem(`musicgrabber_last_track_${activeProfile}`);
            const savedQueueStr = localStorage.getItem(`musicgrabber_last_queue_${activeProfile}`);
            if (savedTrackStr) {
                const savedTrack = JSON.parse(savedTrackStr);
                const savedQueue = savedQueueStr ? JSON.parse(savedQueueStr) : [savedTrack];
                playTrack(savedTrack, savedQueue);
                return;
            }
        } catch (e) {}
        
        // Fallback: play first available song from discover data or downloaded files
        if (discoverData && discoverData.all_songs && discoverData.all_songs.length > 0) {
            playTrack(discoverData.all_songs[0], discoverData.all_songs);
        } else if (allDownloadedFiles && allDownloadedFiles.length > 0) {
            const firstFile = allDownloadedFiles[0];
            const mockTrack = {
                filename: firstFile.name,
                local_filename: firstFile.name,
                title: firstFile.name,
                artist: "Downloaded Track",
                thumbnail_url: `/api/thumbnail?path=${encodeURIComponent(firstFile.path)}`
            };
            playTrack(mockTrack, [mockTrack]);
        } else {
            showToast("No songs found to play. Synchronize a playlist or download songs first!", "warning");
        }
    }
});

playerNextBtn.addEventListener("click", () => {
    if (playerQueue.length > 0 && currentQueueIndex < playerQueue.length - 1) {
        currentQueueIndex++;
        playTrack(playerQueue[currentQueueIndex], playerQueue);
    }
});

playerPrevBtn.addEventListener("click", () => {
    if (playerQueue.length > 0 && currentQueueIndex > 0) {
        currentQueueIndex--;
        playTrack(playerQueue[currentQueueIndex], playerQueue);
    }
});

playerProgressSlider.addEventListener("input", () => {
    if (localAudioElement.duration) {
        const pct = playerProgressSlider.value / 100;
        localAudioElement.currentTime = pct * localAudioElement.duration;
    }
});

playerVolumeSlider.addEventListener("input", () => {
    localAudioElement.volume = playerVolumeSlider.value / 100;
});

playerCloseBtn.addEventListener("click", () => {
    localAudioElement.pause();
    musicPlayerBar.style.display = "none";
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
        document.getElementById(subtabId).style.display = "block";
    });
});

async function loadDiscoverData() {
    if (!activeProfile) return;
    
    // Render existing data immediately if already loaded
    if (discoverData) {
        renderDiscoverPage();
    } else {
        discoverArtistsGrid.innerHTML = '<div class="spinner-container"><div class="spinner"></div><p>Loading library metadata...</p></div>';
    }
    
    try {
        const res = await fetch(`/api/discover?username=${activeProfile}&t=${Date.now()}`);
        if (!res.ok) throw new Error("API scan failed");
        
        discoverData = await res.json();
        renderDiscoverPage();
    } catch (e) {
        if (!discoverData) {
            discoverArtistsGrid.innerHTML = `<div class="empty-sources" style="color: var(--danger)">Failed to load discover page: ${e.message}</div>`;
        }
    }
}

function renderDiscoverPage() {
    if (!discoverData) return;
    
    discoverArtistsGrid.innerHTML = "";
    const artists = Object.keys(discoverData.artists).sort();
    if (artists.length === 0) {
        discoverArtistsGrid.innerHTML = '<div class="empty-sources">No downloaded songs found yet. Download songs first!</div>';
    } else {
        artists.forEach(art => {
            const tracks = discoverData.artists[art];
            const artistImgUrl = `/api/artist-image?artist=${encodeURIComponent(art)}`;
            const card = document.createElement("div");
            card.className = "discover-card";
            card.innerHTML = `
                <div class="discover-card-icon" style="position: relative; overflow: hidden; border-radius: 50%;">
                    <span style="position: absolute; z-index: 1;">👤</span>
                    <img src="${artistImgUrl}" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; z-index: 2;">
                </div>
                <div class="discover-card-title">${escapeHtml(art)}</div>
            `;
            card.addEventListener("click", () => openDiscoverDetails("Artist: " + art, discoverData.artists[art]));
            discoverArtistsGrid.appendChild(card);
        });
    }
    
    discoverAlbumsGrid.innerHTML = "";
    const albums = Object.keys(discoverData.albums).sort();
    if (albums.length === 0) {
        discoverAlbumsGrid.innerHTML = '<div class="empty-sources">No downloaded songs found yet.</div>';
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
                    ${thumbSrc ? `<img src="${thumbSrc}" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); z-index: 2;">` : ""}
                </div>
                <div class="discover-card-title">${escapeHtml(alb)}</div>
            `;
            card.addEventListener("click", () => openDiscoverDetails("Album: " + alb, discoverData.albums[alb]));
            discoverAlbumsGrid.appendChild(card);
        });
    }
    
    discoverGenresGrid.innerHTML = "";
    const genres = Object.keys(discoverData.genres).sort();
    if (genres.length === 0) {
        discoverGenresGrid.innerHTML = '<div class="empty-sources">No downloaded songs found yet.</div>';
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
                    ${thumbSrc ? `<img src="${thumbSrc}" onerror="this.remove();" style="position: absolute; left:0; top:0; width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md); z-index: 2;">` : ""}
                </div>
                <div class="discover-card-title">${escapeHtml(gen)}</div>
            `;
            card.addEventListener("click", () => openDiscoverDetails("Genre: " + gen, discoverData.genres[gen]));
            discoverGenresGrid.appendChild(card);
        });
    }
    
    discoverSongsTableBody.innerHTML = "";
    const songs = discoverData.all_songs;
    if (songs.length === 0) {
        discoverSongsTableBody.innerHTML = '<tr><td colspan="6" class="empty-table">No downloaded songs found yet.</td></tr>';
    } else {
        songs.forEach((s, idx) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.className = "discover-song-row";
            tr.innerHTML = `
                <td class="play-indicator-cell" style="width: 45px; text-align: center; color: var(--text-dim);">
                    <span class="row-index">${idx + 1}</span>
                    <span class="row-play-icon" style="display: none; color: var(--primary);">▶</span>
                </td>
                <td><strong>${escapeHtml(s.title)}</strong></td>
                <td>${escapeHtml(s.artist)}</td>
                <td>${escapeHtml(s.album)}</td>
                <td>${escapeHtml(s.genre)}</td>
                 <td style="text-align: right; width: 60px;">
                    <button class="btn btn-primary btn-icon play-btn-row" title="Play Song" style="width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--primary); border: none; color: #fff; padding: 0;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                </td>
            `;
            
            // Clicking anywhere on the row plays the song
            tr.addEventListener("click", (e) => {
                // Avoid double trigger if clicking the button specifically
                if (e.target.closest(".play-btn-row")) return;
                playTrack(s, songs);
            });
            
            tr.querySelector(".play-btn-row").addEventListener("click", () => {
                playTrack(s, songs);
            });
            discoverSongsTableBody.appendChild(tr);
        });
    }
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
        
        const localAudio = document.getElementById("local-audio-element");
        if (localAudio) {
            localAudio.crossOrigin = "anonymous";
            sourceNode = audioCtx.createMediaElementSource(localAudio);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            
            const bufferLength = analyser.frequencyBinCount;
            visualizerDataArray = new Uint8Array(bufferLength);
            visualizerInitialized = true;
        }
    } catch (e) {
        console.error("Seek bar visualizer AudioContext failed to initialize:", e);
    }
}

function startVisualizerDrawLoop() {
    const canvas = document.getElementById("player-progress-visualizer");
    if (!canvas) return;
    
    const canvasCtx = canvas.getContext("2d");
    
    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);
        
        // Match canvas dimensions to layout container size dynamically
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        
        const width = canvas.width;
        const height = canvas.height;
        
        canvasCtx.clearRect(0, 0, width, height);
        
        const localAudio = document.getElementById("local-audio-element");
        const progress = localAudio && localAudio.duration ? (localAudio.currentTime / localAudio.duration) : 0;
        
        let freqs = [];
        if (analyser && localAudio && !localAudio.paused) {
            analyser.getByteFrequencyData(visualizerDataArray);
            for (let i = 0; i < visualizerDataArray.length; i++) {
                freqs.push(visualizerDataArray[i]);
            }
        }
        
        const barWidth = 2.5;
        const barGap = 1.5;
        const totalBarWidth = barWidth + barGap;
        const barCount = Math.floor(width / totalBarWidth);
        
        for (let i = 0; i < barCount; i++) {
            let val = 0;
            const normX = i / barCount;
            
            // Ultra-detailed waveform frequency contour representing audio amplitude/energy
            const w1 = Math.sin(normX * Math.PI * 4);
            const w2 = Math.cos(normX * Math.PI * 11);
            const w3 = Math.sin(normX * Math.PI * 22);
            const contour = 0.18 + 0.22 * Math.abs(w1 * 0.45 + w2 * 0.35 + w3 * 0.2);
            
            if (freqs.length > 0) {
                const freqIdx = Math.min(freqs.length - 1, Math.floor(normX * freqs.length));
                const realFreq = freqs[freqIdx] / 255;
                val = 0.4 * contour + 0.6 * realFreq;
            } else {
                val = contour;
            }
            
            if (localAudio && !localAudio.paused) {
                val += 0.05 * Math.abs(Math.sin(Date.now() / 120 + i * 0.5));
            }
            
            let barHeight = val * height * 0.9;
            if (barHeight < 3) barHeight = 3;
            
            const x = i * totalBarWidth;
            const y = (height - barHeight) / 2;
            
            const isPlayed = (x / width) <= progress;
            
            canvasCtx.beginPath();
            if (isPlayed) {
                const grad = canvasCtx.createLinearGradient(0, y, 0, y + barHeight);
                grad.addColorStop(0, "#6366f1");
                grad.addColorStop(1, "#06b6d4");
                canvasCtx.fillStyle = grad;
            } else {
                canvasCtx.fillStyle = "rgba(255, 255, 255, 0.14)";
            }
            
            drawVisualizerBar(canvasCtx, x, y, barWidth, barHeight, 1);
            canvasCtx.fill();
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

// Window Load Handler
window.addEventListener("load", () => {
    loadProfiles();
    startVisualizerDrawLoop();

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
        });
        
        subtabDownloadedBtn.addEventListener("click", () => {
            subtabDownloadedBtn.classList.add("active");
            subtabToDownloadBtn.classList.remove("active");
            paneDownloadedFiles.style.display = "block";
            paneToDownload.style.display = "none";
        });
    }

    // Path Column Toggle Handler
    const toggleFilePathsCheckbox = document.getElementById("toggle-file-paths-checkbox");
    if (toggleFilePathsCheckbox) {
        toggleFilePathsCheckbox.addEventListener("change", () => {
            const isChecked = toggleFilePathsCheckbox.checked;
            document.querySelectorAll(".file-path-col, .file-path-cell").forEach(el => {
                el.style.display = isChecked ? "table-cell" : "none";
            });
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
});
