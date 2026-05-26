import config


def test_get_config_returns_empty_when_no_file(isolated_config):
    assert config.get_config() == {"vaults": {}}


def test_add_and_get_vault(isolated_config):
    config.add_vault("notes", "/tmp/notes")
    assert config.get_vault_path("notes") == "/tmp/notes"
    assert config.list_vaults() == {"notes": "/tmp/notes"}


def test_get_vault_path_unknown_returns_none(isolated_config):
    assert config.get_vault_path("missing") is None


def test_remove_vault(isolated_config):
    config.add_vault("a", "/a")
    config.add_vault("b", "/b")
    config.remove_vault("a")
    assert config.list_vaults() == {"b": "/b"}


def test_remove_unknown_vault_is_noop(isolated_config):
    config.add_vault("a", "/a")
    config.remove_vault("nope")
    assert config.list_vaults() == {"a": "/a"}


def test_save_creates_config_dir(isolated_config):
    config.add_vault("a", "/a")
    assert (isolated_config / "config.json").exists()


def test_unicode_paths_round_trip(isolated_config):
    config.add_vault("Lernen", "/Users/me/Obsidian Vault/Lärnings")
    assert config.get_vault_path("Lernen") == "/Users/me/Obsidian Vault/Lärnings"
