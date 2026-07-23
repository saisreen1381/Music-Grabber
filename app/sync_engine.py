import os
import sys
import json
import re
import subprocess
import hashlib
import queue
import threading
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def find_ytdlp():
    import shutil, sys
    path_bin = shutil.which("yt-dlp")
    if path_bin:
        return path_bin
        
    py_dir = os.path.dirname(sys.executable)
    candidates = [
        os.path.join(py_dir, "yt-dlp.exe"),
        os.path.join(py_dir, "yt-dlp"),
        os.path.join(py_dir, "Scripts", "yt-dlp.exe"),
        os.path.expanduser("~/.local/share/pipx/venvs/spotdl/bin/yt-dlp"),
        os.path.expanduser("~/pipx/venvs/spotdl/Scripts/yt-dlp.exe"),
        os.path.expanduser("~/AppData/Local/Packages/PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0/LocalCache/local-packages/Python313/Scripts/yt-dlp.exe"),
        os.path.expanduser("~/AppData/Local/Programs/Python/Python313/Scripts/yt-dlp.exe"),
        os.path.expanduser("~/AppData/Roaming/Python/Python313/Scripts/yt-dlp.exe"),
        os.path.expanduser("~/AppData/Local/Programs/Python/Python312/Scripts/yt-dlp.exe"),
    ]
    for cand in candidates:
        if os.path.exists(cand):
            return cand
    return "yt-dlp"

def get_ytdlp_path(custom_path=None):
    if custom_path and custom_path != "yt-dlp" and os.path.exists(custom_path):
        return custom_path
    return find_ytdlp()

# Normalize strings for comparison (preserves Unicode letters and digits for all languages like Tamil, English, Hindi, etc.)
def normalize_name(name, strip_brackets=True):
    if not name:
        return ""
    name = str(name).lower()
    if strip_brackets:
        # Strip common suffixes/prefixes like [Official Video], (Lyrics), (From "..."), etc.
        name = re.sub(r'\[.*?\]', '', name)
        name = re.sub(r'\(.*?\)', '', name)
    # Convert fullwidth/unicode characters to standard equivalents
    name = name.replace('｜', '|').replace('—', '-').replace('：', ':')
    # Remove non-word characters while preserving Unicode letters and digits
    cleaned = re.sub(r'[^\w]', '', name, flags=re.UNICODE)
    if not cleaned:
        return name.strip()
    return cleaned.strip()

def is_track_downloaded(track, existing_songs):
    """
    Global canonical backend helper to determine if a track is downloaded on disk,
    given a set of normalized existing filenames or scan items.
    """
    if not track or not existing_songs:
        return False

    title = track.get("title") or ""
    display_name = track.get("display_name") or ""
    local_filename = track.get("local_filename") or track.get("filename") or ""

    norm_title_full = normalize_name(title, strip_brackets=False)
    norm_title_strip = normalize_name(title, strip_brackets=True)
    norm_disp_full = normalize_name(display_name, strip_brackets=False)
    norm_disp_strip = normalize_name(display_name, strip_brackets=True)
    norm_fn_full = normalize_name(local_filename, strip_brackets=False)
    norm_fn_strip = normalize_name(local_filename, strip_brackets=True)

    norms = {norm_title_full, norm_title_strip, norm_disp_full, norm_disp_strip, norm_fn_full, norm_fn_strip}
    norms.discard("")

    if any(n in existing_songs for n in norms):
        return True

    # Substring containment match for strings length >= 4
    for n in norms:
        if len(n) >= 4:
            for fn in existing_songs:
                if len(fn) >= 4 and (n in fn or fn in n):
                    return True

    return False

def get_user_cookie_file(profile_dir):
    """
    Global helper to discover and return the active cookies file path for a user profile.
    """
    if not profile_dir:
        return None
    p_dir = Path(profile_dir)
    if not p_dir.exists():
        return None
    for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt", "cookies.txt"]:
        potential = p_dir / name
        if potential.exists():
            return str(potential.resolve())
    return None

