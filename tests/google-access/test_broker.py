import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('broker',Path(__file__).parents[2]/'services/google-access/broker.py')
b=importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
class Boundaries(unittest.TestCase):
    def test_workers_denied(self):
        for path in ('/user.slice/user-1000.slice/user@1000.service/app.slice/overnight.service',
                     '/user.slice/hermes-gateway.service-evil', '/user.slice/ssh.service'):
            self.assertFalse(b.allowed_peer(1,1000,1000,'0::'+path))
    def test_assistant_allowed(self):
        self.assertTrue(b.allowed_peer(1,1000,1000,'0::/user.slice/assistant-web.service'))
        self.assertFalse(b.allowed_peer(1,1001,1000,'0::/assistant-web.service'))
    def test_no_mutations_or_arbitrary_commands(self):
        for op in ('send','gmail_send','auth','exec','drive_delete','drive_share'):
            with self.assertRaises(ValueError): b.command({'op':op})
    def test_no_flags_in_identifiers(self):
        for item in ('--access-token=secret','../file','a/b','x;rm -rf /'):
            with self.assertRaises(ValueError): b.command({'op':'gmail_get','id':item})
    def test_query_flag_separator(self):
        args=b.command({'op':'gmail_search','query':'--access-token=bad'})
        self.assertEqual(args[-2:],['--','--access-token=bad'])
    def test_no_arbitrary_output_path(self):
        with self.assertRaises(ValueError): b.command({'op':'drive_download','id':'abc','out':'/etc/file'})
    def test_bounded_reads(self):
        for limit in (0,51,True,'10'):
            with self.assertRaises(ValueError): b.command({'op':'drive_list','limit':limit})
if __name__=='__main__': unittest.main()
