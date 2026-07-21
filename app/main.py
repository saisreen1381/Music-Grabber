import os
import json
import datetime
import urllib.parse
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
    download_track_ytdlp,
    paused_syncs,
    aborted_syncs
)
from app.scheduler import BackgroundScheduler

app = FastAPI(title="Music Grabber UI")

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
        if "id" not in src:
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
    if not download_dir:
        return {"files": []}
        
    files = scan_existing_files_detailed(download_dir)
    return {"files": files}

import subprocess

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
        
        title = tags.get("title") or tags.get("TITLE") or file_path.name
        artist = tags.get("artist") or tags.get("ARTIST") or "Unknown Artist"
        genre = tags.get("genre") or tags.get("GENRE") or "Unknown Genre"
        album = tags.get("album") or tags.get("ALBUM") or "Unknown Album"
        
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
            "title": file_path.name,
            "artist": "Unknown Artist",
            "genre": "Unknown Genre",
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
        scan_paths.append(Path(download_dir))
    for d in additional_dirs:
        if d:
            scan_paths.append(Path(d))
            
    songs = []
    seen_file_paths = set()
    for download_path in scan_paths:
        if download_path.exists() and download_path.is_dir():
            for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac']:
                for file in download_path.rglob(ext):
                    abs_path = str(file.resolve())
                    if abs_path not in seen_file_paths:
                        seen_file_paths.add(abs_path)
                        songs.append(get_file_metadata(file))
            
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
        
    source = None
    for src in config.get("sources", []):
        if src.get("id") == source_id:
            source = src
            break
            
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    user_dir = profile_dir
    cached_file = user_dir / "playlists" / f"{source_id}_tracks.json"
    
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
                cookie_file = str(potential_cookie)
                break
                
        if src_type in ("youtube_music_playlist", "youtube_playlist"):
            if url:
                tracks = fetch_ytdlp_playlist(url, cookie_file, YTDLP_PATH)
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
    
    scan_paths = []
    if download_dir:
        scan_paths.append(Path(download_dir))
    for d in additional_dirs:
        if d:
            scan_paths.append(Path(d))
            
    norm_to_filename = {}
    for download_path in scan_paths:
        if download_path.exists() and download_path.is_dir():
            for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac']:
                for file in download_path.rglob(ext):
                    norm = normalize_name(file.stem)
                    if norm:
                        norm_to_filename[norm] = file.name
                        
    disabled_ids = set(source.get("disabled_track_ids", []))
    
    formatted_tracks = []
    for t in tracks:
        norm = normalize_name(t["display_name"])
        local_filename = norm_to_filename.get(norm)
        
        # Fallback to cache local_filename if it exists in any of the configured paths
        if not local_filename and t.get("local_filename"):
            for download_path in scan_paths:
                cand = download_path / t["local_filename"]
                if cand.exists():
                    local_filename = t["local_filename"]
                    break
                    
        downloaded = local_filename is not None
        
        # Determine thumbnail_url if downloaded
        thumbnail_url = None
        if local_filename:
            for download_path in scan_paths:
                cand = download_path / local_filename
                if cand.exists():
                    thumbnail_url = f"/api/thumbnail?path={urllib.parse.quote(str(cand))}"
                    break
        
        formatted_tracks.append({
            "id": t["id"],
            "display_name": t["display_name"],
            "title": t["title"],
            "artist": t["artist"],
            "video_id": t.get("video_id"),
            "url": t["url"],
            "duration": t.get("duration"),
            "enabled": t["id"] not in disabled_ids,
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
    
    # Check scheduler lock
    success = scheduler.trigger_manual_sync(username, config_file)
    if not success:
        raise HTTPException(status_code=409, detail="A synchronization is already in progress for this profile.")
        
    def sse_log_generator():
        log_lines = []
        try:
            gen = run_sync_engine_generator(str(config_file), YTDLP_PATH)
            sync_success = True
            for line in gen:
                if line == "SYNC_FINISHED_SUCCESS":
                    sync_success = True
                elif line == "SYNC_FINISHED_FAILED":
                    sync_success = False
                else:
                    timestamped = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {line}"
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