def get_user_config(profile_dir):
    """
    Global helper to load user sync config dictionary from profile directory.
    """
    if not profile_dir:
        return None
    config_file = Path(profile_dir) / "sync_config.json"
    if not config_file.exists():
        return None
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config from {config_file}: {e}")
        return None

def save_user_config(profile_dir, config):
    """
    Global helper to safely save user sync config to profile directory.
    """
    if not profile_dir or not isinstance(config, dict):
        return False
    config_file = Path(profile_dir) / "sync_config.json"
    try:
        os.makedirs(Path(profile_dir), exist_ok=True)
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config to {config_file}: {e}")
        return False

def extract_youtube_video_id(val):
    """
    Global helper to extract an 11-character YouTube Video ID from a URL or string.
    """
    if not val:
        return ""
    val_str = str(val).strip()
    if len(val_str) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', val_str):
        return val_str
    match = re.search(r'(?:v=|\/vi\/|\/watch\?v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', val_str)
    if match:
        return match.group(1)
    return ""

def get_scan_paths(download_dir, additional_dirs=None, profile_dir=None):
    scan_paths = []
    if download_dir:
        p = Path(download_dir)
        if p.exists():
            scan_paths.append(p)
        try:
            p_res = p.resolve()
            if p_res.exists() and p_res not in scan_paths:
                scan_paths.append(p_res)
        except Exception:
            pass
        if profile_dir and not p.is_absolute():
            try:
                rel_p = (profile_dir / download_dir).resolve()
                if rel_p.exists() and rel_p not in scan_paths:
                    scan_paths.append(rel_p)
            except Exception:
                pass
                
    for d in (additional_dirs or []):
        if d:
            dp = Path(d)
            if dp.exists() and dp not in scan_paths:
                scan_paths.append(dp)
            try:
                dp_res = dp.resolve()
                if dp_res.exists() and dp_res not in scan_paths:
                    scan_paths.append(dp_res)
            except Exception:
                pass
                
    # Always include standard fallback directories if they exist
    for fallback in [Path("downloads").resolve(), Path("music").resolve()]:
        if fallback.exists() and fallback not in scan_paths:
            scan_paths.append(fallback)
            
    if profile_dir:
        try:
            prof_dl = (profile_dir / "downloads").resolve()
            if prof_dl.exists() and prof_dl not in scan_paths:
                scan_paths.append(prof_dl)
        except Exception:
            pass
            
    return scan_paths

def get_source_id(source):
    if "id" in source:
        return source["id"]
    # Deterministic ID based on URL or path
    key = source.get("url") or source.get("path") or source.get("name", "")
    return hashlib.md5(key.encode("utf-8")).hexdigest()

def scan_existing_files(download_dir, additional_dirs=None, profile_dir=None):
    existing_songs = set()
    
    # 1. Read from library metadata cache if available
    if profile_dir:
        cache_file = Path(profile_dir) / "library_metadata_cache.json"
        if cache_file.exists():
            try:
                with open(cache_file, "r", encoding="utf-8") as cf:
                    cache_data = json.load(cf)
                    for file_path, item_data in cache_data.items():
                        meta = item_data.get("metadata", {})
                        fn = meta.get("filename") or os.path.basename(file_path)
                        stem = Path(fn).stem
                        title = meta.get("title") or stem
                        norm_full = normalize_name(stem, strip_brackets=False)
                        norm_strip = normalize_name(stem, strip_brackets=True)
                        norm_title = normalize_name(title, strip_brackets=False)
                        if norm_full:
                            existing_songs.add(norm_full)
                        if norm_strip:
                            existing_songs.add(norm_strip)
                        if norm_title:
                            existing_songs.add(norm_title)
            except Exception:
                pass

    # 2. Scan live filesystem paths
    scan_paths = get_scan_paths(download_dir, additional_dirs, profile_dir)
    for download_path in scan_paths:
        try:
            if download_path.exists() and download_path.is_dir():
                for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac', '*.wav', '*.aac', '*.ogg']:
                    for file in download_path.rglob(ext):
                        base_name = file.stem
                        norm_full = normalize_name(base_name, strip_brackets=False)
                        norm_strip = normalize_name(base_name, strip_brackets=True)
                        if norm_full:
                            existing_songs.add(norm_full)
                        if norm_strip:
                            existing_songs.add(norm_strip)
        except Exception:
            pass
    return existing_songs

