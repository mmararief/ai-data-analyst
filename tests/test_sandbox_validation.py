"""Unit tests for sandbox code validation.

Tests the _validate_code function that acts as a secondary defense layer
before code reaches the isolated Docker container. No Docker required.
"""

from __future__ import annotations

import re
import sys
import pytest

# Import _validate_code directly from the real sandbox.py file,
# bypassing the conftest stub (which only stubs execution functions).
# We need to load the module from the file path since conftest already
# installed a stub as sys.modules["sandbox"].
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "sandbox_real",
    str(__import__("pathlib").Path(__file__).resolve().parents[1] / "sandbox.py"),
)
_sandbox_real = importlib.util.module_from_spec(_spec)

# Patch docker import so the real sandbox.py doesn't fail on import
# (docker sdk may not be installed in test env or conftest already stubbed it)
if "docker" not in sys.modules:
    import types
    _docker_stub = types.ModuleType("docker")
    _docker_stub.from_env = lambda: None
    sys.modules["docker"] = _docker_stub

_spec.loader.exec_module(_sandbox_real)
_validate_code = _sandbox_real._validate_code


class TestValidateCode:
    """Test blocked pattern detection in user-generated code."""

    # --- Should PASS validation (return None) ---

    def test_allows_basic_pandas(self):
        code = "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.head())"
        assert _validate_code(code) is None

    def test_allows_numpy_operations(self):
        code = "import numpy as np\narr = np.array([1,2,3])\nprint(arr.mean())"
        assert _validate_code(code) is None

    def test_allows_matplotlib(self):
        code = "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.savefig('out.png')"
        assert _validate_code(code) is None

    def test_allows_seaborn(self):
        code = "import seaborn as sns\nsns.heatmap(df.corr())"
        assert _validate_code(code) is None

    def test_allows_json_import(self):
        code = "import json\ndata = json.loads('{}')"
        assert _validate_code(code) is None

    def test_allows_read_open(self):
        # open() for reading is allowed — only write mode is blocked
        code = "with open('data.csv', 'r') as f:\n    content = f.read()"
        assert _validate_code(code) is None

    def test_allows_os_path(self):
        # os.path.* is safe, only os.system/os.popen/etc are blocked
        code = "import os\npath = os.path.join('/app/data', 'file.csv')"
        assert _validate_code(code) is None

    # --- Should FAIL validation (return error message) ---

    def test_blocks_os_system(self):
        code = "import os\nos.system('rm -rf /')"
        assert _validate_code(code) is not None

    def test_blocks_os_popen(self):
        code = "import os\nos.popen('cat /etc/passwd')"
        assert _validate_code(code) is not None

    def test_blocks_os_exec(self):
        code = "import os\nos.exec('malicious')"
        assert _validate_code(code) is not None

    def test_blocks_subprocess_import(self):
        code = "import subprocess\nsubprocess.run(['ls'])"
        assert _validate_code(code) is not None

    def test_blocks_subprocess_from_import(self):
        code = "from subprocess import run\nrun(['ls'])"
        assert _validate_code(code) is not None

    def test_blocks_socket_import(self):
        code = "import socket\ns = socket.socket()"
        assert _validate_code(code) is not None

    def test_blocks_requests_import(self):
        code = "import requests\nrequests.get('http://evil.com')"
        assert _validate_code(code) is not None

    def test_blocks_shutil_import(self):
        code = "import shutil\nshutil.rmtree('/')"
        assert _validate_code(code) is not None

    def test_blocks_dunder_import(self):
        code = "__import__('os').system('whoami')"
        assert _validate_code(code) is not None

    def test_blocks_builtins_access(self):
        code = "__builtins__.__dict__['eval']('1+1')"
        assert _validate_code(code) is not None

    def test_blocks_os_remove(self):
        code = "import os\nos.remove('/app/data/important.csv')"
        assert _validate_code(code) is not None

    def test_blocks_os_environ(self):
        code = "import os\nkey = os.environ['SECRET_KEY']"
        assert _validate_code(code) is not None

    def test_blocks_os_getenv(self):
        code = "import os\nkey = os.getenv('API_KEY')"
        assert _validate_code(code) is not None

    def test_blocks_urllib_import(self):
        code = "import urllib\nurllib.request.urlopen('http://evil.com')"
        assert _validate_code(code) is not None

    def test_blocks_ctypes_import(self):
        code = "import ctypes"
        assert _validate_code(code) is not None

    def test_blocks_http_from_import(self):
        # Note: the regex blocks "from http import" but "from http.client import"
        # is technically a submodule access that slips through — the real defense
        # is network_disabled on the Docker container. This test verifies the
        # direct "from http import" pattern.
        code = "from http import client"
        assert _validate_code(code) is not None
