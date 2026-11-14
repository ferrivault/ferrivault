#!/usr/bin/env bash
# Measures total process-tree RAM usage (USS, PSS, RSS) for FerriVault and
# the official Bitwarden desktop client on Linux.

set -u

collect_tree_pids() {
  local parent="$1"
  echo "$parent"
  local child
  for child in $(pgrep -P "$parent" 2>/dev/null || true); do
    collect_tree_pids "$child"
  done
}

find_root_pid() {
  local pattern="$1"
  local pid=""
  local candidate
  # Exclude this script, grep, make, and smem from matches
  for candidate in $(pgrep -f -i "$pattern" 2>/dev/null || true); do
    [ "$candidate" = "$$" ] && continue
    local cmd
    cmd=$(tr '\0' ' ' < "/proc/$candidate/cmdline" 2>/dev/null || true)
    case "$cmd" in
      *bench-memory*|*pgrep*|*smem*|*make\ memory*) continue ;;
    esac
    # Prefer the ancestor whose parent is NOT also a match (the tree root)
    local ppid
    ppid=$(awk '{print $4}' "/proc/$candidate/stat" 2>/dev/null || echo "")
    local pcmd=""
    if [ -n "$ppid" ] && [ -r "/proc/$ppid/cmdline" ]; then
      pcmd=$(tr '\0' ' ' < "/proc/$ppid/cmdline" 2>/dev/null || true)
    fi
    if ! echo "$pcmd" | grep -qiE "$pattern"; then
      pid="$candidate"
      break
    fi
  done
  echo "$pid"
}

measure_app() {
  local label="$1"
  local root_pid="$2"

  echo "=========================================================================="
  echo "  $label"
  echo "=========================================================================="

  if [ -z "$root_pid" ] || [ ! -d "/proc/$root_pid" ]; then
    echo "  Not running (no matching process found)."
    echo ""
    return 1
  fi

  local pids
  pids=$(collect_tree_pids "$root_pid" | sort -nu)

  local total_uss=0
  local total_pss=0
  local total_rss=0
  local proc_count=0

  printf "  %-8s %-22s %10s %10s %10s\n" "PID" "PROCESS" "USS (MB)" "PSS (MB)" "RSS (MB)"
  printf "  %-8s %-22s %10s %10s %10s\n" "--------" "----------------------" "----------" "----------" "----------"

  local p
  for p in $pids; do
    local rollup="/proc/$p/smaps_rollup"
    [ -r "$rollup" ] || continue
    local comm
    comm=$(tr -d '\0\n' < "/proc/$p/comm" 2>/dev/null || echo "unknown")
    local stats
    stats=$(awk '
      /^Private_Clean:/ { pc=$2 }
      /^Private_Dirty:/ { pd=$2 }
      /^Pss:/           { pss=$2 }
      /^Rss:/           { rss=$2 }
      END { printf "%.1f %.1f %.1f", (pc+pd)/1024, pss/1024, rss/1024 }
    ' "$rollup" 2>/dev/null || echo "0.0 0.0 0.0")

    local uss pss rss
    uss=$(echo "$stats" | awk '{print $1}')
    pss=$(echo "$stats" | awk '{print $2}')
    rss=$(echo "$stats" | awk '{print $3}')

    printf "  %-8s %-22s %10s %10s %10s\n" "$p" "$comm" "$uss" "$pss" "$rss"

    total_uss=$(awk -v a="$total_uss" -v b="$uss" 'BEGIN { printf "%.1f", a+b }')
    total_pss=$(awk -v a="$total_pss" -v b="$pss" 'BEGIN { printf "%.1f", a+b }')
    total_rss=$(awk -v a="$total_rss" -v b="$rss" 'BEGIN { printf "%.1f", a+b }')
    proc_count=$((proc_count + 1))
  done

  echo "  ----------------------------------------------------------------------"
  printf "  TOTAL (%d processes)      %10s %10s %10s\n" "$proc_count" "${total_uss}M" "${total_pss}M" "${total_rss}M"
  echo ""
}

FV_PID="${FV_PID:-$(find_root_pid 'ferrivault')}"
BW_PID="${BW_PID:-$(find_root_pid 'bitwarden|com\.bitwarden\.desktop')}"

echo ""
measure_app "FerriVault (Tauri + Rust)" "$FV_PID" || true
measure_app "Bitwarden Official (Electron)" "$BW_PID" || true

if [ -f "src-tauri/target/release/ferrivault" ]; then
  BIN_SIZE=$(du -h "src-tauri/target/release/ferrivault" | awk '{print $1}')
  echo "  FerriVault release binary size: $BIN_SIZE (src-tauri/target/release/ferrivault)"
fi
if [ -d "src-tauri/target/release/bundle" ]; then
  echo "  FerriVault release bundles:"
  find src-tauri/target/release/bundle -maxdepth 2 -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) -exec du -h {} + 2>/dev/null | sed 's/^/    /'
fi
echo ""