def scan_existing_files_detailed(download_dir, additional_dirs=None, profile_dir=None):
    files = []
    seen_paths = set()
    scan_paths = get_scan_paths(download_dir, additional_dirs, profile_dir)
        
    for download_path in scan_paths:
        if download_path.exists() and download_path.is_dir():
            for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac', '*.wav', '*.aac', '*.ogg']:
                for file in download_path.rglob(ext):
                    try:
                        abs_p = str(file.resolve())
                        if abs_p not in seen_paths:
                            seen_paths.add(abs_p)
                            stat = file.stat()
                            files.append({
                                "name": file.name,
                                "path": str(file),
                                "size_bytes": stat.st_size,
                                "modified_at": stat.st_mtime
                            })
                    except Exception:
                        pass
                
    # Sort files by modified time descending (newest first)
    files.sort(key=lambda x: x["modified_at"], reverse=True)
    return files

def run_cmd(args, capture_output=True, text=True):
    try:
        result = subprocess.run(
            args,
            capture_output=capture_output,
            text=text,
            check=False
        )
        if result.returncode != 0 and not result.stdout:
            print(f"Command exited with code {result.returncode}: {' '.join(args)}")
            if capture_output and result.stderr:
                print(f"Stderr: {result.stderr[:500]}")
            return None
        return result.stdout
    except Exception as e:
        print(f"Error running command {' '.join(args)}: {e}")
        return None

def safe_str(val):
    if val is None:
        return ""
    return str(val).strip()

def extract_thumbnail(item):
    if not item or not isinstance(item, dict):
        return ""
    
    thumb = item.get("thumbnail")
    if isinstance(thumb, str) and thumb.strip():
        return thumb.strip()
        
    thumbnails = item.get("thumbnails")
    if isinstance(thumbnails, list) and len(thumbnails) > 0:
        for t in reversed(thumbnails):
            if isinstance(t, dict):
                url = t.get("url")
                if isinstance(url, str) and url.strip():
                    return url.strip()
                    
    vid_id = safe_str(item.get("id") or item.get("video_id"))
    if vid_id and not vid_id.startswith("PL") and not vid_id.startswith("RD") and not vid_id.startswith("OL"):
        return f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
        
    return ""

