# SPDX-License-Identifier: GPL-3.0-or-later — Copyright (C) 2026 jeremdevgit
"""Inspect generated offline HTML resources; this is not an HTML sanitizer."""
from __future__ import annotations
from html.parser import HTMLParser
import re


def ressources_non_integrees(html: str, liens_externes: bool = False) -> list[str]:
    class Ressources(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.manquantes = []
            self.style = False

        def autorisee(self, value):
            value = value.strip().lower()
            return value.startswith(("data:", "#")) or (liens_externes and value.startswith(("https://", "http://")))

        def handle_starttag(self, tag, attrs):
            if tag == "style":
                self.style = True
            for key, value in attrs:
                # Normal links do not load a resource in Suite Libre.
                if key in ("src", "href") and value and (liens_externes or tag in ("script", "link", "img")):
                    if not self.autorisee(value):
                        self.manquantes.append(value)
                if key == "style" and value:
                    self.css(value)

        def handle_endtag(self, tag):
            if tag == "style":
                self.style = False

        def handle_data(self, data):
            if self.style:
                self.css(data)

        def css(self, data):
            for _, value in re.findall(r'''url\(\s*(["']?)(.*?)\1\s*\)''', data, flags=re.I):
                if not value.strip().lower().startswith("data:"):
                    self.manquantes.append(value)

    parser = Ressources()
    parser.feed(html)
    parser.close()
    return parser.manquantes
