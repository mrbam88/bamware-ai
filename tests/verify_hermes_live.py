"""Live, no-model integration check against the installed Hermes runtime.

Run with Hermes' Python from the bamware-ai root. Uses real Git fetch and
real Hermes hook/skill/context loaders, not a mocked provider response.
"""
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
launcher = Path(shutil.which("hermes") or "").resolve()
# A standard Hermes venv entry point is <install>/venv/bin/hermes.
install = launcher.parents[2]
sys.path.insert(0, str(install))
os.chdir(ROOT)
os.environ["TERMINAL_CWD"] = str(ROOT)

from agent.prompt_builder import build_context_files_prompt, build_skills_system_prompt
from agent.shell_hooks import register_from_config
from hermes_cli.config import load_config
from hermes_cli.plugins import invoke_hook
from tools.skills_tool import _find_all_skills, skill_view

expected = sorted(p.name for p in (ROOT / "skills").iterdir()
                  if p.is_dir() and not p.is_symlink() and (p / "SKILL.md").is_file())
discovered = {s["name"] for s in _find_all_skills()}
assert set(expected) <= discovered, {"missing": sorted(set(expected) - discovered)}
resolved = []
for name in expected:
    result = json.loads(skill_view(name, preprocess=False))
    assert result.get("success"), (name, result.get("error"))
    path = Path(result.get("_source_path") or result["skill_dir"] + "/SKILL.md").resolve()
    assert path == (ROOT / "skills" / name / "SKILL.md").resolve(), (name, str(path))
    resolved.append(name)

context = build_context_files_prompt(cwd=str(ROOT), skip_soul=True)
assert "continuity across agents" in context
index = build_skills_system_prompt()
assert "bamware-context" in index
config = load_config()
register_from_config(config)
results = invoke_hook("pre_llm_call", session_id="bamware-integration-verification",
                      is_first_turn=True, user_message="Check Bamware context",
                      conversation_history=[], model="no-model-call", platform="cli")
contexts = [r["context"] for r in results if isinstance(r, dict) and "context" in r]
assert any("[BAMWARE_CONTEXT_CHECK]" in text for text in contexts), results
assert not any("[BAMWARE_CONTEXT_BLOCKED]" in text for text in contexts), results
repeat = invoke_hook("pre_llm_call", session_id="bamware-integration-verification",
                     is_first_turn=False, user_message="Continue",
                     conversation_history=[{"role": "user", "content": contexts[0]}],
                     model="no-model-call", platform="cli")
assert not any(isinstance(r, dict) and r.get("context") for r in repeat), repeat
print(json.dumps({
    "verified": True, "first_party_skills_expected": len(expected),
    "first_party_skills_resolved_to_canonical_repo": len(resolved), "skills": resolved,
    "project_context_loaded": True, "skill_prompt_loaded": True,
    "approved_hook_dispatched": True, "repeat_turn_deduplicated": True,
    "provider_calls": 0,
    "scope": "fresh Python runtime; real Hermes loaders and hook dispatcher, not an LLM continuation test",
}, indent=2))
