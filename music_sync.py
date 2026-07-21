import os
import sys
import json
import re
import subprocess
from pathlib import Path

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

def scan_existing_files(download_dir):
    existing_songs = set()
    download_path = Path(download_dir)
    if not download_path.exists():
        return existing_songs
        
    print(f"Scanning existing files in {download_dir}...")
    # Scan for common audio formats
    for ext in ['*.mp3', '*.m4a', '*.opus', '*.webm']:
        for file in download_path.glob(ext):
            base_name = file.stem
            # Normalize filename
            norm = normalize_name(base_name)
            if norm:
                existing_songs.add(norm)
                
    print(f"Found {len(existing_songs)} unique existing tracks in folder.")
    return existing_songs

def fetch_ytdlp_playlist(url, cookie_file=None, ytdlp_path="yt-dlp"):
    print(f"Fetching playlist tracks using yt-dlp...")
    cmd = [ytdlp_path, "--flat-playlist", "--dump-single-json", "--js-runtimes", "node"]
    if cookie_file and os.path.exists(cookie_file):
        cmd.extend(["--cookies", cookie_file])
    cmd.append(url)
    
    output = run_cmd(cmd)
    if not output:
        print("Failed to fetch playlist data.")
        return []
        
    try:
        data = json.loads(output)
        entries = data.get("entries", [])
        tracks = []
        for idx, entry in enumerate(entries):
            if not entry:
                continue
            title = entry.get("title", "")
            # YouTube uploader is often the artist
            uploader = entry.get("uploader", "")
            video_id = entry.get("id", "")
            
            # Combine artist - title if uploader is present and not already in title
            if uploader and uploader.lower() not in title.lower():
                display_name = f"{uploader} - {title}"
            else:
                display_name = title
                
            tracks.append({
                "display_name": display_name,
                "title": title,
                "artist": uploader,
                "video_id": video_id,
                "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None
            })
        print(f"Loaded {len(tracks)} tracks from playlist.")
        return tracks
    except Exception as e:
        print(f"Error parsing playlist JSON: {e}")
        return []

def fetch_text_file(path):
    print(f"Loading manual songs list from {path}...")
    tracks = []
    if not os.path.exists(path):
        print(f"Warning: Text file {path} does not exist.")
        return tracks
        
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # If it's a URL, handle differently, else it's a search query
            tracks.append({
                "display_name": line,
                "title": line,
                "artist": "",
                "video_id": None,
                "url": f"ytmsearch1:{line}"
            })
    print(f"Loaded {len(tracks)} tracks from manual list.")
    return tracks
def download_track_ytdlp(ytdlp_path, track, download_dir, cookie_file=None, silent=False):
    url = track["url"]
    cmd = [
        ytdlp_path,
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--embed-metadata",
        "--embed-thumbnail",
        "--output", os.path.join(download_dir, "%(title)s.%(ext)s"),
        "--match-filter", "!is_live",
        "--remote-components", "ejs:github",
        "--js-runtimes", "node"
    ]
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
                # Skip progress percentage lines to keep log output simple
                if "[download]" in line:
                    if "%" in line and not ("100%" in line or "100.0%" in line):
                        continue
                if not silent:
                    if "[download]" in line or "[ExtractAudio]" in line or "[ThumbnailsConvertor]" in line:
                        print(f"  {line}")
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
                
        # If the file actually exists on disk, we treat it as success even if post-processor errored
        if downloaded_file_path and os.path.exists(downloaded_file_path):
            return True, output_lines
            
        return rc == 0, output_lines
    except Exception as e:
        return False, [f"Error running subprocess: {e}"]

