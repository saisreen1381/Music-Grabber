import os
import io
import time
import json
import datetime
import urllib.parse
import urllib.request
import hashlib
import re
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.sync_engine import (
    run_sync_engine_generator, 
    scan_existing_files_detailed,
    scan_existing_files,
    fetch_ytdlp_playlist,
    fetch_text_file,
    get_source_id,
    normalize_name,
    get_scan_paths,
    download_track_ytdlp,
    paused_syncs,
    aborted_syncs
)
from app.scheduler import BackgroundScheduler

app = FastAPI(title="Music Grabber UI")

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to find yt-dlp path
def find_ytdlp():
    potential = "/home/saisreen1381/.local/share/pipx/venvs/spotdl/bin/yt-dlp"
    if os.path.exists(potential):
        return potential
    return "yt-dlp"

YTDLP_PATH = find_ytdlp()
USERS_DIR = Path("users")
os.makedirs(USERS_DIR, exist_ok=True)

# Initialize and start scheduler
scheduler = BackgroundScheduler(users_dir=USERS_DIR, ytdlp_path=YTDLP_PATH)

@app.on_event("startup")
def startup_event():
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.stop()

# Serve static files (HTML/CSS/JS)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
def read_root():
    index_path = Path("app/static/index.html")
    if index_path.exists():
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Music Grabber static directory is empty or not created yet.</h1>")

# Pydantic schemas
class SourceModel(BaseModel):
    id: Optional[str] = None
    type: str
    name: str
    url: Optional[str] = ""
    path: Optional[str] = ""
    disabled_track_ids: Optional[List[str]] = []

class ConfigModel(BaseModel):
    download_dir: str
    additional_library_dirs: Optional[List[str]] = []
    filename_template: Optional[str] = "%(title)s.%(ext)s"
    embed_metadata: Optional[bool] = True
    max_concurrent_downloads: Optional[int] = 3
    auto_sync: Optional[bool] = False
    sync_interval_hours: Optional[int] = 24
    sync_time: Optional[str] = "02:00"
    seekbar_style: Optional[str] = "solid_envelope"
    eq_preset: Optional[str] = "flat"
    autoplay_launch: Optional[bool] = False
    sources: List[SourceModel] = []

class ProfileCreate(BaseModel):
    username: str

class ToggleTrackModel(BaseModel):
    username: str
    source_id: str
    track_id: str
    enabled: bool

class ToggleAllTracksModel(BaseModel):
    username: str
    source_id: str
    enabled: bool

class DownloadSingleTrackModel(BaseModel):
    username: str
    source_id: str
    track_id: str

# API Endpoints

@app.get("/api/profiles")
def get_profiles():
    if not USERS_DIR.exists():
        return []
    profiles = [p.name for p in USERS_DIR.iterdir() if p.is_dir()]
    # Return sorted list, ensuring "saisreen" is first if it exists
    if "saisreen" in profiles:
        profiles.remove("saisreen")
        profiles.insert(0, "saisreen")
    return {"profiles": profiles}

@app.post("/api/profiles")
def create_profile(profile: ProfileCreate):
    username = profile.username.strip().lower()
    # Check alphanumeric and non-empty
    if not username or not re.match("^[a-z0-9_-]+$", username):
        raise HTTPException(status_code=400, detail="Invalid username character. Use letters, numbers, hyphens or underscores.")
        
    profile_dir = USERS_DIR / username
    if profile_dir.exists():
        raise HTTPException(status_code=400, detail="Profile already exists.")
        
    os.makedirs(profile_dir, exist_ok=True)
    os.makedirs(profile_dir / "playlists", exist_ok=True)
    
    # Create default config
    default_config = {
        "download_dir": str(Path("downloads").absolute()),
        "filename_template": "%(title)s.%(ext)s",
        "embed_metadata": True,
        "max_concurrent_downloads": 3,
        "auto_sync": False,
        "sync_interval_hours": 24,
        "sync_time": "02:00",
        "sources": []
    }
    
    config_file = profile_dir / "sync_config.json"
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(default_config, f, indent=2)
        
    return {"status": "success", "username": username}

@app.get("/api/config")
def get_config(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        # Fallback to create empty config
        default_config = {
            "download_dir": str(Path("downloads").absolute()),
            "sources": []
        }
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2)
            
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config: {e}")
        
    # Fill in missing fields with defaults
    modified = False
    if not data.get("download_dir"):
        data["download_dir"] = str((profile_dir / "downloads").absolute())
        modified = True
    if "filename_template" not in data:
        data["filename_template"] = "%(title)s.%(ext)s"
        modified = True
    if "embed_metadata" not in data:
        data["embed_metadata"] = True
        modified = True
    if "max_concurrent_downloads" not in data:
        data["max_concurrent_downloads"] = 3
        modified = True
    if "auto_sync" not in data:
        data["auto_sync"] = False
        modified = True
    if "sync_interval_hours" not in data:
        data["sync_interval_hours"] = 24
        modified = True
    if "sync_time" not in data:
        data["sync_time"] = "02:00"
        modified = True
        
    sources_list = data.get("sources", [])
    for src in sources_list:
        if not src.get("id"):
            src["id"] = get_source_id(src)
            modified = True
        if "disabled_track_ids" not in src:
            src["disabled_track_ids"] = []
            modified = True
            
    if modified:
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            
    return data

@app.post("/api/config")
def save_config(username: str, config: ConfigModel):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    
    # Process sources and assign stable IDs if missing
    config_dict = config.dict()
    if not config_dict.get("download_dir"):
        config_dict["download_dir"] = str((profile_dir / "downloads").absolute())
    for src in config_dict["sources"]:
        if not src.get("id"):
            src["id"] = get_source_id(src)
            
    # Check if download_dir changed and copy files
    old_download_dir = None
    transferred_count = 0
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                old_config = json.load(f)
                old_download_dir = old_config.get("download_dir")
        except Exception:
            pass
            
    new_download_dir = config_dict.get("download_dir")
    if old_download_dir and new_download_dir and old_download_dir != new_download_dir:
        old_path = Path(old_download_dir)
        new_path = Path(new_download_dir)
        if old_path.exists() and old_path.is_dir():
            os.makedirs(new_path, exist_ok=True)
            import shutil
            for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac', '*.webp']:
                for file in old_path.rglob(ext):
                    try:
                        dest = new_path / file.name
                        if not dest.exists():
                            shutil.copy2(file, dest)
                            transferred_count += 1
                    except Exception as e:
                        print(f"Failed to copy file {file.name}: {e}")
            
    try:
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {e}")
        
    msg = "Settings saved successfully."
    if transferred_count > 0:
        msg += f" Transferred {transferred_count} files to the new directory."
        
    return {"status": "success", "config": config_dict, "message": msg}

