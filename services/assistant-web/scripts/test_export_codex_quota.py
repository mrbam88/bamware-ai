import importlib.util, json, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('exporter',Path(__file__).with_name('export-codex-quota.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ExportTest(unittest.TestCase):
 def test_only_quota_metadata_and_latest_observation(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'events.jsonl'
   def event(at,pct):return {'timestamp':at,'payload':{'type':'token_count','secret':'PRIVATE','rate_limits':{'primary':{'used_percent':pct,'window_minutes':10080,'resets_at':1791172743}}}}
   p.write_text('\n'.join(json.dumps(e) for e in [event('2026-10-02T10:00:00Z',21),event('2026-10-02T11:00:00Z',34)])+'\n{torn')
   result=module.collect(Path(d));self.assertEqual(result['windows'][0]['utilizationPct'],34)
   self.assertNotIn('PRIVATE',json.dumps(result));self.assertEqual(result['windows'][0]['source']['fetchedAt'],'2026-10-02T11:00:00Z')
if __name__=='__main__':unittest.main()
