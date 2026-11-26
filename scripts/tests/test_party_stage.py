"""Offline tests of scripts/party_stage.py: synthetic audio and pictures in. No sound, no lights, no network."""
import colorsys
import importlib.util
import math
import pathlib
import random
import unittest
import unittest.mock

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "party_stage.py"
spec = importlib.util.spec_from_file_location("party_stage", SCRIPT)
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)


def hue_of(rgb):
    return colorsys.rgb_to_hsv(*(c / 255 for c in rgb))[0]


def music(seconds, bpm, kick=9000, hat=0, seed=1):
    """A dance track in miniature: a 60 Hz kick on every beat, an optional 5 kHz hi-hat between beats, a mid bed."""
    rng = random.Random(seed)
    period = 60 / bpm
    samples = []
    for n in range(int(seconds * ps.RATE)):
        t = n / ps.RATE
        since = t % period
        off = (t + period / 2) % period
        value = kick * math.exp(-since * 28) * math.sin(2 * math.pi * 60 * since)
        value += hat * math.exp(-off * 60) * math.sin(2 * math.pi * 5000 * t)
        value += 1200 * math.sin(2 * math.pi * 800 * t) + rng.uniform(-200, 200)
        samples.append(int(max(-32768, min(32767, value))))
    return [samples[i:i + ps.FRAME] for i in range(0, len(samples) - ps.FRAME + 1, ps.FRAME)]


class EarTest(unittest.TestCase):
    def test_follows_common_tempos(self):
        for bpm in (96, 120, 140):
            with self.subTest(bpm=bpm):
                ear = ps.Ear()
                beats = sum(ear.feed(frame) for frame in music(20, bpm))
                self.assertAlmostEqual(beats, bpm / 3, delta=bpm * 0.04)    # 20 s holds bpm/3 beats

    def test_silence_is_not_playing_and_has_no_beats(self):
        ear = ps.Ear()
        self.assertEqual(sum(ear.feed([0] * ps.FRAME) for _ in range(300)), 0)
        self.assertFalse(ear.playing)

    def test_bands_separate_a_kick_from_a_hat(self):
        def peaks(frames):
            ear = ps.Ear()
            top = [0.0, 0.0, 0.0]
            for index, frame in enumerate(frames):
                ear.feed(frame)
                if index > 60:                       # after the levels have found their range
                    top = [max(a, b) for a, b in zip(top, ear.peak)]
            return top

        kick_only = peaks(music(6, 120, kick=9000, hat=0))
        with_hat = peaks(music(6, 120, kick=9000, hat=6000))
        self.assertGreater(with_hat[2], kick_only[2] * 3, "a hi-hat shows up in the treble band")
        self.assertAlmostEqual(with_hat[0], kick_only[0], delta=kick_only[0] * 0.2, msg="and leaves the bass alone")

    def test_levels_stay_between_zero_and_one(self):
        ear = ps.Ear()
        for frame in music(5, 128, hat=5000):
            ear.feed(frame)
            self.assertTrue(all(0 <= level <= 1 for level in ear.level))


class PaletteTest(unittest.TestCase):
    def test_vivid_hues_win_over_dull_background(self):
        picture = [(20, 20, 24)] * 400 + [(230, 30, 200)] * 100 + [(20, 200, 230)] * 80
        hues = sorted(hue_of(c) for c in ps.palette_from(picture))
        self.assertTrue(any(abs(h - hue_of((230, 30, 200))) < 0.03 for h in hues))
        self.assertTrue(any(abs(h - hue_of((20, 200, 230))) < 0.03 for h in hues))

    def test_colourless_cover_gets_the_party_palette(self):
        self.assertEqual(ps.palette_from([(40, 40, 40)] * 300 + [(220, 220, 220)] * 276), ps.FALLBACK)
        self.assertEqual(ps.palette_from([]), ps.FALLBACK)

    def test_green_is_dropped_beside_red(self):
        picture = [(240, 20, 20)] * 200 + [(20, 220, 40)] * 200 + [(250, 200, 0)] * 100
        for colour in ps.palette_from(picture):
            self.assertFalse(0.20 < hue_of(colour) < 0.47, "no green in a palette that has red")

    def test_green_survives_without_red(self):
        picture = [(20, 220, 40)] * 300 + [(20, 60, 230)] * 200
        self.assertTrue(any(0.20 < hue_of(c) < 0.47 for c in ps.palette_from(picture)))

    def test_one_colour_cover_still_has_room_to_move(self):
        result = ps.palette_from([(250, 120, 0)] * 500)
        self.assertGreaterEqual(len(set(result)), 3)

    def test_every_colour_is_full_strength(self):
        for colour in ps.palette_from([(120, 40, 160)] * 300 + [(40, 120, 160)] * 300):
            self.assertEqual(max(colour), 255)


