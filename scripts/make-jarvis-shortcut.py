#!/usr/bin/env python3
"""Build and sign the "Jarvis" push-to-talk Shortcut on the Mac (bamware-ai#295).

  python3 scripts/make-jarvis-shortcut.py [out-dir]     -> <out-dir>/Jarvis.shortcut (signed), then `open` it to import

Dictate Text -> Get Contents of URL (POST the sentence as the body to /ask on omarchy) -> Speak Text.
The same file imports on the iPhone over iCloud/AirDrop; bind it to the Action Button in Settings.
Same plist shape as the eight button Shortcuts made 2026-10-29; only the body attachment is new.
"""
import plistlib, subprocess, sys, uuid, pathlib

URL = "https://omarchy.tailb7fa1e.ts.net:8788/ask"
dictate, fetch = str(uuid.uuid4()).upper(), str(uuid.uuid4()).upper()

def ref(out_uuid, name):
    """A text field whose whole content is another action's output."""
    return {"Value": {"string": "￼", "attachmentsByRange": {"{0, 1}": {"OutputUUID": out_uuid, "OutputName": name, "Type": "ActionOutput"}}},
            "WFSerializationType": "WFTextTokenString"}

actions = [
    {"WFWorkflowActionIdentifier": "is.workflow.actions.dictatetext",
     "WFWorkflowActionParameters": {"UUID": dictate, "WFSpeechLanguage": "en-US", "WFDictateTextStopListening": "After Pause"}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
     "WFWorkflowActionParameters": {"UUID": fetch, "Advanced": True, "ShowHeaders": False, "WFHTTPMethod": "POST",
                                    "WFURL": URL, "WFHTTPBodyType": "File",
                                    "WFRequestVariable": {"Value": {"OutputUUID": dictate, "OutputName": "Dictated Text", "Type": "ActionOutput"},
                                                          "WFSerializationType": "WFTextTokenAttachment"}}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.speaktext",
     "WFWorkflowActionParameters": {"WFText": ref(fetch, "Contents of URL"), "WFSpeakTextWait": True, "WFSpeakTextRate": 0.5, "WFSpeakTextLanguage": "en-US"}},
]
plist = {
    "WFWorkflowActions": actions, "WFWorkflowClientVersion": "2605.0.5", "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900", "WFWorkflowHasOutputFallback": False, "WFWorkflowHasShortcutInputVariables": False,
    "WFWorkflowIcon": {"WFWorkflowIconGlyphNumber": 59511, "WFWorkflowIconStartColor": 4271458815},
    "WFWorkflowImportQuestions": [], "WFWorkflowInputContentItemClasses": [], "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowTypes": ["NCWidget", "WatchKit"], "WFQuickActionSurfaces": [],
}
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser(); out.mkdir(parents=True, exist_ok=True)
raw, signed = out / "Jarvis-unsigned.shortcut", out / "Jarvis.shortcut"
with open(raw, "wb") as f: plistlib.dump(plist, f)
subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", str(raw), "--output", str(signed)], check=True)
print(f"{signed}\nimport: open '{signed}'   then Settings > Action Button > Shortcut > Jarvis")
