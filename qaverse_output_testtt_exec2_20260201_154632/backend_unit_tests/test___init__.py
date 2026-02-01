import importlib.util
import importlib.machinery
from pathlib import Path


def _find_init_py() -> Path:
    # Start from the directory containing this test file and ascend to locate __init__.py
    start = Path(__file__).resolve().parent
    current = start
    for _ in range(25):
        candidate = current / "__init__.py"
        if candidate.exists():
            return candidate
        if current.parent == current:
            break
        current = current.parent
    raise FileNotFoundError("Could not locate __init__.py in repository")


def _load_init_module(path: Path, name: str = "init_module_under_test"):
    spec = importlib.util.spec_from_file_location(name, str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore
    return module


def test_init_module_has_no_public_attributes():
    path = _find_init_py()
    mod = _load_init_module(path, "init_module_public_test")
    public_names = sorted([n for n in dir(mod) if not n.startswith("_")])
    assert public_names == []


def test_init_module_no_public_callables():
    path = _find_init_py()
    mod = _load_init_module(path, "init_module_callable_test")
    callables = sorted([n for n in dir(mod) if not n.startswith("_") and callable(getattr(mod, n))])
    assert callables == []


def test_init_module_loader_attributes_present():
    path = _find_init_py()
    mod = _load_init_module(path)
    assert hasattr(mod, "__spec__")
    assert hasattr(mod, "__loader__")
    assert mod.__spec__ is not None
    assert mod.__loader__ is not None


def test_init_module_alternative_loaders_equivalence():
    path = _find_init_py()
    m1 = _load_init_module(path, "init_module_alt1")

    loader = importlib.machinery.SourceFileLoader("init_module_alt2", str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    m2 = importlib.util.module_from_spec(spec)
    loader.exec_module(m2)

    public1 = sorted([n for n in dir(m1) if not n.startswith("_")])
    public2 = sorted([n for n in dir(m2) if not n.startswith("_")])
    assert public1 == public2