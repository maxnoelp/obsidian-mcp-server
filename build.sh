#!/bin/bash
# Obsidian MCP - Linux/macOS Build Script
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKIP_SERVER=false
SKIP_PLUGIN=false

for arg in "$@"; do
    case $arg in
        --skip-server) SKIP_SERVER=true ;;
        --skip-plugin) SKIP_PLUGIN=true ;;
    esac
done

echo "=== Obsidian MCP Build ==="

# ── 1. Python Server bauen ────────────────────────────────────────────────────
if [ "$SKIP_SERVER" = false ]; then
    echo ""
    echo "[1/3] Python-Server bauen..."
    cd "$ROOT/server"

    pip install -r requirements.txt -q
    pip install pyinstaller -q
    pyinstaller obsidian-mcp.spec --clean --noconfirm

    PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
    EXE="$ROOT/server/dist/obsidian-mcp-server"

    if [ ! -f "$EXE" ]; then
        echo "FEHLER: Executable nicht gefunden: $EXE"
        exit 1
    fi

    SIZE=$(du -sh "$EXE" | cut -f1)
    echo "   Server gebaut: $EXE ($SIZE)"
else
    echo ""
    echo "[1/3] Server-Build uebersprungen (--skip-server)"
fi

# ── 2. Executable ins Plugin-bin/ kopieren ────────────────────────────────────
echo ""
echo "[2/3] Executable ins Plugin kopieren..."

mkdir -p "$ROOT/plugin/bin"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')

EXE="$ROOT/server/dist/obsidian-mcp-server"
if [ -f "$EXE" ]; then
    cp "$EXE" "$ROOT/plugin/bin/obsidian-mcp-server-$PLATFORM"
    chmod +x "$ROOT/plugin/bin/obsidian-mcp-server-$PLATFORM"
    echo "   Kopiert nach: plugin/bin/obsidian-mcp-server-$PLATFORM"
else
    echo "   WARNUNG: $EXE nicht gefunden - Plugin wird ohne Binary gebaut"
fi

# ── 3. TypeScript Plugin bauen ────────────────────────────────────────────────
if [ "$SKIP_PLUGIN" = false ]; then
    echo ""
    echo "[3/3] TypeScript Plugin bauen..."
    cd "$ROOT/plugin"

    npm install --silent
    node esbuild.config.mjs production

    SIZE=$(du -sh "$ROOT/plugin/main.js" | cut -f1)
    echo "   Plugin gebaut: main.js ($SIZE)"
else
    echo ""
    echo "[3/3] Plugin-Build uebersprungen (--skip-plugin)"
fi

# ── Ergebnis zusammenfassen ───────────────────────────────────────────────────
echo ""
echo "=== Build abgeschlossen ==="
echo ""
echo "Plugin-Ordner zum Installieren:"
echo "  $ROOT/plugin/"
echo ""
echo "Kopiere diesen Ordner nach:"
echo "  <Vault>/.obsidian/plugins/obsidian-mcp/"
echo ""
echo "Oder fuer Claude Desktop - Server direkt starten:"
echo "  $ROOT/plugin/bin/obsidian-mcp-server-$PLATFORM --transport stdio"

cd "$ROOT"