@app.get("/api/thumbnail")
def get_thumbnail(path: str):
    audio_path = Path(path)
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    # 1. If it's already an image file, return it
    if audio_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
        return FileResponse(str(audio_path))
        
    # 2. Check for sibling image file
    for img_ext in ['.jpg', '.jpeg', '.png', '.webp']:
        sibling = audio_path.with_suffix(img_ext)
        if sibling.exists():
            return FileResponse(str(sibling))
            
    # 3. Try to extract embedded cover art using ffmpeg
    cache_dir = Path("users/cover_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    hasher = hashlib.md5(path.encode("utf-8")).hexdigest()
    extracted_jpg = cache_dir / f"{hasher}.jpg"
    
    if extracted_jpg.exists():
        return FileResponse(str(extracted_jpg))
        
    try:
        cmd = [
            "ffmpeg", "-y", 
            "-i", str(audio_path), 
            "-an", 
            "-vcodec", "mjpeg",
            "-f", "image2",
            str(extracted_jpg)
        ]
        import subprocess
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=5)
        if extracted_jpg.exists() and extracted_jpg.stat().st_size > 0:
            return FileResponse(str(extracted_jpg))
    except Exception as e:
        print(f"Failed to extract cover art for {path}: {e}")
        
    raise HTTPException(status_code=404, detail="No cover art found")

