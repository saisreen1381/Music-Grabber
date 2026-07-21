import os
import json
import datetime
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.sync_engine import (
    run_sync_engine_generator, 
    scan_existing_files_detailed,
    scan_existing_files,
    fetch_ytdlp_playlist,
    fetch_text_file,
    get_source_id,
    normalize_name
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
            
    try:
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {e}")
        
    return {"status": "success", "config": config_dict}

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
                
        requires_cookies = False
        if src_type == "youtube_music_playlist" and "list=LM" in url:
            requires_cookies = True
            
        if src_type in ("youtube_music_playlist", "youtube_playlist"):
            if url:
                tracks = fetch_ytdlp_playlist(url, cookie_file if requires_cookies else None, YTDLP_PATH)
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
    existing_normalized = scan_existing_files(download_dir) if download_dir else set()
    
    disabled_ids = set(source.get("disabled_track_ids", []))
    
    formatted_tracks = []
    for t in tracks:
        norm = normalize_name(t["display_name"])
        formatted_tracks.append({
            "id": t["id"],
            "display_name": t["display_name"],
            "title": t["title"],
            "artist": t["artist"],
            "video_id": t.get("video_id"),
            "url": t["url"],
            "duration": t.get("duration"),
            "enabled": t["id"] not in disabled_ids,
            "downloaded": norm in existing_normalized
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

@app.post("/api/sync/run")
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
                    log_lines.append(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {line}")
                    yield f"data: {line}\n\n"
            
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
            
    return StreamingResponse(sse_log_generator(), media_type="text/event-stream")
