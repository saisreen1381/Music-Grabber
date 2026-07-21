#!/bin/bash

# Base directories
MUSIC_BASE_DIR="/mnt/mypassport/data/media/music"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERS_DIR="${SCRIPT_DIR}/users"

# Disable web browser checking globally to prevent hangs in headless terminal environments
export BROWSER=false
export PYTHONUNBUFFERED=1

# Clean up any bad hardcoded credentials in SpotDL config files to ensure it reads env vars
rm -f /home/saisreen1381/.config/spotdl/config.json /home/saisreen1381/.spotdl/config.json

# Helper function to run SpotDL with verbose real-time logging, filtering out noisy HTTP connection logs
run_spotdl() {
  stdbuf -oL -eL spotdl "$@" --log-level DEBUG 2>&1 | grep --line-buffered -i -E "matching|downloading|converting|info|error|warning|found|processing|syncing"
  return ${PIPESTATUS[0]}
}

# Ensure spotdl is installed on the host
if ! command -v spotdl &> /dev/null; then
  echo "ERROR: 'spotdl' is not installed on the Pi host."
  echo "Please install it first by running: "
  echo "  sudo apt update && sudo apt install -y pipx"
  echo "  pipx ensurepath && source ~/.bashrc"
  echo "  pipx install spotdl"
  exit 1
fi

# Function to run interactive Spotify login for a specific user
run_login() {
  local USERNAME=$1
  local USER_CONFIG_DIR="${USERS_DIR}/${USERNAME}"
  
  if [ -z "$USERNAME" ]; then
    echo "ERROR: Please specify a username. Usage: $0 --login <username>"
    exit 1
  fi

  echo "=========================================================="
  echo "Initializing Spotify Login for User: ${USERNAME}"
  echo "=========================================================="
  
  # Ensure user directory and cache directories exist
  mkdir -p "${USER_CONFIG_DIR}/spotify_cache"
  mkdir -p "${MUSIC_BASE_DIR}/${USERNAME}"

  # Move to the user's cache directory so SpotDL writes the .cache file here
  cd "${USER_CONFIG_DIR}/spotify_cache" || exit 1

  # Optional cookies file for YouTube Music during authorization
  local COOKIE_ARG=""
  if [ -f "${USER_CONFIG_DIR}/youtube_cookies.txt" ]; then
    COOKIE_ARG="--cookie-file ../youtube_cookies.txt"
  fi

  echo "1. A Spotify authorization link will appear below."
  echo "2. Copy it and open it in your PC browser."
  echo "3. Log in to Spotify."
  echo "4. Since you used the SSH port-forwarding tunnel, the browser will automatically complete the login!"
  echo ""
  
  # Run spotdl on host (does not hang!)
  spotdl download saved --user-auth ${COOKIE_ARG} --output "${MUSIC_BASE_DIR}/${USERNAME}/{artist} - {title}.{output-ext}"

  echo "Login process complete! Credentials saved to users/${USERNAME}/spotify_cache/.cache"
  exit 0
}

# Check if the user requested a login action
if [ "$1" == "--login" ]; then
  run_login "$2"
fi

# Standard script run (Sync all users)
echo "================================================================="
echo "Starting Host-Based Music Synchronization: $(date)"
echo "================================================================="

if [ ! -d "$USERS_DIR" ] || [ -z "$(ls -A "$USERS_DIR")" ]; then
  echo "ERROR: No user configurations found in ${USERS_DIR}."
  echo "Create a folder inside 'users/' for each account (e.g., 'users/saisreen/')."
  exit 1
fi

TOTAL_ITEMS=0
SUCCESS_COUNT=0
FAIL_COUNT=0
SUCCESS_LIST=()
FAIL_LIST=()

# Loop through each user directory
for USER_FOLDER in "${USERS_DIR}"/*; do
  [ -d "$USER_FOLDER" ] || continue
  USERNAME=$(basename "$USER_FOLDER")
  CONFIG_FILE="${USER_FOLDER}/sync_config.json"
  
  echo ""
  echo "================================================================="
  echo "PROCESSING ACCOUNT: ${USERNAME}"
  echo "================================================================="

  if [ ! -f "$CONFIG_FILE" ]; then
    echo "Warning: No sync_config.json found for user '${USERNAME}'. Skipping."
    continue
  fi

  # Determine yt-dlp path (prefer pipx spotdl venv)
  YTDLP_PATH="yt-dlp"
  if [ -f "/home/saisreen1381/.local/share/pipx/venvs/spotdl/bin/yt-dlp" ]; then
    YTDLP_PATH="/home/saisreen1381/.local/share/pipx/venvs/spotdl/bin/yt-dlp"
  fi

  TOTAL_ITEMS=$((TOTAL_ITEMS + 1))
  ITEM_START_TIME=$(date +%s)

  # Run Python custom sync engine
  python3 "${SCRIPT_DIR}/music_sync.py" "${CONFIG_FILE}" "${YTDLP_PATH}"
  STATUS=$?

  DURATION=$(($(date +%s) - ITEM_START_TIME))

  if [ $STATUS -eq 0 ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    SUCCESS_LIST+=("✔ [${USERNAME}] Success (Took ${DURATION}s)")
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAIL_LIST+=("✘ [${USERNAME}] Failed (Exit Code: $STATUS)")
  fi
done

echo ""
echo "================================================================="
echo "SYNCHRONIZATION SUMMARY ($(date))"
echo "================================================================="
echo "Total Users Processed: $TOTAL_ITEMS"
echo "Successful Syncs:      $SUCCESS_COUNT"
echo "Failed Syncs:          $FAIL_COUNT"
echo "-----------------------------------------------------------------"

if [ $SUCCESS_COUNT -gt 0 ]; then
  echo "SUCCESSFUL USERS:"
  for ITEM in "${SUCCESS_LIST[@]}"; do
    echo "  $ITEM"
  done
fi

if [ $FAIL_COUNT -gt 0 ]; then
  echo ""
  echo "FAILED USERS (Check logs above for detailed error traces):"
  for ITEM in "${FAIL_LIST[@]}"; do
    echo "  $ITEM"
  done
fi
echo "================================================================="

if [ $FAIL_COUNT -gt 0 ]; then
  exit 1
else
  exit 0
fi
