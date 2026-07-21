import os
import time
import json
import datetime
import threading
from pathlib import Path
from app.sync_engine import run_sync_engine_generator

class BackgroundScheduler:
    def __init__(self, users_dir="users", ytdlp_path="yt-dlp"):
        self.users_dir = Path(users_dir) if isinstance(users_dir, str) else users_dir
        self.ytdlp_path = ytdlp_path
        self.running = False
        self.thread = None
        # Keep track of active usernames currently syncing to avoid overlaps
        self.active_syncs = set()
        self.sync_lock = threading.Lock()

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._scheduler_loop)
        self.thread.daemon = True
        self.thread.start()
        print("Background Scheduler started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
        print("Background Scheduler stopped.")

    def _scheduler_loop(self):
        while self.running:
            try:
                self._check_all_profiles()
            except Exception as e:
                print(f"Error in scheduler check loop: {e}")
            # Check once every 60 seconds
            time.sleep(60)

    def is_syncing(self, username):
        with self.sync_lock:
            return username in self.active_syncs

    def trigger_manual_sync(self, username, config_path):
        with self.sync_lock:
            if username in self.active_syncs:
                return False
            self.active_syncs.add(username)
        
        # We don't block; the main.py will consume the SSE generator.
        # So we just provide a helper to remove it when finished.
        return True

    def release_sync(self, username):
        with self.sync_lock:
            if username in self.active_syncs:
                self.active_syncs.remove(username)

    def _check_all_profiles(self):
        if not self.users_dir.exists():
            return
            
        for path in self.users_dir.iterdir():
            if not path.is_dir():
                continue
            username = path.name
            config_file = path / "sync_config.json"
            if not config_file.exists():
                continue
                
            # Skip if currently syncing (either manually or automatically)
            if self.is_syncing(username):
                continue
                
            self._process_profile_schedule(username, config_file)

    def _process_profile_schedule(self, username, config_file):
        try:
            with open(config_file, "r") as f:
                config = json.load(f)
        except Exception as e:
            print(f"Scheduler failed to read config for {username}: {e}")
            return
            
        auto_sync = config.get("auto_sync", False)
        if not auto_sync:
            return
            
        user_dir = config_file.parent
        state_file = user_dir / "sync_state.json"
        
        state = {}
        if state_file.exists():
            try:
                with open(state_file, "r") as f:
                    state = json.load(f)
            except Exception:
                pass
                
        last_sync_str = state.get("last_sync_time")
        now = datetime.datetime.now()
        
        due = False
        sync_time_str = config.get("sync_time", "02:00") # Format: "HH:MM"
        sync_interval_hours = config.get("sync_interval_hours", 24) # Default 24 hours
        
        # We support two scheduling modes based on config settings:
        # 1. Daily at a specific time: sync_time is set and sync_interval_hours is 24 (or sync_time is primary)
        # 2. Elapsed interval hours
        
        if last_sync_str:
            try:
                last_sync = datetime.datetime.fromisoformat(last_sync_str)
            except Exception:
                last_sync = None
        else:
            last_sync = None
            
        if not last_sync:
            # Never synced, run now
            due = True
        else:
            # Check interval-based sync
            if "sync_interval_hours" in config and sync_interval_hours > 0:
                elapsed = now - last_sync
                if elapsed >= datetime.timedelta(hours=sync_interval_hours):
                    due = True
            # Check specific daily time
            elif sync_time_str:
                try:
                    target_h, target_m = map(int, sync_time_str.split(":"))
                    target_time_today = now.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
                    
                    # If target time is in the future for today, the last eligible sync time was yesterday
                    # If target time is in the past for today, the last eligible sync time is today
                    if now >= target_time_today:
                        # Should have run today. Did it?
                        if last_sync < target_time_today:
                            due = True
                    else:
                        # Should have run yesterday. Did it?
                        target_time_yesterday = target_time_today - datetime.timedelta(days=1)
                        if last_sync < target_time_yesterday:
                            due = True
                except Exception as e:
                    print(f"Error parsing sync_time '{sync_time_str}': {e}")
                    
        # Calculate and update next sync time in state file
        next_sync = self._calculate_next_sync(now, last_sync, config)
        state["next_sync_time"] = next_sync.isoformat() if next_sync else None
        
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)
            
        if due:
            # Run background automatic sync
            print(f"Scheduler triggering auto-sync for user '{username}'")
            threading.Thread(
                target=self._run_auto_sync,
                args=(username, config_file, state_file)
            ).start()

    def _calculate_next_sync(self, now, last_sync, config):
        sync_time_str = config.get("sync_time", "02:00")
        sync_interval_hours = config.get("sync_interval_hours", 24)
        
        # If interval hours is active and not default 24, use that
        if "sync_interval_hours" in config and sync_interval_hours > 0:
            base = last_sync if last_sync else now
            return base + datetime.timedelta(hours=sync_interval_hours)
            
        # Else use daily specific time
        try:
            target_h, target_m = map(int, sync_time_str.split(":"))
            next_run = now.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
            if next_run <= now:
                next_run += datetime.timedelta(days=1)
            return next_run
        except Exception:
            return now + datetime.timedelta(days=1)

    def _run_auto_sync(self, username, config_file, state_file):
        with self.sync_lock:
            if username in self.active_syncs:
                return
            self.active_syncs.add(username)
            
        user_dir = config_file.parent
        log_file = user_dir / "last_sync_log.txt"
        
        try:
            print(f"Auto-sync thread started for {username}")
            log_lines = []
            
            # Start sync generator
            gen = run_sync_engine_generator(str(config_file), self.ytdlp_path)
            success = True
            
            for line in gen:
                # Filter internal flags
                if line == "SYNC_FINISHED_SUCCESS":
                    success = True
                elif line == "SYNC_FINISHED_FAILED":
                    success = False
                else:
                    log_lines.append(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {line}")
                    
            # Write log to file
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
            state["last_sync_status"] = "SUCCESS" if success else "FAILED"
            
            # Calculate next run
            try:
                with open(config_file, "r") as f:
                    config = json.load(f)
            except Exception:
                config = {}
                
            next_sync = self._calculate_next_sync(now, now, config)
            state["next_sync_time"] = next_sync.isoformat() if next_sync else None
            
            with open(state_file, "w") as f:
                json.dump(state, f, indent=2)
                
            print(f"Auto-sync completed for {username}. Status: {'SUCCESS' if success else 'FAILED'}")
            
        except Exception as e:
            print(f"Error executing auto-sync for {username}: {e}")
        finally:
            self.release_sync(username)