def fetch_ytdlp_playlist(url, cookie_file=None, ytdlp_path="yt-dlp"):
    ytdlp_path = get_ytdlp_path(ytdlp_path)
    clean_url = str(url)
    if "music.youtube.com/playlist?list=" in clean_url:
        clean_url = clean_url.replace("music.youtube.com/playlist?list=", "www.youtube.com/playlist?list=")
    elif "music.youtube.com/watch?" in clean_url:
        clean_url = clean_url.replace("music.youtube.com/watch?", "www.youtube.com/watch?")
        
    cmd = [ytdlp_path, "--flat-playlist", "--dump-single-json", "--no-warnings"]
    if cookie_file and os.path.exists(cookie_file):
        cmd.extend(["--cookies", cookie_file])
    cmd.append(clean_url)
    
    output = run_cmd(cmd)

    def is_invalid_output(out_str):
        if not out_str or not out_str.strip():
            return True
        return out_str.strip().lower() in ["null", "none", "{}"]

    # 1. Fallback: Retry without cookie_file if cookies output null or empty
    if is_invalid_output(output) and cookie_file:
        cmd_nocookie = []
        skip_next = False
        for token in cmd:
            if skip_next:
                skip_next = False
                continue
            if token == "--cookies":
                skip_next = True
                continue
            cmd_nocookie.append(token)
        output = run_cmd(cmd_nocookie)

    # 2. Fallback: Retry without js-runtimes node parameter
    if is_invalid_output(output):
        cmd_fallback = [c for c in cmd if c not in ["--js-runtimes", "node", "--cookies", str(cookie_file)]]
        output = run_cmd(cmd_fallback)

    if is_invalid_output(output):
        return []

    try:
        data = json.loads(output)
        if not data or not isinstance(data, dict):
            return []

        entries = data.get("entries")
        if entries is None or not isinstance(entries, list):
            # Check if single video contains chapters (e.g. Jukebox videos)
            chapters = data.get("chapters")
            if chapters and isinstance(chapters, list) and len(chapters) > 0:
                vid_id = safe_str(data.get("id"))
                vid_uploader = safe_str(data.get("uploader") or data.get("artist") or data.get("channel") or data.get("creator"))
                vid_thumb = extract_thumbnail(data)
                chapter_tracks = []
                for ch in chapters:
                    if not ch or not isinstance(ch, dict):
                        continue
                    ch_title = safe_str(ch.get("title"))
                    if not ch_title:
                        continue
                    ch_start = ch.get("start_time") or 0
                    ch_end = ch.get("end_time") or 0
                    ch_dur = (ch_end - ch_start) if (isinstance(ch_end, (int, float)) and isinstance(ch_start, (int, float)) and ch_end > ch_start) else None
                    chapter_tracks.append({
                        "id": f"{vid_id}_ch_{int(ch_start or 0)}",
                        "display_name": ch_title,
                        "title": ch_title,
                        "artist": vid_uploader or "YouTube Artist",
                        "video_id": vid_id,
                        "duration": ch_dur,
                        "thumbnail": vid_thumb,
                        "url": f"https://www.youtube.com/watch?v={vid_id}" if vid_id else None
                    })
                if chapter_tracks:
                    return chapter_tracks

            if safe_str(data.get("title")):
                entries = [data]
            else:
                entries = []

        tracks = []
        for idx, entry in enumerate(entries):
            if not entry or not isinstance(entry, dict):
                continue
            title = safe_str(entry.get("title"))
            if not title or title in ["[Deleted video]", "[Private video]", "[Unavailable video]"]:
                continue
            uploader = safe_str(entry.get("uploader") or entry.get("artist") or entry.get("channel") or entry.get("creator"))
            video_id = safe_str(entry.get("id") or entry.get("video_id"))
            duration = entry.get("duration")
            if not isinstance(duration, (int, float)):
                duration = None
            
            # Combine artist - title if uploader is present and not already in title
            if uploader and uploader.lower() not in title.lower():
                display_name = f"{uploader} - {title}"
            else:
                display_name = title
                
            thumbnail = extract_thumbnail(entry)

            tracks.append({
                "id": video_id or f"track_{idx}",
                "display_name": display_name,
                "title": title,
                "artist": uploader or "YouTube Artist",
                "video_id": video_id,
                "duration": duration,
                "thumbnail": thumbnail,
                "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None
            })
        return tracks
    except Exception as e:
        print(f"Error parsing playlist JSON: {e}")
        return []

def fetch_text_file(path):
    tracks = []
    if not os.path.exists(path):
        return tracks
        
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            # Use stable hash of the line as its ID
            track_id = hashlib.md5(line.encode("utf-8")).hexdigest()
            tracks.append({
                "id": track_id,
                "display_name": line,
                "title": line,
                "artist": "",
                "video_id": None,
                "url": f"ytmsearch1:{line}"
            })
    return tracks

