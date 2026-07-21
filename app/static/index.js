// Application State
let activeProfile = "";
let activePlaylistSourceId = "";
let editingSourceId = "";
let profiles = [];
let activeConfig = null;
let currentTracks = [];
let eventSource = null;

// DOM Elements
const profileSelect = document.getElementById("profile-select");
const addProfileBtn = document.getElementById("add-profile-btn");
const profileWarning = document.getElementById("profile-warning");
const tabPanes = document.querySelectorAll(".tab-pane");
const navItems = document.querySelectorAll(".nav-item");

// Sync Tab Elements
const syncNowBtn = document.getElementById("sync-now-btn");
const syncBadge = document.getElementById("sync-badge");
const autoSyncStatus = document.getElementById("auto-sync-status");
const lastSyncTimeText = document.getElementById("last-sync-time");
const nextSyncTimeText = document.getElementById("next-sync-time");
const clearLogsBtn = document.getElementById("clear-logs-btn");
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
const cookiesStatusBadge = document.getElementById("cookies-status-badge");
const deleteCookiesBtn = document.getElementById("delete-cookies-btn");
const settingCookiesFile = document.getElementById("setting-cookies-file");
const triggerCookiesUploadBtn = document.getElementById("trigger-cookies-upload-btn");
const selectedCookiesFilename = document.getElementById("selected-cookies-filename");
const uploadCookiesBtn = document.getElementById("upload-cookies-btn");

// Modals
const profileModal = document.getElementById("profile-modal");
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
        const res = await fetch("/api/profiles");
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
    
    // Refresh status, downloaded files, and source sidebar
    refreshStatus();
    loadFiles();
    renderSourcesList();
    
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
        const res = await fetch(`/api/config?username=${username}`);
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
        const res = await fetch(`/api/cookies/status?username=${username}`);
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

// Populate Settings Form from activeConfig
function populateSettingsForm() {
    if (!activeConfig) return;
    
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
}

// Refresh status card information
async function refreshStatus() {
    if (!activeProfile) return;
    try {
        const res = await fetch(`/api/sync/status?username=${activeProfile}`);
        const status = await res.json();
        
        // Sync badge
        if (status.syncing) {
            syncBadge.className = "badge badge-syncing";
            syncBadge.textContent = "Syncing";
            syncNowBtn.disabled = true;
        } else {
            syncBadge.className = "badge badge-idle";
            syncBadge.textContent = "Idle";
            syncNowBtn.disabled = false;
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
let allDownloadedFiles = [];
async function loadFiles() {
    if (!activeProfile) return;
    try {
        const res = await fetch(`/api/scan?username=${activeProfile}`);
        const data = await res.json();
        allDownloadedFiles = data.files || [];
        renderFilesList(allDownloadedFiles);
    } catch (e) {
        console.error("Failed to load directory files", e);
    }
}

function renderFilesList(files) {
    filesCountText.textContent = `${files.length} files`;
    
    if (files.length === 0) {
        filesTableBody.innerHTML = `<tr><td colspan="2" class="empty-table">No audio files found. Verify your Save Path in Settings.</td></tr>`;
        return;
    }
    
    filesTableBody.innerHTML = "";
    files.forEach(f => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(f.name)}</td>
            <td style="white-space: nowrap; color: var(--text-muted); text-align: right;">${formatBytes(f.size_bytes)}</td>
        `;
        filesTableBody.appendChild(tr);
    });
}

// Filter downloaded files locally
filesSearchInput.addEventListener("input", () => {
    const q = filesSearchInput.value.toLowerCase().trim();
    if (!q) {
        renderFilesList(allDownloadedFiles);
        return;
    }
    const filtered = allDownloadedFiles.filter(f => f.name.toLowerCase().includes(q));
    renderFilesList(filtered);
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
    playlistActiveView.style.display = "block";
    
    activeSourceName.textContent = source.name;
    activeSourceUrl.textContent = source.url || source.path || "";
    activeSourceUrl.href = source.url && source.url.startsWith("http") ? source.url : "#";
    
    // Show spinner, clear table
    tracksLoadingSpinner.style.display = "flex";
    tracksItemsContainer.innerHTML = "";
    
    try {
        const res = await fetch(`/api/playlist/tracks?username=${activeProfile}&source_id=${sourceId}&refresh=${refresh}`);
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

// Render Tracks Items inside details card
function renderTracksList(tracks) {
    if (tracks.length === 0) {
        tracksItemsContainer.innerHTML = `<div class="empty-tracks-view"><p>This playlist source has no songs, or it hasn't been fetched yet. Click "Refresh List" above.</p></div>`;
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
            <div class="track-status-cell">
                ${statusBadge}
            </div>
        `;
        
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
        });
        
        tracksItemsContainer.appendChild(row);
    });
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
            alert("Settings saved successfully.");
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
syncNowBtn.addEventListener("click", () => {
    if (!activeProfile || eventSource) return;
    
    terminalBody.innerHTML = '<span class="system-line">[System] Triggering synchronization...</span>';
    syncBadge.className = "badge badge-syncing";
    syncBadge.textContent = "Syncing";
    syncNowBtn.disabled = true;
    
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
            
            // Reload tracks to show downloaded badge
            if (activePlaylistSourceId) {
                loadPlaylistTracks(activePlaylistSourceId, false);
            }
            return;
        }
        
        appendTerminalLine(line);
    };
    
    eventSource.onerror = (e) => {
        console.error("SSE stream error", e);
        eventSource.close();
        eventSource = null;
        appendTerminalLine("[System] Download stream connection lost.");
        refreshStatus();
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

clearLogsBtn.addEventListener("click", () => {
    terminalBody.innerHTML = '<span class="system-line">[System] Logs cleared.</span>';
});

// Profile Dropdown change
profileSelect.addEventListener("change", () => {
    handleProfileChange(profileSelect.value);
});

// Sidebar tabs toggling
function switchTab(tabId) {
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
        switchTab(item.getAttribute("data-tab"));
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

// Window Load Handler
window.addEventListener("load", () => {
    loadProfiles();
});