@app.get("/api/artist-image")
def get_artist_image(artist: str):
    if not artist or artist.lower() in ["unknown artist", "downloaded track"]:
        raise HTTPException(status_code=404, detail="Artist unknown")
        
    primary_artist = re.split(r'[,/;&]|feat\.|ft\.', artist, flags=re.I)[0].strip()
    if not primary_artist:
        raise HTTPException(status_code=404, detail="Artist unknown")
        
    cache_dir = Path("users/cover_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    hasher = hashlib.md5(primary_artist.lower().encode("utf-8")).hexdigest()
    cached_jpg = cache_dir / f"artist_{hasher}.jpg"
    cached_404 = cache_dir / f"artist_404_{hasher}.txt"
    
    if cached_jpg.exists() and cached_jpg.stat().st_size > 0:
        return FileResponse(str(cached_jpg))
        
    if cached_404.exists():
        raise HTTPException(status_code=404, detail="Artist image not found")
        
    try:
        url = f"https://api.deezer.com/search/artist?q={urllib.parse.quote(primary_artist)}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as response:
            data = json.loads(response.read().decode("utf-8"))
            items = data.get("data", [])
            if items:
                img_url = items[0].get("picture_medium") or items[0].get("picture_big")
                if img_url:
                    img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(img_req, timeout=4) as img_res:
                        with open(cached_jpg, "wb") as f:
                            f.write(img_res.read())
                    if cached_jpg.exists() and cached_jpg.stat().st_size > 0:
                        return FileResponse(str(cached_jpg))
    except Exception:
        pass
        
    try:
        with open(cached_404, "w") as f:
            f.write("404")
    except Exception:
        pass
        
    raise HTTPException(status_code=404, detail="Artist image not found")

@app.get("/api/scan")
def scan_directory(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        return {"files": []}
        
    try:
        with open(config_file, "r") as f:
            config = json.load(f)
    except Exception:
        return {"files": []}
        
    download_dir = config.get("download_dir")
    additional_dirs = config.get("additional_library_dirs", [])
    files = scan_existing_files_detailed(download_dir, additional_dirs, profile_dir)
    return {"files": files}

import subprocess

GENRE_ARTIST_MAP = {
    "taylor swift": "Pop",
    "bruno mars": "Funk / Pop",
    "david guetta": "EDM / Dance",
    "justin bieber": "Pop / R&B",
    "sai abhyankkar": "Indian / Indie",
    "karmin": "Pop / Hip-Hop",
    "sid sriram": "Indian / Classical",
    "zara larsson": "Pop / Dance",
    "adele": "Pop / Soul",
    "the vamps": "Pop / Rock",
    "matoma": "Tropical House",
    "ed sheeran": "Pop / Acoustic",
    "drake": "Hip-Hop / Rap",
    "post malone": "Hip-Hop / Pop",
    "coldplay": "Alternative Rock",
    "the weeknd": "R&B / Synth-Pop",
    "dua lipa": "Dance-Pop",
    "arjit singh": "Bollywood / Romantic",
    "anirudh": "Tamil / EDM",
    "pritam": "Bollywood",
    "ar rahman": "Indian / Soundtrack"
}

def resolve_genre(tags: dict, artist: str, title: str) -> str:
    raw_genre = tags.get("genre") or tags.get("GENRE") or tags.get("Genre") or tags.get("style") or tags.get("STYLE")
    if raw_genre and raw_genre.strip() and raw_genre.strip().lower() not in ["music", "unknown genre", "unknown", "other"]:
        return raw_genre.strip()
        
    if artist:
        art_clean = artist.lower().strip()
        for mapped_artist, mapped_genre in GENRE_ARTIST_MAP.items():
            if mapped_artist in art_clean:
                return mapped_genre
                
    return "Pop / Dance" if raw_genre and raw_genre.strip().lower() == "music" else "Pop / Mainstream"

def get_file_metadata(file_path: Path):
    try:
        cmd = [
            "ffprobe", 
            "-v", "quiet", 
            "-print_format", "json", 
            "-show_format", 
            str(file_path)
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(result.stdout)
        fmt = data.get("format", {})
        tags = fmt.get("tags", {})
        
        title = tags.get("title") or tags.get("TITLE") or file_path.stem
        artist = tags.get("artist") or tags.get("ARTIST") or "Unknown Artist"
        album = tags.get("album") or tags.get("ALBUM") or "Unknown Album"
        genre = resolve_genre(tags, artist, title)
        
        thumb_url = f"/api/thumbnail?path={urllib.parse.quote(str(file_path))}"
        return {
            "filename": file_path.name,
            "title": title,
            "artist": artist,
            "genre": genre,
            "album": album,
            "duration": float(fmt.get("duration", 0)),
            "thumbnail_url": thumb_url
        }
    except Exception:
        thumb_url = f"/api/thumbnail?path={urllib.parse.quote(str(file_path))}"
        return {
            "filename": file_path.name,
            "title": file_path.stem,
            "artist": "Unknown Artist",
            "genre": "Pop / Mainstream",
            "album": "Unknown Album",
            "duration": 0,
            "thumbnail_url": thumb_url
        }

@app.get("/api/discover")
def discover_local_songs(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        return {"artists": {}, "genres": {}, "albums": {}, "all_songs": []}
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    download_dir = config.get("download_dir")
    additional_dirs = config.get("additional_library_dirs", [])
    
    scan_paths = []
    if download_dir:
        p = Path(download_dir)
        if p.is_absolute():
            scan_paths.append(p)
        else:
            scan_paths.append(p.resolve())
            scan_paths.append((profile_dir / download_dir).resolve())
    for d in additional_dirs:
        if d:
            dp = Path(d)
            if dp.is_absolute():
                scan_paths.append(dp)
            else:
                scan_paths.append(dp.resolve())
                
    fallback_downloads = Path("downloads").resolve()
    if fallback_downloads not in scan_paths:
        scan_paths.append(fallback_downloads)
            
    # Load metadata cache
    cache_file = profile_dir / "library_metadata_cache.json"
    cache = {}
    if cache_file.exists():
        try:
            with open(cache_file, "r") as cf:
                cache = json.load(cf)
        except Exception:
            pass
            
    songs = []
    seen_file_paths = set()
    cache_updated = False
    
    AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.opus', '.webm', '.flac', '.wav', '.aac', '.ogg'}
    
    for download_path in scan_paths:
        if download_path.exists() and download_path.is_dir():
            try:
                for file in download_path.rglob('*'):
                    try:
                        if file.is_file() and file.suffix.lower() in AUDIO_EXTENSIONS:
                            abs_path = str(file.resolve())
                            if abs_path not in seen_file_paths:
                                seen_file_paths.add(abs_path)
                                try:
                                    stat = file.stat()
                                    mtime = stat.st_mtime
                                    size = stat.st_size
                                except Exception:
                                    mtime = 0
                                    size = 0
                                    
                                cached_item = cache.get(abs_path)
                                if (cached_item and 
                                    cached_item.get("mtime") == mtime and 
                                    cached_item.get("size") == size):
                                    songs.append(cached_item["metadata"])
                                else:
                                    metadata = get_file_metadata(file)
                                    songs.append(metadata)
                                    cache[abs_path] = {
                                        "mtime": mtime,
                                        "size": size,
                                        "metadata": metadata
                                    }
                                    cache_updated = True
                    except Exception:
                        pass
            except Exception:
                pass
                            
    # Clean up deleted files from cache
    deleted_keys = [k for k in cache if k not in seen_file_paths]
    if deleted_keys:
        for k in deleted_keys:
            cache.pop(k, None)
        cache_updated = True
        
    if cache_updated:
        try:
            with open(cache_file, "w") as cf:
                json.dump(cache, cf, indent=2)
        except Exception:
            pass
            
    # Group by Artist, Genre, Album
    artists = {}
    genres = {}
    albums = {}
    
    for s in songs:
        # Group by artist
        art_string = s.get("artist", "Unknown Artist")
        clean_artists = art_string.replace(";", ",").replace("/", ",").replace("\\", ",")
        clean_artists = re.sub(r'\s+&\s+', ',', clean_artists)
        clean_artists = re.sub(r'\s+and\s+', ',', clean_artists)
        artists_list = [a.strip() for a in clean_artists.split(",") if a.strip()]
        artists_list = list(dict.fromkeys(artists_list))
        if not artists_list:
            artists_list = ["Unknown Artist"]
            
        for art in artists_list:
            if art not in artists:
                artists[art] = []
            artists[art].append(s)
        
        # Group by genre
        gen_string = s.get("genre", "Unknown Genre")
        clean_genres = gen_string.replace(";", ",").replace("/", ",").replace("\\", ",")
        genres_list = [g.strip() for g in clean_genres.split(",") if g.strip()]
        genres_list = list(dict.fromkeys(genres_list))
        if not genres_list:
            genres_list = ["Unknown Genre"]
            
        for gen in genres_list:
            if gen not in genres:
                genres[gen] = []
            genres[gen].append(s)
        
        # Group by album
        alb = s.get("album", "Unknown Album")
        if alb not in albums:
            albums[alb] = []
        albums[alb].append(s)
        
    return {
        "artists": artists,
        "genres": genres,
        "albums": albums,
        "all_songs": songs
    }

@app.get("/api/browse")
def browse_directory(path: str = "/"):
    if not path:
        path = "/"
        
    p = Path(path)
    if not p.exists() or not p.is_dir():
        p = Path("/")
        
    try:
        subdirs = []
        for item in p.iterdir():
            try:
                if not item.name.startswith(".") and item.is_dir():
                    subdirs.append(item.name)
            except Exception:
                pass
        subdirs.sort()
        
        parent_path = None
        if p != p.parent:
            parent_path = str(p.parent).replace("\\", "/")
            
        current_path = str(p.absolute()).replace("\\", "/")
        
        return {
            "current_path": current_path,
            "parent_path": parent_path,
            "subdirectories": subdirs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list directory: {e}")

@app.get("/api/stream")
def stream_audio(username: str, filename: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    download_dir = Path(config.get("download_dir", ""))
    if not download_dir:
        raise HTTPException(status_code=404, detail="Download directory not configured")
         
    file_path = download_dir / filename
    try:
        resolved_path = file_path.resolve()
        resolved_download_dir = download_dir.resolve()
        if not str(resolved_path).startswith(str(resolved_download_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
        
    if not resolved_path.exists() or not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    return FileResponse(resolved_path)

@app.get("/api/cookies/status")
def get_cookies_status(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        cookie_path = profile_dir / name
        if cookie_path.exists():
            return {"status": "loaded", "filename": name}
            
    return {"status": "missing", "filename": None}

@app.post("/api/cookies/upload")
def upload_cookies(username: str, file: UploadFile = File(...)):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    # Save the file as youtube_cookies.txt
    cookie_path = profile_dir / "youtube_cookies.txt"
    try:
        content = file.file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        with open(cookie_path, "wb") as f:
            f.write(content)
        return {"status": "success", "message": "Cookies uploaded successfully", "filename": "youtube_cookies.txt"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save cookies file: {e}")

@app.delete("/api/cookies")
def delete_cookies(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    deleted_any = False
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        cookie_path = profile_dir / name
        if cookie_path.exists():
            try:
                os.remove(cookie_path)
                deleted_any = True
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to delete cookie file: {e}")
                
    if deleted_any:
        return {"status": "success", "message": "Cookies deleted successfully"}
    else:
        return {"status": "success", "message": "No cookie file found to delete"}

@app.get("/api/playlist/tracks")
def get_playlist_tracks(username: str, source_id: str, refresh: bool = False):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    sources_list = config.get("sources", [])
    modified_config = False
    for src in sources_list:
        if not src.get("id"):
            src["id"] = get_source_id(src)
            modified_config = True
    if modified_config:
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
        except Exception:
            pass
            
    source = None
    for src in sources_list:
        calculated_id = src.get("id") or get_source_id(src)
        if calculated_id == source_id or src.get("id") == source_id:
            source = src
            break
            
    if not source:
        # Fallback search by name or first source if source_id is null/undefined
        for src in sources_list:
            if src.get("name") == source_id:
                source = src
                break
                
    if not source and sources_list and (not source_id or source_id in ["null", "undefined"]):
        source = sources_list[0]
            
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    user_dir = profile_dir
    target_source_id = source.get("id") or get_source_id(source)
    cached_file = user_dir / "playlists" / f"{target_source_id}_tracks.json"
    
    tracks = []
    if not refresh and cached_file.exists():
        try:
            with open(cached_file, "r", encoding="utf-8") as cf:
                tracks = json.load(cf)
        except Exception:
            tracks = []
            
    if not tracks:
        # Load live
        src_type = source.get("type")
        url = source.get("url", "")
        
        cookie_file = None
        for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
            potential_cookie = user_dir / name
            if potential_cookie.exists():
                cookie_file = str(potential_cookie.resolve())
                break
                
        if src_type in ("youtube_music_playlist", "youtube_playlist"):
            if not url:
                raise HTTPException(status_code=400, detail="Playlist URL is missing.")
            if not cookie_file and ("list=LM" in url or "list=LL" in url or "liked" in url.lower() or "liked" in source.get("name", "").lower()):
                raise HTTPException(
                    status_code=400, 
                    detail="Your 'Liked Songs' is a private YouTube Music playlist. Please upload a cookies.txt file in Settings -> Upload Cookies File to load private playlists."
                )
            
            try:
                tracks = fetch_ytdlp_playlist(url, cookie_file, YTDLP_PATH)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to fetch playlist: {e}")
                
            if not tracks:
                if not cookie_file:
                    raise HTTPException(
                        status_code=400,
                        detail="Could not fetch playlist tracks. If this playlist is private (like Liked Songs), please upload your browser cookies.txt file in Settings."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="Could not fetch playlist tracks from YouTube. Ensure the playlist URL is valid, or export and re-upload a fresh cookies.txt file in Settings."
                    )
        elif src_type == "text_file":
            rel_path = source.get("path")
            full_path = user_dir / os.path.basename(rel_path) if rel_path else None
            if full_path and full_path.exists():
                tracks = fetch_text_file(str(full_path))
            elif rel_path and os.path.exists(rel_path):
                tracks = fetch_text_file(rel_path)
                
        # Cache them
        if tracks:
            os.makedirs(cached_file.parent, exist_ok=True)
            with open(cached_file, "w", encoding="utf-8") as cf:
                json.dump(tracks, cf, indent=2)
                
    # Also attach whether the file already exists on disk
    download_dir = config.get("download_dir")
    additional_dirs = config.get("additional_library_dirs", [])
    scan_paths = get_scan_paths(download_dir, additional_dirs, profile_dir)
    
    # Load metadata cache to guarantee matching against all 395+ downloaded tracks
    cache_file = profile_dir / "library_metadata_cache.json"
    cached_disk_files = []
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as cf:
                cache_data = json.load(cf)
                for file_path, item_data in cache_data.items():
                    meta = item_data.get("metadata", {})
                    fn = meta.get("filename") or os.path.basename(file_path)
                    title_val = meta.get("title") or Path(fn).stem
                    cached_disk_files.append({
                        "name": fn,
                        "path": file_path,
                        "title": title_val,
                        "stem": Path(fn).stem
                    })
        except Exception:
            pass
            
    disk_files = []
    seen_stems = set()
    
    # 1. Add tracks from library metadata cache
    for cdf in cached_disk_files:
        stem = cdf["stem"]
        n_stem_full = normalize_name(stem, strip_brackets=False)
        n_stem_strip = normalize_name(stem, strip_brackets=True)
        title_full = normalize_name(cdf["title"], strip_brackets=False)
        title_strip = normalize_name(cdf["title"], strip_brackets=True)
        if not n_stem_full and not n_stem_strip:
            continue
        n_parts_full = [normalize_name(p, strip_brackets=False) for p in stem.split(' - ')] if ' - ' in stem else []
        n_parts_strip = [normalize_name(p, strip_brackets=True) for p in stem.split(' - ')] if ' - ' in stem else []
        disk_files.append({
            "name": cdf["name"],
            "path": cdf["path"],
            "n_stem_full": n_stem_full,
            "n_stem_strip": n_stem_strip,
            "title_full": title_full,
            "title_strip": title_strip,
            "n_parts_full": [p for p in n_parts_full if p],
            "n_parts_strip": [p for p in n_parts_strip if p]
        })
        if n_stem_full:
            seen_stems.add(n_stem_full)

    # 2. Add tracks from live filesystem scan
    for download_path in scan_paths:
        try:
            if download_path.exists() and download_path.is_dir():
                for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac', '*.wav', '*.aac', '*.ogg']:
                    for file in download_path.rglob(ext):
                        stem = file.stem
                        n_stem_full = normalize_name(stem, strip_brackets=False)
                        if n_stem_full in seen_stems:
                            continue
                        n_stem_strip = normalize_name(stem, strip_brackets=True)
                        if not n_stem_full and not n_stem_strip:
                            continue
                        n_parts_full = [normalize_name(p, strip_brackets=False) for p in stem.split(' - ')] if ' - ' in stem else []
                        n_parts_strip = [normalize_name(p, strip_brackets=True) for p in stem.split(' - ')] if ' - ' in stem else []
                        disk_files.append({
                            "name": file.name,
                            "path": str(file),
                            "n_stem_full": n_stem_full,
                            "n_stem_strip": n_stem_strip,
                            "title_full": n_stem_full,
                            "title_strip": n_stem_strip,
                            "n_parts_full": [p for p in n_parts_full if p],
                            "n_parts_strip": [p for p in n_parts_strip if p]
                        })
                        if n_stem_full:
                            seen_stems.add(n_stem_full)
        except Exception:
            pass
                        
    has_custom_disabled_ids = "disabled_track_ids" in source and len(source.get("disabled_track_ids", [])) > 0
    disabled_ids = set(source.get("disabled_track_ids", []))
    
    formatted_tracks = []
    for t in tracks:
        display_name = t.get("display_name", "")
        title = t.get("title", "")
        artist = t.get("artist", "")
        
        t_display_full = normalize_name(display_name, strip_brackets=False)
        t_display_strip = normalize_name(display_name, strip_brackets=True)
        t_title_full = normalize_name(title, strip_brackets=False)
        t_title_strip = normalize_name(title, strip_brackets=True)
        
        artist_title = f"{artist} {title}".strip()
        t_art_title_full = normalize_name(artist_title, strip_brackets=False)
        t_art_title_strip = normalize_name(artist_title, strip_brackets=True)
        
        target_set = {t_display_full, t_display_strip, t_title_full, t_title_strip, t_art_title_full, t_art_title_strip}
        target_set.discard("")
        
        matched_file = None
        for df in disk_files:
            fn_full = df["n_stem_full"]
            fn_strip = df["n_stem_strip"]
            t_full = df.get("title_full", "")
            t_strip = df.get("title_strip", "")
            
            # 1. Exact match with any normalized title/display variant
            if (fn_full and fn_full in target_set) or (fn_strip and fn_strip in target_set) or (t_full and t_full in target_set) or (t_strip and t_strip in target_set):
                matched_file = df
                break
                
            # 2. Check parts match (e.g., "Artist - Title")
            all_df_parts = df["n_parts_full"] + df["n_parts_strip"]
            if any(p in target_set for p in all_df_parts if p):
                matched_file = df
                break
                    
            # 3. Substring containment match (if length >= 4)
            matched_sub = False
            for t_val in [t_title_full, t_title_strip, t_display_full, t_display_strip]:
                if len(t_val) >= 4:
                    if (fn_full and len(fn_full) >= 4 and (t_val in fn_full or fn_full in t_val)) or \
                       (fn_strip and len(fn_strip) >= 4 and (t_val in fn_strip or fn_strip in t_val)) or \
                       (t_full and len(t_full) >= 4 and (t_val in t_full or t_full in t_val)) or \
                       (t_strip and len(t_strip) >= 4 and (t_val in t_strip or t_strip in t_val)):
                        matched_file = df
                        matched_sub = True
                        break
            if matched_sub:
                break
                
        local_filename = matched_file["name"] if matched_file else None
        
        # Fallback to cache local_filename if it exists in any of the configured paths
        if not local_filename and t.get("local_filename"):
            for download_path in scan_paths:
                cand = download_path / t["local_filename"]
                if cand.exists():
                    local_filename = t["local_filename"]
                    matched_file = {"path": cand}
                    break
                    
        downloaded = local_filename is not None
        
        # Determine thumbnail_url if downloaded
        thumbnail_url = None
        if matched_file and matched_file.get("path"):
            thumbnail_url = f"/api/thumbnail?path={urllib.parse.quote(str(matched_file['path']))}"
        
        # Uncheck downloaded tracks by default (enabled = False if downloaded)
        if has_custom_disabled_ids:
            enabled = t["id"] not in disabled_ids
        else:
            enabled = not downloaded
        
        formatted_tracks.append({
            "id": t["id"],
            "display_name": t["display_name"],
            "title": t["title"],
            "artist": t["artist"],
            "video_id": t.get("video_id"),
            "url": t["url"],
            "duration": t.get("duration"),
            "enabled": enabled,
            "downloaded": downloaded,
            "local_filename": local_filename or t.get("local_filename"),
            "thumbnail_url": thumbnail_url
        })
        
    return {"tracks": formatted_tracks}

@app.post("/api/playlist/tracks/toggle")
def toggle_track(payload: ToggleTrackModel):
    profile_dir = USERS_DIR / payload.username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    source = None
    for src in config.get("sources", []):
        if src.get("id") == payload.source_id:
            source = src
            break
            
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    disabled = source.get("disabled_track_ids", [])
    
    if payload.enabled:
        if payload.track_id in disabled:
            disabled.remove(payload.track_id)
    else:
        if payload.track_id not in disabled:
            disabled.append(payload.track_id)
            
    source["disabled_track_ids"] = disabled
    
    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)
        
    return {"status": "success"}

@app.post("/api/playlist/tracks/toggle-all")
def toggle_all_tracks(payload: ToggleAllTracksModel):
    profile_dir = USERS_DIR / payload.username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    source = None
    for src in config.get("sources", []):
        if src.get("id") == payload.source_id:
            source = src
            break
            
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    if payload.enabled:
        source["disabled_track_ids"] = []
    else:
        # Get all track IDs from cache
        cached_file = profile_dir / "playlists" / f"{payload.source_id}_tracks.json"
        track_ids = []
        if cached_file.exists():
            try:
                with open(cached_file, "r") as cf:
                    tracks = json.load(cf)
                track_ids = [t["id"] for t in tracks]
            except Exception:
                pass
        source["disabled_track_ids"] = track_ids
        
    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)
        
    return {"status": "success"}

def bg_download_task(username: str, source_id: str, track_id: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        return
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        return
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    source = None
    for src in config.get("sources", []):
        if src.get("id") == source_id:
            source = src
            break
            
    if not source:
        return
        
    cached_file = profile_dir / "playlists" / f"{source_id}_tracks.json"
    if not cached_file.exists():
        return
        
    with open(cached_file, "r", encoding="utf-8") as cf:
        tracks = json.load(cf)
        
    target_track = None
    for t in tracks:
        if t["id"] == track_id:
            target_track = t
            break
            
    if not target_track:
        return
        
    download_dir = config.get("download_dir")
    if not download_dir:
        return
        
    cookie_file = None
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        potential_cookie = profile_dir / name
        if potential_cookie.exists():
            cookie_file = str(potential_cookie)
            break
            
    try:
        download_track_ytdlp(
            YTDLP_PATH, 
            target_track, 
            download_dir, 
            cookie_file,
            config.get("filename_template", "%(title)s.%(ext)s"),
            config.get("embed_metadata", True)
        )
    except Exception:
        pass

@app.post("/api/playlist/tracks/download-single")
def download_single_track(payload: DownloadSingleTrackModel):
    profile_dir = USERS_DIR / payload.username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    with open(config_file, "r") as f:
        config = json.load(f)
        
    source = None
    for src in config.get("sources", []):
        if src.get("id") == payload.source_id:
            source = src
            break
            
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    cached_file = profile_dir / "playlists" / f"{payload.source_id}_tracks.json"
    if not cached_file.exists():
        raise HTTPException(status_code=404, detail="Playlist tracks not cached")
        
    with open(cached_file, "r", encoding="utf-8") as cf:
        tracks = json.load(cf)
        
    target_track = None
    for t in tracks:
        if t["id"] == payload.track_id:
            target_track = t
            break
            
    if not target_track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    download_dir = config.get("download_dir")
    if not download_dir:
        raise HTTPException(status_code=400, detail="download_dir not configured")
        
    cookie_file = None
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        potential_cookie = profile_dir / name
        if potential_cookie.exists():
            cookie_file = str(potential_cookie)
            break
            
    try:
        success, output_lines = download_track_ytdlp(
            YTDLP_PATH, 
            target_track, 
            download_dir, 
            cookie_file,
            config.get("filename_template", "%(title)s.%(ext)s"),
            config.get("embed_metadata", True)
        )
        
        # Retry download without cookies if failed and cookies were used
        if not success and cookie_file:
            success_retry, output_lines_retry = download_track_ytdlp(
                YTDLP_PATH, 
                target_track, 
                download_dir, 
                None,
                config.get("filename_template", "%(title)s.%(ext)s"),
                config.get("embed_metadata", True)
            )
            output_lines.append("--- Retrying download without cookies due to failure ---")
            output_lines.extend(output_lines_retry)
            success = success_retry
            
        # Write to last_sync_log.txt so it displays on log screen
        log_file = profile_dir / "last_sync_log.txt"
        with open(log_file, "w", encoding="utf-8") as lf:
            lf.write(f"=== Single Track Download: {target_track.get('title')} ===\n")
            lf.write("\n".join(output_lines))
            lf.write(f"\nResult: {'SUCCESS' if success else 'FAILED'}\n")
            
        if not success:
            raise HTTPException(status_code=500, detail="yt-dlp download failed")
            
        # Parse the downloaded filename
        downloaded_file_path = None
        for line in output_lines:
            if "[ExtractAudio] Destination:" in line:
                downloaded_file_path = line.split("[ExtractAudio] Destination:")[1].strip()
                break
            elif "[download] Destination:" in line:
                downloaded_file_path = line.split("[download] Destination:")[1].strip()
                if downloaded_file_path.endswith((".webm", ".m4a", ".opus", ".webm")):
                    downloaded_file_path = os.path.splitext(downloaded_file_path)[0] + ".mp3"
                break
            elif "has already been downloaded" in line:
                parts = line.split("has already been downloaded")
                downloaded_file_path = parts[0].replace("[download]", "").strip()
                if downloaded_file_path.endswith((".webm", ".m4a", ".opus", ".webm")):
                    downloaded_file_path = os.path.splitext(downloaded_file_path)[0] + ".mp3"
                break
                
        filename = None
        if downloaded_file_path:
            filename = os.path.basename(downloaded_file_path)
        else:
            title_clean = target_track.get("title", "")
            for f_name in os.listdir(download_dir):
                if title_clean in f_name and f_name.endswith(".mp3"):
                    filename = f_name
                    break
            if not filename:
                filename = f"{target_track.get('title')}.mp3"
                
        # Update cache JSON
        target_track["downloaded"] = True
        target_track["local_filename"] = filename
        
        with open(cached_file, "w", encoding="utf-8") as cf:
            json.dump(tracks, cf, indent=2)
            
        return {"status": "success", "filename": filename}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sync/status")
def get_sync_status(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    state_file = profile_dir / "sync_state.json"
    state = {}
    if state_file.exists():
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
        except Exception:
            pass
            
    is_running = scheduler.is_syncing(username)
    
    # Read last log if it exists
    log_file = profile_dir / "last_sync_log.txt"
    last_log = ""
    if log_file.exists():
        try:
            with open(log_file, "r", encoding="utf-8") as lf:
                last_log = lf.read()
        except Exception:
            pass
            
    return {
        "syncing": is_running,
        "last_sync_time": state.get("last_sync_time"),
        "last_sync_status": state.get("last_sync_status"),
        "next_sync_time": state.get("next_sync_time"),
        "last_log": last_log
    }

@app.get("/api/sync/run")
def trigger_manual_sync(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
        
    state_file = profile_dir / "sync_state.json"
    
    def sse_log_generator():
        log_lines = []
        try:
            gen = run_sync_engine_generator(str(config_file), YTDLP_PATH, scheduler)
            sync_success = True
            for raw_line in gen:
                if raw_line == "SYNC_FINISHED_SUCCESS":
                    sync_success = True
                elif raw_line == "SYNC_FINISHED_FAILED":
                    sync_success = False
                elif raw_line:
                    for line in str(raw_line).splitlines():
                        clean = line.strip()
                        if clean:
                            timestamped = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {clean}"
                            log_lines.append(timestamped)
                            yield f"data: {timestamped}\n\n"
            
            # Save final logs to profile directory
            log_file = profile_dir / "last_sync_log.txt"
            with open(log_file, "w", encoding="utf-8") as lf:
                lf.write("\n".join(log_lines))
                
            # Update state file
            state = {}
            if state_file.exists():
                try:
                    with open(state_file, "r") as f:
                        state = json.load(f)
                except Exception:
                    pass
            now = datetime.datetime.now()
            state["last_sync_time"] = now.isoformat()
            state["last_sync_status"] = "SUCCESS" if sync_success else "FAILED"
            
            # Recalculate next sync
            try:
                with open(config_file, "r") as f:
                    config = json.load(f)
            except Exception:
                config = {}
            next_sync = scheduler._calculate_next_sync(now, now, config)
            state["next_sync_time"] = next_sync.isoformat() if next_sync else None
            
            with open(state_file, "w") as f:
                json.dump(state, f, indent=2)
                
        except Exception as e:
            yield f"data: FATAL RUN ERROR: {e}\n\n"
        finally:
            scheduler.release_sync(username)
            yield "data: SYNC_COMPLETE\n\n"
            
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(sse_log_generator(), media_type="text/event-stream", headers=headers)

@app.post("/api/sync/pause")
def pause_sync_endpoint(username: str):
    if username in paused_syncs:
        paused_syncs.discard(username)
        return {"status": "resumed", "paused": False}
    else:
        paused_syncs.add(username)
        return {"status": "paused", "paused": True}

@app.post("/api/sync/stop")
def stop_sync_endpoint(username: str):
    aborted_syncs.add(username)
    paused_syncs.discard(username)
    return {"status": "stopping"}

@app.get("/api/lyrics")
def get_lyrics(artist: str = "", title: str = ""):
    if not title:
        raise HTTPException(status_code=400, detail="Title parameter is required")
        
    clean_title = re.sub(r"\.(mp3|flac|m4a|wav|opus|webm|aac|ogg)$", "", title, flags=re.IGNORECASE).strip()
    clean_artist = artist.strip() if artist and artist.lower() not in ["unknown artist", "downloaded track"] else ""
    
    cache_dir = USERS_DIR / "lyrics_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = f"{clean_artist}_{clean_title}".lower()
    cache_filename = hashlib.md5(cache_key.encode("utf-8")).hexdigest() + ".json"
    cache_path = cache_dir / cache_filename
    
    if cache_path.exists():
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    lyrics_data = {"syncedLyrics": None, "plainLyrics": "Lyrics not found for this track.", "artist": clean_artist, "title": clean_title}
    try:
        url = f"https://lrclib.net/api/get?track_name={urllib.parse.quote(clean_title)}"
        if clean_artist:
            url += f"&artist_name={urllib.parse.quote(clean_artist)}"
            
        req = urllib.request.Request(url, headers={"User-Agent": "MusicGrabber/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                lyrics_data = {
                    "syncedLyrics": data.get("syncedLyrics"),
                    "plainLyrics": data.get("plainLyrics") or "No plain text lyrics available for this song.",
                    "artist": data.get("artistName") or clean_artist,
                    "title": data.get("trackName") or clean_title,
                    "album": data.get("albumName")
                }
    except Exception as e:
        logger.warning(f"Failed to fetch lyrics for {clean_title}: {e}")
        
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(lyrics_data, f, ensure_ascii=False)
    except Exception:
        pass
        
    return lyrics_data

class AddSourceModel(BaseModel):
    username: str
    name: str
    url: str
    type: Optional[str] = "youtube_music_playlist"

@app.post("/api/ytmusic/add-source")
def add_ytmusic_source(payload: AddSourceModel):
    profile_dir = USERS_DIR / payload.username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config file not found")
        
    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    sources = config.get("sources", [])
    
    # Check if already added
    for src in sources:
        if src.get("url") == payload.url or src.get("name") == payload.name:
            return {"status": "exists", "message": "Playlist is already in your sources!"}
            
    new_src = {
        "id": f"src_{int(time.time() * 1000)}",
        "type": payload.type or "youtube_music_playlist",
        "name": payload.name,
        "url": payload.url,
        "path": "",
        "disabled_track_ids": []
    }
    
    sources.append(new_src)
    config["sources"] = sources
    
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    return {"status": "success", "message": f"Added '{payload.name}' to your playlists!", "source": new_src}

@app.get("/api/ytmusic/discover")
def discover_ytmusic(username: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    cookie_file = None
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        potential_cookie = profile_dir / name
        if potential_cookie.exists():
            cookie_file = str(potential_cookie.resolve())
            break
            
    # Cache valid for 2 hours
    cache_file = profile_dir / "ytmusic_discover_cache.json"
    if cache_file.exists():
        try:
            stat = cache_file.stat()
            if (time.time() - stat.st_mtime) < 7200:
                with open(cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
            
    playlists_to_fetch = [
        {
            "name": "Tollywood Hitlist",
            "url": "https://www.youtube.com/playlist?list=RDCLAK5uy_lyVnWI5JnuwKJiuE-n1x-Un0mj9WlEyZw",
            "description": "Top trending Telugu music hits on YouTube Music",
            "thumbnail": "https://i.ytimg.com/vi/a3Ue-LN5B9U/mqdefault.jpg"
        },
        {
            "name": "New Music Telugu",
            "url": "https://www.youtube.com/playlist?list=RDCLAK5uy_l8CaYQvBQWVT2st1VsW9JjODWisR_vd3U",
            "description": "Fresh new releases and chartbusters",
            "thumbnail": "https://i.ytimg.com/vi/d_w3u7X4KkY/mqdefault.jpg"
        },
        {
            "name": "Iconic Tollywood Hits",
            "url": "https://www.youtube.com/playlist?list=RDCLAK5uy_kNVZmuXhmEKIMMdOtksUzOwpJ98rZMvo8",
            "description": "All-time popular Tollywood hit songs",
            "thumbnail": "https://i.ytimg.com/vi/3RlhXn69yJg/mqdefault.jpg"
        },
        {
            "name": "Trending Music Hits",
            "url": "https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj",
            "description": "Worldwide popular music tracks and chartbusters",
            "thumbnail": "https://i.ytimg.com/vi/kffacxfA7G4/mqdefault.jpg"
        }
    ]
    
    quick_picks = []
    try:
        quick_picks = fetch_ytdlp_playlist(playlists_to_fetch[0]["url"], cookie_file, YTDLP_PATH)[:12]
    except Exception:
        pass
        
    trending_songs = []
    try:
        trending_songs = fetch_ytdlp_playlist(playlists_to_fetch[1]["url"], cookie_file, YTDLP_PATH)[:12]
    except Exception:
        pass
        
    recommended_artists = [
        {"name": "Anirudh Ravichander", "genre": "Tamil / EDM"},
        {"name": "Sid Sriram", "genre": "Indian / Classical"},
        {"name": "Sai Abhyankkar", "genre": "Indie / Pop"},
        {"name": "Taylor Swift", "genre": "Pop / Country"},
        {"name": "A.R. Rahman", "genre": "Soundtrack / World"},
        {"name": "Justin Bieber", "genre": "Pop / R&B"},
        {"name": "Bruno Mars", "genre": "Funk / Pop"},
        {"name": "Charlie Puth", "genre": "Pop / Mainstream"}
    ]
    
    result = {
        "quick_picks": quick_picks,
        "trending_songs": trending_songs,
        "recommended_playlists": playlists_to_fetch,
        "recommended_artists": recommended_artists
    }
    
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    except Exception:
        pass
        
    return result

@app.get("/api/ytmusic/search")
def search_ytmusic(username: str, query: str):
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter is required")
        
    profile_dir = USERS_DIR / username
    cookie_file = None
    if profile_dir.exists():
        for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
            potential_cookie = profile_dir / name
            if potential_cookie.exists():
                cookie_file = str(potential_cookie.resolve())
                break
                
    try:
        # Search YouTube songs
        song_search_url = f"ytsearch12:{query.strip()}"
        songs = fetch_ytdlp_playlist(song_search_url, cookie_file, YTDLP_PATH)
        
        # Search YouTube playlists matching query
        playlist_search_url = f"ytsearch4:{query.strip()} playlist"
        playlists_raw = fetch_ytdlp_playlist(playlist_search_url, cookie_file, YTDLP_PATH)
        
        playlists = []
        for p in playlists_raw:
            vid_id = p.get("id") or p.get("video_id")
            thumb = p.get("thumbnail") or (f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg" if vid_id else "")
            playlists.append({
                "name": p.get("title") or p.get("display_name") or "YouTube Playlist",
                "url": p.get("url") or (f"https://www.youtube.com/watch?v={vid_id}" if vid_id else ""),
                "description": f"By {p.get('artist') or 'YouTube Creator'}",
                "thumbnail": thumb
            })
            
        return {
            "status": "success",
            "query": query,
            "songs": songs,
            "playlists": playlists
        }
    except Exception as e:
        print(f"Error in YouTube Music search for '{query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ytmusic/playlist-tracks")
def get_ytmusic_playlist_preview(username: str, url: str):
    profile_dir = USERS_DIR / username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    cookie_file = None
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
        potential_cookie = profile_dir / name
        if potential_cookie.exists():
            cookie_file = str(potential_cookie.resolve())
            break
            
    try:
        tracks = fetch_ytdlp_playlist(url, cookie_file, YTDLP_PATH)
        return {"status": "success", "tracks": tracks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/playlists/export")
def export_playlists(username: str):
    profile_dir = USERS_DIR / username
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config not found")
    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)
    sources = config.get("sources", [])
    
    export_data = {
        "version": "1.0",
        "exported_at": datetime.datetime.now().isoformat(),
        "username": username,
        "sources": sources
    }
    
    headers = {"Content-Disposition": f"attachment; filename={username}_playlists_export.json"}
    return StreamingResponse(
        io.BytesIO(json.dumps(export_data, indent=2).encode("utf-8")),
        media_type="application/json",
        headers=headers
    )

class ImportPlaylistsModel(BaseModel):
    username: str
    sources: List[dict]

@app.post("/api/playlists/import")
def import_playlists(payload: ImportPlaylistsModel):
    profile_dir = USERS_DIR / payload.username
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
        
    config_file = profile_dir / "sync_config.json"
    if not config_file.exists():
        raise HTTPException(status_code=404, detail="Config file not found")
        
    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    existing_sources = config.get("sources", [])
    existing_urls = {s.get("url") for s in existing_sources if s.get("url")}
    existing_names = {s.get("name") for s in existing_sources if s.get("name")}
    
    added_count = 0
    for src in payload.sources:
        url = src.get("url")
        name = src.get("name", "Imported Playlist")
        if (url and url in existing_urls) or (name in existing_names):
            continue
            
        new_src = {
            "id": f"src_{int(time.time() * 1000) + added_count}",
            "type": src.get("type", "youtube_music_playlist"),
            "name": name,
            "url": url or "",
            "path": src.get("path", ""),
            "disabled_track_ids": src.get("disabled_track_ids", [])
        }
        existing_sources.append(new_src)
        added_count += 1
        
    config["sources"] = existing_sources
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
        
    return {"status": "success", "message": f"Successfully imported {added_count} new playlist(s)!", "added_count": added_count}

@app.get("/api/ytmusic/suggestions")
def get_ytmusic_suggestions(query: str):
    if not query or not query.strip():
        return {"suggestions": []}
    try:
        url = f"https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q={urllib.parse.quote(query.strip())}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list):
                return {"suggestions": data[1][:8]}
    except Exception as e:
        print(f"Error fetching suggestions for '{query}': {e}")
    return {"suggestions": []}

