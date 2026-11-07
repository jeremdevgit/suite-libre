# SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit
import unittest
from verifier_ressources import ressources_non_integrees

class OfflineResources(unittest.TestCase):
    def test_external_scripts_in_all_tag_spellings(self):
        for html in ['<SCRIPT src="missing.js"></SCRIPT>', '<script type="text/javascript" src="missing.js"></script>', '<ScRiPt src="missing.js"></script\t\n bar>']:
            self.assertEqual(ressources_non_integrees(html), ['missing.js'])
    def test_inline_script_is_not_reinterpreted_as_html(self):
        self.assertEqual(ressources_non_integrees('<SCRIPT>const demo = \'<img src="not-a-resource.png">\';</SCRIPT>'), [])
    def test_css_and_image_resources(self):
        self.assertEqual(ressources_non_integrees('<IMG SRC="missing.png"><style>body{background:URL("missing.svg")}</style>'), ['missing.png', 'missing.svg'])
        self.assertEqual(ressources_non_integrees('<img src="data:image/png;base64,AA"><style>@font-face{src:url(data:font/woff2;base64,AA)}</style>'), [])

if __name__ == '__main__':
    unittest.main()
