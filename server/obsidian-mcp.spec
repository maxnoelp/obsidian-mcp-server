# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import copy_metadata, collect_data_files

datas = []
# Bundle .dist-info so importlib.metadata.version() works at runtime
for pkg in ('fastmcp', 'fastmcp-slim', 'python-frontmatter', 'PyYAML', 'anyio', 'starlette', 'uvicorn', 'click'):
    try:
        datas += copy_metadata(pkg)
    except Exception:
        pass

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'frontmatter',
        'yaml',
        'fastmcp',
        'anyio',
        'anyio._backends._asyncio',
        'anyio._backends._trio',
        'starlette',
        'starlette.applications',
        'starlette.routing',
        'starlette.responses',
        'uvicorn',
        'uvicorn.loops',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'click',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'unittest',
        'test',
        '_pytest',
        'pytest',
        'turtle',
        'antigravity',
    ],
    noarchive=False,
    optimize=1,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='obsidian-mcp-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