class BulbColourTest(unittest.TestCase):
    def test_a_bass_hit_makes_the_first_bulb_brighter(self):
        ear = ps.Ear()
        ear.rms = 1000
        ear.level = [0.05, 0.05, 0.05]
        quiet = ps.bulb_colours(ear, ps.FALLBACK, 0.0)
        ear.level = [1.0, 0.05, 0.05]
        hit = ps.bulb_colours(ear, ps.FALLBACK, 0.0)
        self.assertGreater(sum(hit[0]), sum(quiet[0]) * 3)
        self.assertAlmostEqual(sum(hit[1]), sum(quiet[1]), delta=1, msg="the other bulb follows mids and treble")

    def test_bulbs_never_go_fully_dark(self):
        ear = ps.Ear()
        ear.rms = 1000
        ear.level = [0.0, 0.0, 0.0]
        for colour in ps.bulb_colours(ear, ps.FALLBACK, 1.3):
            self.assertGreater(max(colour), 30)


class ScreenTest(unittest.TestCase):
    def test_the_vivid_part_of_a_frame_sets_the_room(self):
        night = [(8, 10, 30)] * 700 + [(20, 60, 230)] * 200 + [(200, 200, 200)] * 60
        colour = ps.screen_colour(night)
        self.assertAlmostEqual(hue_of(colour), hue_of((20, 60, 230)), delta=0.04)
        self.assertEqual(max(colour), 255, "lights get the hue at full strength")

    def test_blue_is_allowed_from_the_screen(self):
        self.assertGreater(ps.screen_colour([(0, 40, 255)] * 100)[2], 200)

    def test_black_frame_holds_the_last_colour(self):
        self.assertIsNone(ps.screen_colour([(2, 2, 2)] * 500))
        self.assertIsNone(ps.screen_colour([]))

    def test_colourless_frame_is_warm_white_as_bright_as_the_frame(self):
        bright = ps.screen_colour([(230, 230, 230)] * 500)
        credits = ps.screen_colour([(30, 30, 30)] * 480 + [(240, 240, 240)] * 20)
        self.assertGreater(min(bright), 200)
        self.assertLess(max(credits), 120, "grey end credits must not light the room up")
        self.assertGreater(bright[0], bright[2], "warm, not blue-white")

    def test_capture_regions_are_thin_strips_inside_the_tv(self):
        monitors = [{"description": "Apple Color LCD", "x": 0, "y": 0, "width": 3072, "height": 1920, "scale": 2},
                    {"description": "Samsung Electric Company QBQ90", "x": 1536, "y": 0, "width": 3840, "height": 2160, "scale": 2}]
        with unittest.mock.patch.object(ps, "hypr", return_value=__import__("json").dumps(monitors)):
            strips = ps.tv_strips()
        self.assertEqual(len(strips), 3)
        for strip in strips:
            origin, size = strip.split(" ")
            x, y = map(int, origin.split(","))
            w, h = map(int, size.split("x"))
            self.assertTrue(1536 <= x and x + w <= 1536 + 1920 and 0 <= y <= 1080 and h == 4)
        with unittest.mock.patch.object(ps, "hypr", return_value=__import__("json").dumps(monitors[:1])):
            self.assertEqual(ps.tv_strips(), [], "no TV output: nothing to look at")

    def test_room_glides_and_breathes_with_the_bass(self):
        ear = ps.Ear()
        ear.rms = 1000
        ear.level = [0.0, 0.0, 0.0]
        current, quiet = ps.room_colour(ear, (255, 0, 0), (0, 0, 255))
        self.assertTrue(0 < current[2] < 255 and 0 < current[0] < 255, "a cut on screen becomes a sweep, not a jump")
        ear.level = [1.0, 0.0, 0.0]
        _, loud = ps.room_colour(ear, (255, 0, 0), (0, 0, 255))
        self.assertGreater(sum(loud), sum(quiet) * 1.8)
        for _ in range(12):
            current, _ = ps.room_colour(ear, current, (0, 0, 255))
        self.assertGreater(current[2], 250, "and it arrives within a second or so")


if __name__ == "__main__":
    unittest.main()
