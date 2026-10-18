import hashlib
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _sha256(relative_path: str) -> str:
    digest = hashlib.sha256()
    with (PROJECT_ROOT / relative_path).open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def test_selected_protected_m3_assets_match_stage1_baseline_hashes():
    expected = {
        "backend/app/m3.py": "3cb5e6c87bf526d199782f59066cf18ec7e03998f371dd2639ceabd760a13a86",
        # Intentional deployment change: lazy-load one M3 pipeline at a time
        # to stay within the free Render service memory limit.
        "backend/app/ml/rsl_predictor.py": "adba92de39b17512d6ee01cf520ebcadf19e66fcf5dd5abfde648902b9b886e7",
        "backend/app/ml/saved_models/model_registry.json": "53d80c66223f2be469459e728315d81028133e056d1bce5c7b064b6083a34159",
        "backend/app/ml/saved_models/synthetic_model_registry.json": "533242d0b82f3722439b197ec29f57952b76df27606a171864e29725055e8f53",
        "backend/app/ml/saved_models/tomato_rsl.joblib": "dd46dc48b9b484c2ae75beffe65722b3e5e59e631279f8b876915a10da508578",
        "backend/app/ml/saved_models/vegetables_rsl_synthetic.joblib": "7b41b2ca8f47f70b4bdc98945544c8180277b1b813a1a9dfea1772bdf79998eb",
    }
    assert {_path: _sha256(_path) for _path in expected} == expected

