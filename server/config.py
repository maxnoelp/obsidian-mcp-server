import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".obsidian-mcp"
CONFIG_FILE = CONFIG_DIR / "config.json"


def get_config() -> dict:
    if not CONFIG_FILE.exists():
        return {"vaults": {}}
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_vault_path(name: str) -> str | None:
    return get_config().get("vaults", {}).get(name)


def list_vaults() -> dict:
    return get_config().get("vaults", {})


def add_vault(name: str, path: str) -> None:
    config = get_config()
    config.setdefault("vaults", {})[name] = path
    save_config(config)


def remove_vault(name: str) -> None:
    config = get_config()
    config.setdefault("vaults", {}).pop(name, None)
    save_config(config)