def sync_user(config_path, ytdlp_path="yt-dlp"):
    if not os.path.exists(config_path):
        print(f"ERROR: Configuration file not found at {config_path}")
        return False
        
    with open(config_path, "r") as f:
        config = json.load(f)
        
    download_dir = config.get("download_dir")
    sources = config.get("sources", [])
    
    if not download_dir:
        print("ERROR: 'download_dir' is not specified in config.")
        return False
        
    os.makedirs(download_dir, exist_ok=True)
    
    # 1. Scan destination
    existing_songs = scan_existing_files(download_dir)
    
    # 2. Gather tracks from all sources
    all_tracks = []
    seen_normalized = set()
    
    # Locate user directory to resolve relative paths
    user_dir = os.path.dirname(config_path)
    
    # Check if there is a cookie file inside user folder
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
        
        # Cookies are only needed for YouTube Music Liked Songs (list=LM)
        requires_cookies = False
        if src_type == "youtube_music_playlist" and "list=LM" in url:
            requires_cookies = True
            
        print(f"\n--- Processing Source: {src_name} ({src_type}) ---")
        tracks = []
        if src_type == "youtube_music_playlist" or src_type == "youtube_playlist":
            if url:
                tracks = fetch_ytdlp_playlist(url, cookie_file if requires_cookies else None, ytdlp_path)
        elif src_type == "text_file":
            rel_path = source.get("path")
            # Text file can be relative to user dir
            full_path = os.path.join(user_dir, os.path.basename(rel_path)) if rel_path else None
            if full_path and os.path.exists(full_path):
                tracks = fetch_text_file(full_path)
            elif rel_path and os.path.exists(rel_path):
                tracks = fetch_text_file(rel_path)
            else:
                print(f"Warning: Could not find manual list at {rel_path} or {full_path}")
                
        # Merge and deduplicate across sources
        for track in tracks:
            norm = normalize_name(track["display_name"])
            if norm not in seen_normalized:
                seen_normalized.add(norm)
                track["use_cookies"] = requires_cookies
                all_tracks.append(track)
                
    print(f"\nTotal unique target tracks to sync: {len(all_tracks)}")
    
    # 3. Filter out existing tracks
    to_download = []
    for track in all_tracks:
        norm = normalize_name(track["display_name"])
        if norm not in existing_songs:
            to_download.append(track)
            
    print(f"Tracks already downloaded: {len(all_tracks) - len(to_download)}")
    print(f"New tracks to download: {len(to_download)}")
    
    if not to_download:
        print("\nAll tracks are up to date! Synchronization completed.")
        return True
        
    # 4. Download new tracks
    success_count = 0
    fail_count = 0
    
    for idx, track in enumerate(to_download):
        print(f"\n[{idx+1}/{len(to_download)}] Downloading: {track['display_name']}")
        
        use_cookies = track.get("use_cookies", False) and cookie_file is not None
        
        # If we use cookies, run the first attempt silently to keep logs compact on fallback
        success, output_lines = download_track_ytdlp(
            ytdlp_path, track, download_dir, 
            cookie_file if use_cookies else None, 
            silent=use_cookies
        )
        
        if not success and use_cookies:
            # First attempt with cookies failed. Retry without cookies and print standard log output
            success, output_lines = download_track_ytdlp(
                ytdlp_path, track, download_dir, 
                None, 
                silent=False
            )
            
        if success:
            if not use_cookies:
                print("  SUCCESS!")
            else:
                print("  SUCCESS! (Bypassed invalid cookies)")
            success_count += 1
        else:
            print("  FAILED: Download failed.")
            print("  --- Downloader Output ---")
            for l in output_lines:
                print(f"    {l}")
            print("  -------------------------")
            fail_count += 1
            
    print(f"\n=======================================================")
    print(f"SYNC RESULTS FOR CONFIG: {config_path}")
    print(f"  Successfully Synced: {success_count}")
    print(f"  Failed:              {fail_count}")
    print(f"=======================================================")
    return fail_count == 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python music_sync.py <path_to_sync_config.json> [path_to_yt_dlp]")
        sys.exit(1)
        
    config_file = sys.argv[1]
    ytdlp_exec = sys.argv[2] if len(sys.argv) > 2 else "yt-dlp"
    
    success = sync_user(config_file, ytdlp_exec)
    sys.exit(0 if success else 1)