def download_track_ytdlp(ytdlp_path, track, download_dir, cookie_file=None, filename_template="%(title)s.%(ext)s", embed_metadata=True):
    ytdlp_path = get_ytdlp_path(ytdlp_path)
    url = track["url"]
    
    target_title = track.get("title") or track.get("display_name") or ""
    if target_title and filename_template == "%(title)s.%(ext)s":
        sanitized_title = re.sub(r'[\\/:*?"<>|]', '_', target_title)
        out_tmpl = os.path.join(download_dir, f"{sanitized_title}.%(ext)s")
    else:
        out_tmpl = os.path.join(download_dir, filename_template)

    cmd = [
        ytdlp_path,
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--output", out_tmpl,
        "--match-filter", "!is_live",
        "--js-runtimes", "deno,node"
    ]
    
    if embed_metadata:
        cmd.extend(["--embed-metadata", "--embed-thumbnail"])
        
    if cookie_file and os.path.exists(cookie_file):
        cmd.extend(["--cookies", cookie_file])
        
    cmd.append(url)
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        output_lines = []
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line = line.strip()
                output_lines.append(line)
        rc = process.poll()
        
        # Scan output lines for destination path
        downloaded_file_path = None
        for line in output_lines:
            if "has already been downloaded" in line:
                return True, output_lines
            elif "[ExtractAudio] Destination:" in line:
                downloaded_file_path = line.split("[ExtractAudio] Destination:")[1].strip()
                break
            elif "[download] Destination:" in line:
                downloaded_file_path = line.split("[download] Destination:")[1].strip()
                if downloaded_file_path.endswith((".webm", ".m4a", ".opus", ".webm")):
                    downloaded_file_path = os.path.splitext(downloaded_file_path)[0] + ".mp3"
                break
                
        # Success if file exists
        if downloaded_file_path and os.path.exists(downloaded_file_path):
            return True, output_lines
            
        return rc == 0, output_lines
    except Exception as e:
        return False, [f"Error running subprocess: {e}"]

paused_syncs = set()
aborted_syncs = set()

