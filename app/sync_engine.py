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

# Normalize strings for comparison (removes all non-alphanumeric chars and spaces)
def normalize_name(name):
    if not name:
        return ""
    # Convert to lowercase
    name = name.lower()
    # Strip common suffixes/prefixes like [Official Video], (Lyrics), etc.
    name = re.sub(r'\[.*?\]', '', name)
    name = re.sub(r'\(.*?\)', '', name)
    # Remove non-alphanumeric characters
    name = re.sub(r'[^a-z0-9]', '', name)
    return name.strip()

def get_source_id(source):
    if "id" in source:
        return source["id"]
    # Deterministic ID based on URL or path
    key = source.get("url") or source.get("path") or source.get("name", "")
    return hashlib.md5(key.encode("utf-8")).hexdigest()

def scan_existing_files(download_dir):
    existing_songs = set()
    download_path = Path(download_dir)
    if not download_path.exists():
        return existing_songs
        
    # Scan for common audio formats
    for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac']:
        for file in download_path.glob(ext):
            base_name = file.stem
            norm = normalize_name(base_name)
            if norm:
                existing_songs.add(norm)
    return existing_songs

def scan_existing_files_detailed(download_dir):
    files = []
    download_path = Path(download_dir)
    if not download_path.exists():
        return files
        
    for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm', '*.flac']:
        for file in download_path.glob(ext):
            try:
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
        "--remote-components", "ejs:github",
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
            if "[ExtractAudio] Destination:" in line:
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
def run_sync_engine_generator(config_path, ytdlp_path="yt-dlp"):
    log_queue = queue.Queue()
    
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
                    norm = normalize_name(track["display_name"])
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
                norm = normalize_name(track["display_name"])
                if norm not in existing_songs:
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
                    
                with count_lock:
                    if username in aborted_syncs:
                        return
                    if success:
                        emit(f"[{t_name}] SUCCESS: {track_name}")
                        success_count += 1
                    else:
                        emit(f"[{t_name}] FAILED: {track_name}")
                        emit(f"  --- Error Details for {track_name} ---")
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
