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

# Normalize strings for comparison (preserves Unicode letters and digits for all languages like Tamil, English, Hindi, etc.)
def normalize_name(name, strip_brackets=True):
    if not name:
        return ""
    name = str(name).lower()
    if strip_brackets:
        # Strip common suffixes/prefixes like [Official Video], (Lyrics), (From "..."), etc.
        name = re.sub(r'\[.*?\]', '', name)
        name = re.sub(r'\(.*?\)', '', name)
    # Remove non-word characters while preserving Unicode letters and digits
    name = re.sub(r'[^\w]', '', name, flags=re.UNICODE)
    return name.strip()

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
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command {' '.join(args)}: {e}")
        if capture_output:
            print(f"Stderr: {e.stderr}")
        return None

def fetch_ytdlp_playlist(url, cookie_file=None, ytdlp_path="yt-dlp"):
    cmd = [ytdlp_path, "--flat-playlist", "--dump-single-json", "--js-runtimes", "node"]
    if cookie_file and os.path.exists(cookie_file):
        cmd.extend(["--cookies", cookie_file])
    cmd.append(url)
    
    output = run_cmd(cmd)
    if not output:
        return []
        
    try:
        data = json.loads(output)
        entries = data.get("entries", [])
        tracks = []
        for idx, entry in enumerate(entries):
            if not entry:
                continue
            title = entry.get("title", "")
            if not title or title.strip() in ["[Deleted video]", "[Private video]", "[Unavailable video]"]:
                continue
            uploader = entry.get("uploader", "")
            video_id = entry.get("id", "")
            duration = entry.get("duration")
            
            # Combine artist - title if uploader is present and not already in title
            if uploader and uploader.lower() not in title.lower():
                display_name = f"{uploader} - {title}"
            else:
                display_name = title
                
            tracks.append({
                "id": video_id,
                "display_name": display_name,
                "title": title,
                "artist": uploader,
                "video_id": video_id,
                "duration": duration,
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
    url = track["url"]
    
    cmd = [
        ytdlp_path,
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--output", os.path.join(download_dir, filename_template),
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
            
            cookie_file = None
            for name in ["youtube_cookies.txt", "music.youtube.com_cookies.txt"]:
                potential_cookie = os.path.join(user_dir, name)
                if os.path.exists(potential_cookie):
                    cookie_file = potential_cookie
                    break
                    
            for source in sources:
                src_type = source.get("type")
                src_name = source.get("name", "Unnamed Source")
                url = source.get("url", "")
                src_id = get_source_id(source)
                
                # Check for checkboxes/exclusions
                disabled_ids = set(source.get("disabled_track_ids", []))
                
                requires_cookies = (cookie_file is not None)
                    
                emit(f"Processing Source: {src_name} ({src_type})...")
                tracks = []
                
                # Load tracks (prefer cached tracks if available to speed up, or fetch live)
                cached_file = os.path.join(user_dir, "playlists", f"{src_id}_tracks.json")
                if os.path.exists(cached_file):
                    try:
                        with open(cached_file, "r") as cf:
                            tracks = json.load(cf)
                        emit(f"  Loaded {len(tracks)} tracks from cache.")
                    except Exception as e:
                        emit(f"  Warning loading cache: {e}. Fetching live instead.")
                        tracks = []
                        
                if not tracks:
                    emit(f"  Fetching playlist live using yt-dlp...")
                    if src_type == "youtube_music_playlist" or src_type == "youtube_playlist":
                        if url:
                            tracks = fetch_ytdlp_playlist(url, cookie_file if requires_cookies else None, ytdlp_path)
                    elif src_type == "text_file":
                        rel_path = source.get("path")
                        full_path = os.path.join(user_dir, os.path.basename(rel_path)) if rel_path else None
                        if full_path and os.path.exists(full_path):
                            tracks = fetch_text_file(full_path)
                        elif rel_path and os.path.exists(rel_path):
                            tracks = fetch_text_file(rel_path)
                    
                    # Cache them
                    if tracks:
                        os.makedirs(os.path.dirname(cached_file), exist_ok=True)
                        with open(cached_file, "w") as cf:
                            json.dump(tracks, cf)
                            
                # Merge and deduplicate
                for track in tracks:
                    norm = normalize_name(track.get("display_name", ""), strip_brackets=False) or normalize_name(track.get("display_name", ""), strip_brackets=True)
                    if norm not in seen_normalized:
                        # Skip if this track was unchecked by user
                        if track.get("id") in disabled_ids:
                            continue
                            
                        seen_normalized.add(norm)
                        track["use_cookies"] = requires_cookies
                        all_tracks.append(track)
                        
            emit(f"Total checked unique target tracks: {len(all_tracks)}")
            
            # 3. Filter out existing tracks
            to_download = []
            for track in all_tracks:
                norm_title_full = normalize_name(track.get("title", ""), strip_brackets=False)
                norm_title_strip = normalize_name(track.get("title", ""), strip_brackets=True)
                norm_display_full = normalize_name(track.get("display_name", ""), strip_brackets=False)
                norm_display_strip = normalize_name(track.get("display_name", ""), strip_brackets=True)
                
                track_norms = {norm_title_full, norm_title_strip, norm_display_full, norm_display_strip}
                track_norms.discard("")
                
                is_downloaded = any(tn in existing_songs for tn in track_norms)
                
                if not is_downloaded:
                    for tn in track_norms:
                        if len(tn) >= 4:
                            for fn in existing_songs:
                                if len(fn) >= 4 and (tn in fn or fn in tn):
                                    is_downloaded = True
                                    break
                        if is_downloaded:
                            break
                                
                if not is_downloaded:
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
                    search_query = track.get("display_name") or track.get("title") or ""
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
