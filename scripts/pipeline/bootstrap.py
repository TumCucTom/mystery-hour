#!/usr/bin/env python3
"""
Bootstrap: Fetch LBC Mystery Hour RSS feed and extract all episode audio URLs.
Outputs one URL per line to episode_urls.txt.
"""

import urllib.request
import xml.etree.ElementTree as ET
import sys

FEED_URL = "https://feeds.captivate.fm/james-obriens-mystery-hour/"
OUTPUT_FILE = "episode_urls.txt"


def fetch_rss():
    """Download the RSS feed."""
    print(f"Fetching RSS feed: {FEED_URL}")
    try:
        with urllib.request.urlopen(FEED_URL, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"Error fetching feed: {e}", file=sys.stderr)
        sys.exit(1)


def parse_episodes(xml_content):
    """Extract enclosure URLs from RSS items."""
    root = ET.fromstring(xml_content)

    # RSS namespaces
    ns = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}

    urls = []
    for item in root.findall(".//item"):
        enclosure = item.find("enclosure")
        if enclosure is not None:
            url = enclosure.get("url")
            if url:
                urls.append(url)

    return urls


def main():
    print("Starting bootstrap...")
    xml_content = fetch_rss()
    urls = parse_episodes(xml_content)
    print(f"Found {len(urls)} episodes")

    with open(OUTPUT_FILE, "w") as f:
        for url in urls:
            f.write(url + "\n")

    print(f"Written {len(urls)} URLs to {OUTPUT_FILE}")
    print("Bootstrap complete.")


if __name__ == "__main__":
    main()
