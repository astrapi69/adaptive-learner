#!/bin/sh
set -e

# ============================================================
#  AdaptiveLearner Uninstaller
#
#  Removes the AdaptiveLearner installation, Docker resources, and
#  launcher manifest in a single command.
#
#  Usage:
#    cd ~/adaptive_learner && bash uninstall.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="docker-compose.prod.yml"

echo ""
echo -e "${RED}========================================${NC}"
echo -e "${RED}  AdaptiveLearner Uninstaller${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}WARNING: This will permanently remove:${NC}"
echo ""
echo "  1. The AdaptiveLearner Docker stack (containers)"
echo "  2. All AdaptiveLearner Docker volumes (books, chapters, database)"
echo "  3. All AdaptiveLearner Docker images"
echo "  4. The launcher configuration manifest"
echo "  5. The installation directory: ${INSTALL_DIR}"
echo ""
echo -e "${RED}Your books and chapters will be deleted.${NC}"
echo -e "${RED}Export your work BEFORE proceeding.${NC}"
echo ""
printf "Type 'yes' to confirm uninstall: "
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "Uninstall cancelled."
    exit 0
fi

echo ""

# --- Step 1: Stop Docker stack ---
echo -e "${YELLOW}Stopping AdaptiveLearner Docker stack...${NC}"
if [ -f "$INSTALL_DIR/$COMPOSE_FILE" ]; then
    docker compose -f "$INSTALL_DIR/$COMPOSE_FILE" down 2>/dev/null || true
    echo -e "${GREEN}  Stack stopped.${NC}"
else
    echo "  No compose file found, skipping."
fi

# --- Step 2: Remove Docker volumes ---
echo -e "${YELLOW}Removing AdaptiveLearner Docker volumes...${NC}"
VOLUMES=$(docker volume ls --filter name=adaptive_learner -q 2>/dev/null || true)
if [ -n "$VOLUMES" ]; then
    echo "$VOLUMES" | xargs docker volume rm 2>/dev/null || true
    echo -e "${GREEN}  Volumes removed.${NC}"
else
    echo "  No AdaptiveLearner volumes found."
fi

# --- Step 3: Remove Docker images ---
echo -e "${YELLOW}Removing AdaptiveLearner Docker images...${NC}"
IMAGES=$(docker images --filter reference='*adaptive_learner*' -q 2>/dev/null || true)
if [ -n "$IMAGES" ]; then
    echo "$IMAGES" | xargs docker image rm --force 2>/dev/null || true
    echo -e "${GREEN}  Images removed.${NC}"
else
    echo "  No AdaptiveLearner images found."
fi

# --- Step 4: Remove launcher manifest ---
echo -e "${YELLOW}Removing launcher manifest...${NC}"
MANIFEST_REMOVED="no"

# Detect platform and set manifest directory
OS_TYPE="$(uname -s 2>/dev/null || echo "unknown")"
case "$OS_TYPE" in
    MINGW*|MSYS*|CYGWIN*|Windows*)
        # Windows (Git Bash / MSYS2 / Cygwin)
        MANIFEST_DIR="${APPDATA}/adaptive_learner"
        ;;
    Darwin*)
        # macOS
        MANIFEST_DIR="${HOME}/Library/Application Support/adaptive_learner"
        ;;
    *)
        # Linux and other Unix
        MANIFEST_DIR="${HOME}/.config/adaptive_learner"
        ;;
esac

if [ -d "$MANIFEST_DIR" ]; then
    rm -rf "$MANIFEST_DIR"
    MANIFEST_REMOVED="yes"
    echo -e "${GREEN}  Manifest removed: ${MANIFEST_DIR}${NC}"
else
    echo "  No manifest directory found at: ${MANIFEST_DIR}"
fi

# Also remove legacy launcher.json if it exists under APPDATA/AdaptiveLearner
# (capital B, used by the old launcher config path)
case "$OS_TYPE" in
    MINGW*|MSYS*|CYGWIN*|Windows*)
        LEGACY_DIR="${APPDATA}/AdaptiveLearner"
        if [ -d "$LEGACY_DIR" ]; then
            rm -rf "$LEGACY_DIR"
            echo -e "${GREEN}  Legacy config removed: ${LEGACY_DIR}${NC}"
        fi
        ;;
esac

# --- Step 5: Remove install directory (last, since script lives here) ---
echo -e "${YELLOW}Removing installation directory...${NC}"
echo "  ${INSTALL_DIR}"
cd /
rm -rf "$INSTALL_DIR"
echo -e "${GREEN}  Directory removed.${NC}"

# --- Summary ---
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AdaptiveLearner has been uninstalled.${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Removed:"
echo "    - Docker stack, volumes, and images"
echo "    - Launcher manifest ($MANIFEST_REMOVED)"
echo "    - Installation directory"
echo ""
echo "  To reinstall:"
echo "    curl -fsSL https://raw.githubusercontent.com/astrapi69/adaptive_learner/main/install.sh | bash"
echo ""
