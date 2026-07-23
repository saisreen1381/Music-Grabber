# 🎵 Music Grabber — Self-Hosted Sync Engine & Audio Player

**Music Grabber** is a self-hosted, multi-user music synchronization server and modern web audio player. It automatically syncs your saved tracks, playlists, and albums from Spotify and YouTube Music to your local storage, embedded with full ID3 metadata and high-res cover art. It features an interactive web interface with dynamic audio visualizers, playlist management, and automated background sync scheduling.

---

## ✨ Features

- **🔄 Automated Synchronization**: Sync Spotify playlists, liked tracks, albums, and YouTube Music playlists using `yt-dlp` & `spotdl`.
- **👥 Multi-Profile Support**: Independent profiles with dedicated sync configurations, download directories, and playback state.
- **⏰ Scheduled Sync Engine**: Automated background sync cron engine to keep local libraries updated on set schedules.
- **🍪 YouTube Cookies Integration**: Simple web UI upload for YouTube `cookies.txt` to bypass age restrictions and access private/bot-blocked streams.
- **🎨 Dynamic Audio Visualizer & Player**: Modern glassmorphic Web Audio visualizer with waveform envelopes, smooth seekbar buffering, picture-in-picture mode, and media shortcuts.
- **🐳 Docker Ready**: Deploy instantly using Docker and Docker Compose on Linux, macOS, Windows, or Raspberry Pi.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI, APScheduler, `yt-dlp`, `spotdl`
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Modern Vanilla CSS, Web Audio API Canvas Visualizers
- **Containerization**: Docker, Docker Compose

---

## 🚀 Getting Started

### Method 1: Using Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/Music-Grabber.git
   cd Music-Grabber
   ```

2. **Launch with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access the Web Dashboard:**
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

---

### Method 2: Local Python Installation

#### Prerequisites
- Python 3.10 or higher
- `ffmpeg` installed and available in system PATH
- `yt-dlp` and `spotdl` installed (`pip install spotdl yt-dlp`)

#### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/Music-Grabber.git
   cd Music-Grabber
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Fast-API Server:**
   ```bash
   python -m app.main
   ```
   *(Or using uvicorn: `uvicorn app.main:app --host 0.0.0.0 --port 8000`)*

---

## ⚙️ Configuration & Usage

### 1. Creating User Profiles
Upon opening the web dashboard at `http://localhost:8000`, click **Add User Profile** or select your active profile from the top dropdown.

### 2. Configuring Sync Sources
Navigate to **Sync & Files** settings in the dashboard:
- **Download Directory**: Specify the directory where synced music files will be saved on your server/disk.
- **Spotify Playlists & Liked Songs**: Add Spotify playlist URLs or Spotify credentials.
- **YouTube Music Playlists**: Add YouTube Music / YouTube playlist URLs.
- **Schedule**: Set background sync intervals (e.g., every 6 hours, daily, or manual triggers).

### 3. Uploading YouTube Cookies (Optional but Recommended)
If YouTube restricts downloads or requires login:
1. Export cookies from your web browser using an extension like *Get cookies.txt LOCALLY*.
2. In the Music Grabber **Settings** section, click **Upload Cookies File** (`youtube_cookies.txt`).
3. The sync engine will automatically use your cookies for seamless high-bitrate downloads.

---

## 📁 Repository Structure

```
Music Grabber/
├── app/
│   ├── main.py            # FastAPI API handlers & web routes
│   ├── sync_engine.py      # Core download & metadata sync engine
│   ├── scheduler.py        # Background cron sync scheduler
│   └── static/
│       ├── index.html     # Web dashboard UI
│       ├── index.js       # Audio player & UI application logic
│       └── style.css       # Custom design system & styles
├── docker-compose.yml     # Container orchestration
├── Dockerfile             # Production container spec
├── music_sync.py          # CLI runner entrypoint
├── requirements.txt       # Python dependencies
└── README.md              # Project documentation
```

---

## 🔒 Privacy & Security

- All user profile configurations, cached playback states, downloaded audio files, and cookies are stored locally under `users/` and `downloads/`.
- Private data and cookies are **excluded from Git tracking** via `.gitignore`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
