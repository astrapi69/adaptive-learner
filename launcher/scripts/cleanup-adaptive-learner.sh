#!/usr/bin/env bash
# Adaptive Learner Cleanup Script (Linux/macOS)
# Ausfuehren: chmod +x cleanup-adaptive-learner.sh && ./cleanup-adaptive-learner.sh
set -uo pipefail

echo "=== Adaptive Learner Cleanup ==="
echo ""

# 1. Container stoppen und entfernen
echo "Container stoppen und entfernen..."
for c in adaptive-learner adaptive-learner-app adaptive_learner; do
    docker stop "$c" 2>/dev/null && echo "  Container '$c' gestoppt" || true
    docker rm "$c" 2>/dev/null && echo "  Container '$c' entfernt" || true
done

# 2. Docker Images entfernen
echo ""
echo "Docker Images entfernen..."
images=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
  | grep -E 'adaptive-learner|adaptive_learner' || true)
if [[ -n "$images" ]]; then
    echo "$images" | while read -r img; do
        docker rmi "$img" --force 2>/dev/null && echo "  Image '$img' entfernt" || true
    done
else
    echo "  Keine relevanten Images gefunden"
fi

# 3. Docker Volumes (mit Bestaetigung)
echo ""
read -rp "Docker Volumes loeschen? (Daten gehen verloren!) [j/N] " vol_answer
if [[ "$vol_answer" == "j" ]]; then
    volumes=$(docker volume ls --format '{{.Name}}' 2>/dev/null \
      | grep -E 'adaptive-learner|adaptive_learner' || true)
    if [[ -n "$volumes" ]]; then
        echo "$volumes" | while read -r vol; do
            docker volume rm "$vol" --force 2>/dev/null && echo "  Volume '$vol' entfernt" || true
        done
    else
        echo "  Keine relevanten Volumes gefunden"
    fi
fi

# 4. Config-Verzeichnisse entfernen
echo ""
echo "Config-Verzeichnisse entfernen..."
for dir in \
    "$HOME/.adaptive-learner" \
    "$HOME/.config/adaptive-learner" \
    "$HOME/.local/share/adaptive-learner"; do
    if [[ -d "$dir" ]]; then
        rm -rf "$dir"
        echo "  $dir entfernt"
    fi
done

# 5. Desktop-Shortcuts entfernen
echo ""
echo "Desktop-Shortcuts entfernen..."
for shortcut in \
    "$HOME/Desktop/adaptive-learner.desktop" \
    "$HOME/.local/share/applications/adaptive-learner.desktop"; do
    if [[ -f "$shortcut" ]]; then
        rm -f "$shortcut"
        echo "  $shortcut entfernt"
    fi
done

# 6. Port pruefen
PORT=${1:-8501}
echo ""
echo "Port $PORT pruefen..."
if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
    echo "  WARNUNG: Port $PORT ist noch belegt:"
    ss -tlnp | grep ":$PORT "
    echo "  Docker neustarten oder: docker stop adaptive-learner"
else
    echo "  Port $PORT ist frei"
fi

echo ""
echo "=== Cleanup abgeschlossen ==="
echo "Jetzt den Launcher neu starten."
