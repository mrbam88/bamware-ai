"""python3 -I scripts/tests/test_ask.py  (no server, no model: the decision logic only)"""
import importlib.util, json, os, pathlib, tempfile, unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("ask", HERE.parent / "ask.py"); ask = importlib.util.module_from_spec(spec); spec.loader.exec_module(ask)

class Reflex(unittest.TestCase):
    def t(self, said, want): self.assertEqual(ask.reflex_for(said), want, said)
    def test_plain_phrases(self):
        for said, want in [("lights on", "lights-on"), ("Lights off.", "lights-off"), ("kill the lights", "lights-off"),
                           ("Next song", "next"), ("skip", "next"), ("Evening", "evening"), ("match the sun", "daylight"),
                           ("quiet the mic", "mute-alert"), ("TV off", "tv-off"), ("put the game on", "game-on")]:
            self.t(said, want)
    def test_filler_is_ignored(self):
        self.t("Hey Jarvis, lights on please", "lights-on"); self.t("okay turn off the lights", "lights-off"); self.t("Jarvis next song, thanks", "next")
    def test_questions_go_to_the_agent(self):
        for said in ["what did I ship yesterday", "did the kill switch fire today", "how bright is it outside",
                     "turn on the lights in the kitchen tomorrow", "", "   "]:
            self.t(said, None)
    def test_longest_phrase_wins(self):
        self.t("lights off", "lights-off"); self.t("play pause", "play")

class Answer(unittest.TestCase):
    def setUp(self):
        self.calls = []
        ask.run_reflex = lambda a: (self.calls.append(("reflex", a)) or True, f"{a}: done (5 ms)")
        ask.run_agent = lambda t: (self.calls.append(("agent", t)) or True, "Yesterday you shipped the chat endpoint.")
        self.tmp = tempfile.TemporaryDirectory(); ask.HALT = os.path.join(self.tmp.name, "halt.json")
    def tearDown(self): self.tmp.cleanup()
    def test_reflex_never_calls_the_agent(self):
        ok, reply, route = ask.answer("lights on")
        self.assertTrue(ok); self.assertEqual(route, "reflex:lights-on"); self.assertEqual(self.calls, [("reflex", "lights-on")])
    def test_question_calls_the_agent(self):
        ok, reply, route = ask.answer("what did I ship yesterday")
        self.assertTrue(ok); self.assertEqual(route, "agent"); self.assertEqual(self.calls[0][0], "agent")
    def test_halt_blocks_the_agent_but_not_reflexes(self):
        with open(ask.HALT, "w") as f: json.dump({"halted": True, "reason": "weekly cap"}, f)
        ok, reply, route = ask.answer("what did I ship yesterday")
        self.assertFalse(ok); self.assertEqual(route, "halt"); self.assertIn("weekly cap", reply); self.assertEqual(self.calls, [])
        ok, reply, route = ask.answer("lights on"); self.assertTrue(ok)
    def test_empty(self):
        ok, reply, route = ask.answer("  "); self.assertFalse(ok); self.assertEqual(route, "empty")

class Body(unittest.TestCase):
    def test_raw_and_json(self):
        self.assertEqual(ask.body_text(b"lights on\n"), "lights on")
        self.assertEqual(ask.body_text(b'{"text": "next song"}'), "next song")
        self.assertEqual(ask.body_text(b"{not json"), "{not json")

if __name__ == "__main__": unittest.main()