# Generator function for streaming sync logs to FastAPI SSE
def run_sync_engine_generator(config_path, ytdlp_path="yt-dlp", scheduler=None):
    ytdlp_path = get_ytdlp_path(ytdlp_path)
    log_queue = queue.Queue()
    username = Path(config_path).parent.name
    
    def emit(msg):
        log_queue.put(msg)
        
    def worker_thread():
        username = Path(config_path).parent.name
        try:
            emit("=== Starting Music Synchronization Process ===")
            if not os.path.exists(config_path):
                emit(f"ERROR: Configuration file not found at {config_path}")
                emit("SYNC_FINISHED_FAILED")
                return
                
            with open(config_path, "r") as f:
                config = json.load(f)
                
            download_dir = config.get("download_dir")
            sources = config.get("sources", [])
            filename_template = config.get("filename_template", "%(title)s.%(ext)s")
            embed_metadata = config.get("embed_metadata", True)
            max_concurrent = min(max(int(config.get("max_concurrent_downloads", 3)), 1), 5)
            
            if not download_dir:
                emit("ERROR: 'download_dir' is not specified in config.")
                emit("SYNC_FINISHED_FAILED")
                return
                
            os.makedirs(download_dir, exist_ok=True)
            
            # 1. Scan destination
            emit(f"Scanning existing files in '{download_dir}'...")
            existing_songs = scan_existing_files(download_dir)
            emit(f"Found {len(existing_songs)} unique existing tracks in folder.")
            
            # 2. Gather tracks from all sources
            all_tracks = []
            seen_normalized = set()
            
            user_dir = os.path.dirname(config_path)
            cookie_file = get_user_cookie_file(user_dir)
                    
            def fetch_single_source(src):
                src_type = src.get("type")
                src_name = src.get("name", "Unnamed Source")
                url = src.get("url", "")
                src_id = get_source_id(src)
                disabled_ids = set(src.get("disabled_track_ids", []))
                requires_cookies = (cookie_file is not None)

                emit(f"Checking playlist '{src_name}'...")
                cached_file = os.path.join(user_dir, "playlists", f"{src_id}_tracks.json")
                tracks = []

                if os.path.exists(cached_file):
                    try:
                        with open(cached_file, "r", encoding="utf-8") as cf:
                            tracks = json.load(cf)
                        emit(f"  Loaded {len(tracks)} tracks for '{src_name}' (cache).")
                    except Exception:
                        tracks = []

                if not tracks:
                    emit(f"  Fetching '{src_name}' live from YouTube Music...")
                    if src_type in ("youtube_music_playlist", "youtube_playlist"):
                        if url:
                            tracks = fetch_ytdlp_playlist(url, cookie_file if requires_cookies else None, ytdlp_path)
                    elif src_type == "text_file":
                        rel_path = src.get("path")
                        full_path = os.path.join(user_dir, os.path.basename(rel_path)) if rel_path else None
                        if full_path and os.path.exists(full_path):
                            tracks = fetch_text_file(full_path)
                        elif rel_path and os.path.exists(rel_path):
                            tracks = fetch_text_file(rel_path)

                    if tracks:
                        os.makedirs(os.path.dirname(cached_file), exist_ok=True)
                        with open(cached_file, "w", encoding="utf-8") as cf:
                            json.dump(tracks, cf)

                return (src_name, tracks, disabled_ids, requires_cookies)

            max_source_workers = min(max(len(sources), 1), 5)
            with ThreadPoolExecutor(max_workers=max_source_workers) as src_executor:
                src_futures = [src_executor.submit(fetch_single_source, s) for s in sources]
                for fut in as_completed(src_futures):
                    try:
                        src_name, tracks, disabled_ids, requires_cookies = fut.result()
                        for track in tracks:
                            norm = normalize_name(track.get("display_name", ""), strip_brackets=False) or normalize_name(track.get("display_name", ""), strip_brackets=True)
                            if norm not in seen_normalized:
                                if track.get("id") in disabled_ids:
                                    continue
                                seen_normalized.add(norm)
                                track["use_cookies"] = requires_cookies
                                all_tracks.append(track)
                    except Exception as e:
                        emit(f"Error processing source: {e}")
                        
            emit(f"Total checked unique target tracks: {len(all_tracks)}")
            
            # 3. Filter out existing tracks
            to_download = []
            for track in all_tracks:
                if not is_track_downloaded(track, existing_songs):
                    to_download.append(track)
                    
            emit(f"Tracks already downloaded: {len(all_tracks) - len(to_download)}")
            emit(f"New tracks to download: {len(to_download)}")
            
            if not to_download:
                emit("All songs are up-to-date! Synchronization completed successfully.")
                emit("SYNC_FINISHED_SUCCESS")
                return
                
            # 4. Download concurrently
            success_count = 0
            fail_count = 0
            
            emit(f"Starting downloads with concurrency level: {max_concurrent}")
            
            # Lock for count increments
            count_lock = threading.Lock()
            
            def download_worker(index, track):
                nonlocal success_count, fail_count
                
                # Check pause state inside the worker thread
                while username in paused_syncs:
                    time.sleep(0.5)
                    if username in aborted_syncs:
                        return
                        
                if username in aborted_syncs:
                    return
                t_name = f"Worker-{index+1}"
                ext = "mp3"
                title_val = track.get("title") or track.get("display_name") or ""
                artist_val = track.get("artist") or ""
                id_val = track.get("video_id") or track.get("id") or ""
                track_filename = (filename_template
                                  .replace("%(title)s", title_val)
                                  .replace("%(artist)s", artist_val)
                                  .replace("%(id)s", id_val)
                                  .replace("%(ext)s", ext))
                track_filename = os.path.basename(track_filename)
                
                emit(f"[{t_name}] Starting download: {track_filename}")
                
                use_cookies = track.get("use_cookies", False) and cookie_file is not None
                
                success, output_lines = download_track_ytdlp(
                    ytdlp_path, track, download_dir, 
                    cookie_file if use_cookies else None,
                    filename_template, embed_metadata
                )
                
                # Retry without cookies if cookies were invalid
                if not success and use_cookies:
                    emit(f"[{t_name}] Retrying without cookies: {track_filename}")
                    success, output_lines = download_track_ytdlp(
                        ytdlp_path, track, download_dir, 
                        None,
                        filename_template, embed_metadata
                    )
                    
                # Search fallback if video unavailable or URL dead
                if not success:
                    raw_title = track.get("title") or ""
                    raw_artist = track.get("artist") or ""
                    clean_artist = re.sub(r'[^\w\s]', '', raw_artist).replace("Topic", "").strip()
                    if clean_artist and clean_artist.lower() not in raw_title.lower() and len(clean_artist) < 25:
                        search_query = f"{raw_title} {clean_artist}".strip()
                    else:
                        search_query = raw_title or track.get("display_name") or ""
                    search_query = re.sub(r'[^\w\s\-\']', ' ', search_query).strip()
                    search_query = re.sub(r'\s+', ' ', search_query)
                    
                    if search_query:
                        emit(f"[{t_name}] Direct URL unavailable. Searching YouTube for '{search_query}'...")
                        search_track = dict(track)
                        search_track["url"] = f"ytsearch1:{search_query}"
                        success, output_lines = download_track_ytdlp(
                            ytdlp_path, search_track, download_dir,
                            None,
                            filename_template, embed_metadata
                        )
                    
                with count_lock:
                    if username in aborted_syncs:
                        return
                    if success:
                        emit(f"[{t_name}] SUCCESS: {track_filename}")
                        success_count += 1
                    else:
                        emit(f"[{t_name}] FAILED: {track_filename}")
                        emit(f"  --- Error Details for {track_filename} ---")
                        for line in output_lines[-15:]: # print last 15 lines of yt-dlp error
                            emit(f"    {line}")
                        emit("  --------------------------------------")
                        fail_count += 1
            
            # Execute in thread pool
            with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
                futures = []
                for i, track in enumerate(to_download):
                    # Check pause state
                    while username in paused_syncs:
                        time.sleep(0.5)
                        if username in aborted_syncs:
                            break
                    # Check stop/abort state
                    if username in aborted_syncs:
                        emit("Sync stopped by user.")
                        break
                    futures.append(executor.submit(download_worker, i % max_concurrent, track))
                
                # Wait for all
                for fut in as_completed(futures):
                    pass
                    
            emit("=======================================================")
            emit("SYNCHRONIZATION SUMMARY:")
            emit(f"  Successfully Synced: {success_count}")
            emit(f"  Failed:              {fail_count}")
            emit("=======================================================")
            
            if username in aborted_syncs:
                emit("SYNC_FINISHED_FAILED")
            elif fail_count == 0:
                emit("SYNC_FINISHED_SUCCESS")
            else:
                emit("SYNC_FINISHED_FAILED")
                
        except Exception as e:
            emit(f"FATAL ERROR in sync engine: {e}")
            emit("SYNC_FINISHED_FAILED")
        finally:
            paused_syncs.discard(username)
            aborted_syncs.discard(username)
            
    # Launch worker in thread
    thread = threading.Thread(target=worker_thread)
    thread.daemon = True
    thread.start()
    if scheduler:
        scheduler.register_sync_thread(username, thread)
    
    # Read from queue and yield lines
    while True:
        try:
            line = log_queue.get(timeout=0.5)
            yield line
            if line in ("SYNC_FINISHED_SUCCESS", "SYNC_FINISHED_FAILED"):
                break
        except queue.Empty:
            if not thread.is_alive() and log_queue.empty():
                break
            continue
