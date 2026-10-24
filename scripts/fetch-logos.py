#!/usr/bin/env python3
"""Download NCAA and junior hockey logos into public/logos/ and write src/lib/logos.json.

Run from the project root:  python3 scripts/fetch-logos.py   (needs Pillow: pip install pillow)

Sources:
- NCAA: ESPN's college hockey team list and its logo CDN (light + dark-background variants).
- Junior: each league's own site / its HockeyTech (leaguestat) image host. Team ids and names below were
  read from those sites' team bars and standings pages; update them when a league adds or renames a team.
Logos are resized to fit 96x96 and saved as PNG (SVGs are copied as-is).
"""

import io
import json
import re
import sys
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "logos"
MANIFEST = ROOT / "src" / "lib" / "logos.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"}
SIZE = 96

ESPN_TEAMS = "https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey/teams?limit=500"
ESPN_LOGO = "https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/{variant}/{id}.png&h={size}&w={size}"
# Sheet school names that don't match ESPN's names, plus schools missing from ESPN's hockey list.
NCAA_ALIASES = {
    "Alaska Fairbanks Nanooks": 298,
    "Augustana Vikings": 2043,
    "Long Island Sharks": 110133,
    "Miami Ohio RedHawks": 193,
    "Nebraska Omaha Mavericks": 2437,
    "RPI Engineers": 2528,
    "St. Cloud Huskies": 2594,
    "UMass Minutemen": 113,
    "Tennessee State Tigers": 2634,  # from ESPN's basketball list; the logo id is shared across sports
}

LS = "https://assets.leaguestat.com"
CHL = {
    "OHL": ("ohl", {
        "Barrie Colts": "7.png", "Brampton Steelheads": "18.jpg", "Brantford Bulldogs": "1.png",
        "Erie Otters": "8.png", "Flint Firebirds": "13.png", "Guelph Storm": "9.png",
        "Kingston Frontenacs": "2.png", "Kitchener Rangers": "10.png", "London Knights": "14.png",
        "Niagara IceDogs": "20.jpg", "North Bay Battalion": "19.png", "Oshawa Generals": "4.png",
        "Ottawa 67's": "5_88.png", "Owen Sound Attack": "11.png", "Peterborough Petes": "6.png",
        "Saginaw Spirit": "34.png", "Sarnia Sting": "15.png", "Soo Greyhounds": "16.png",
        "Sudbury Wolves": "12.png", "Windsor Spitfires": "17.png",
    }),
    "WHL": ("whl", {
        "Brandon Wheat Kings": "201.jpg", "Calgary Hitmen": "202.png", "Edmonton Oil Kings": "228.png",
        "Everett Silvertips": "226.png", "Kamloops Blazers": "203.png", "Kelowna Rockets": "204.jpg",
        "Lethbridge Hurricanes": "205.png", "Medicine Hat Tigers": "206.png", "Moose Jaw Warriors": "207.png",
        "Penticton Vees": "277_295.jpg", "Portland Winterhawks": "208.png", "Prince Albert Raiders": "209.png",
        "Prince George Cougars": "210.png", "Red Deer Rebels": "211.png", "Regina Pats": "212.png",
        "Saskatoon Blades": "213.jpg", "Seattle Thunderbirds": "214.png", "Spokane Chiefs": "215.png",
        "Swift Current Broncos": "216.png", "Tri-City Americans": "217.png", "Vancouver Giants": "223.png",
        "Victoria Royals": "227.png", "Wenatchee Wild": "222_295.jpg",
    }),
    "QMJHL": ("lhjmq", {
        "Baie-Comeau Drakkar": "16.png", "Blainville-Boisbriand Armada": "19.png", "Cape Breton Eagles": "3.jpg",
        "Charlottetown Islanders": "7.png", "Chicoutimi Saguenéens": "10.png", "Drummondville Voltigeurs": "14_214.png",
        "Gatineau Olympiques": "12.png", "Halifax Mooseheads": "5_214.png", "Moncton Wildcats": "1.png",
        "Newfoundland Regiment": "2_214.png", "Québec Remparts": "9.png", "Rimouski Océanic": "18_214.png",
        "Rouyn-Noranda Huskies": "11.png", "Saint John Sea Dogs": "8.png", "Shawinigan Cataractes": "13.png",
        "Sherbrooke Phoenix": "60_214.png", "Val-d'Or Foreurs": "15.png", "Victoriaville Tigres": "17.png",
    }),
}
# HockeyTech leagues whose ids came from 50x50 thumbnails; the full-size image is tried first.
# MJHL only publishes the 50x50 thumbnails, so its paths point at those directly.
HOCKEYTECH = {
    "BCHL": ("bchl", {
        "Powell River Kings": 8, "Coquitlam Express": 9, "Cowichan Valley Capitals": 10, "Surrey Eagles": 11,
        "Chilliwack Chiefs": 13, "Prince George Spruce Kings": 14, "Alberni Valley Bulldogs": 16,
        "Langley Rivermen": 17, "Victoria Grizzlies": 18, "West Kelowna Warriors": 19, "Salmon Arm Silverbacks": 20,
        "Vernon Vipers": 21, "Trail Smoke Eaters": 22, "Nanaimo Clippers": 23, "Cranbrook Bucks": 39,
        "Brooks Bandits": 81, "Blackfalds Bulldogs": 82, "Okotoks Oilers": 87, "Sherwood Park Crusaders": 88,
        "Spruce Grove Saints": 89,
    }),
    "OJHL": ("ojhl", {
        "Buffalo Jr. Sabres": 8, "Aurora Tigers": 10, "Caledon Admirals": 11, "King Rebellion": 12,
        "Burlington Cougars": 13, "Cobourg Cougars": 14, "Collingwood Blues": 15, "Georgetown Raiders": 16,
        "Toronto Warriors": 17, "Lindsay Muskies": 18, "Leamington Flyers": 19, "Markham Royals": 20,
        "Milton Menace": 21, "Mississauga Chargers": 22, "North York Rangers": 23, "Oakville Blades": 24,
        "Pickering Panthers": 25, "St. Michaels Buzzers": 26, "Stouffville Spirit": 27, "Newmarket Hurricanes": 28,
        "Toronto Patriots": 29, "Trenton Golden Hawks": 30, "Wellington Dukes": 31, "Niagara Falls Canucks": 39,
    }),
    "AJHL": ("ajhl", {
        "Bonnyville Pontiacs": 1, "Calgary Canucks": 3, "Camrose Kodiaks": 5, "Canmore Eagles": 6,
        "Drayton Valley Thunder": 7, "Drumheller Dragons": 8, "Fort McMurray Oil Barons": 9,
        "Grande Prairie Storm": 11, "Lloydminster Bobcats": 12, "Olds Grizzlys": 14,
        "Whitecourt Wolverines": 19, "Devon Xtreme": 27,
    }),
    "MJHL": ("mjhl", {
        "Dauphin Kings": "50x50/1.png", "Neepawa Titans": "50x50/2.png", "Northern Manitoba Blizzard": "50x50/3_58.png",
        "Portage Terriers": "50x50/4.png", "Selkirk Steelers": "50x50/5.png", "Steinbach Pistons": "50x50/6.png",
        "Swan Valley Stampeders": "50x50/7.png", "Virden Oil Capitals": "50x50/8.png", "Waywayseecappo Wolverines": "50x50/9.png",
        "Winkler Flyers": "50x50/10.jpg", "Winnipeg Blues": "50x50/11.png", "Winnipeg Monarchs": "50x50/41.png",
        "Niverville Nighthawks": "50x50/42.png",
    }),
}
USHL_BASE = "https://dbukjj6eu5tsf.cloudfront.net/ushl.sidearmsports.com/images/responsive_2022/"
USHL = {
    "Cedar Rapids RoughRiders": "logo_cedar-rapids.svg", "Chicago Steel": "chicago_primarylogo.svg",
    "Dubuque Fighting Saints": "dubuque_primarylogo.svg", "Green Bay Gamblers": "greenbay_primarylogo.svg",
    "Madison Capitols": "madison_primarylogo.svg", "Muskegon Lumberjacks": "muskegon_primarylogo.svg",
    "USNTDP": "ntdp_primarylogo.svg", "Youngstown Phantoms": "youngstown_primarylogo.svg",
    "Des Moines Buccaneers": "logo_des-moines.svg", "Fargo Force": "fargo_primarylogo.svg",
    "Lincoln Stars": "lincoln_primarylogo.svg", "Omaha Lancers": "logo_lancers.svg",
    "Sioux City Musketeers": "logo_sioux-city.svg", "Sioux Falls Stampede": "sioux-falls_primarylogo.svg",
    "Tri-City Storm": "logo_tri-city.svg", "Waterloo Black Hawks": "waterloo_primarylogo.svg",
}
TEAM_ALIASES = {"USNTDP": ["USNTDP U18", "USNTDP U17", "Team USA"]}
# NAHL team logos are one sprite; each entry is [x offset, y offset, width, height] as the site's CSS uses them.
NAHL_SPRITE = "https://nahl.com/nahl/img/2627/teambar-1-20260723.png"
NAHL = {
    "Aberdeen Wings": [-5, 0, 34, 60], "Amarillo Wranglers": [-1039, 0, 43, 60], "Anchorage Wolverines": [-54, 0, 36, 60],
    "Austin Bruins": [-102, 0, 40, 60], "Billings Cattle Punchers": [-679, 0, 40, 60], "Bismarck Bobcats": [-152, 0, 38, 60],
    "Corpus Christi IceRays": [-300, 0, 42, 60], "Danbury Hat Tricks": [-1312, 0, 49, 60], "El Paso Rhinos": [-199, 0, 38, 60],
    "Elmira Aviators": [-1657, 0, 44, 60], "Fairbanks Ice Dogs": [-349, 0, 33, 60], "Grand Junction River Hawks": [-1082, 0, 39, 60],
    "Houston Bulls": [-246, 0, 43, 60], "Idaho Falls Spud Kings": [-1361, 0, 37, 60], "Janesville Jets": [-442, 0, 39, 60],
    "Johnstown Tomahawks": [-490, 0, 40, 60], "Kenai River Brown Bears": [-539, 0, 39, 60], "Lone Star Brahmas": [-587, 0, 44, 60],
    "Maryland Black Bears": [-640, 0, 39, 60], "Minnesota Mallards": [-1711, 0, 38, 60], "Minnesota Wilderness": [-1565, 0, 39, 60],
    "Minot Minotauros": [-738, 0, 46, 60], "New Hampshire Mountain Kings": [-1475, 0, 38, 60], "New Jersey Titans": [-794, 0, 44, 60],
    "New Mexico Ice Wolves": [-1141, 0, 38, 60], "Northeast Generals": [-848, 0, 39, 60], "Odessa Jackalopes": [-896, 0, 42, 60],
    "Ogden Mustangs": [-1398, 0, 38, 60], "Oklahoma Warriors": [-1277, 0, 35, 60], "Philadelphia Rebels": [-392, 0, 35, 60],
    "Pueblo Peppers": [-1436, 0, 27, 60], "Shreveport Mudbugs": [-947, 0, 35, 60], "Springfield Jr. Blues": [-990, 0, 36, 60],
    "St. Cloud Norsemen": [-1188, 0, 37, 60], "Watertown Shamrocks": [-1611, 0, 39, 60], "Wisconsin Windigo": [-1234, 0, 35, 60],
}
# League logos, used when a team in that league has no logo of its own.
# "invert": the logo is white-only, so the app inverts it on light backgrounds.
LEAGUES = {
    "USHL": {"src": USHL_BASE + "ushl_on-light.svg", "dark": USHL_BASE + "ushl_on-dark.svg"},
    "NAHL": {"src": "https://nahl.com/nahl/img/1819/skin/masthead/logo-1.png"},
    "BCHL": {"src": "https://bchl.ca/images/navicons/bchl-logo.png"},
    "QMJHL": {"src": "https://media.chl.ca/wp-content/uploads/sites/2/2023/05/25155229/logo_q_lg.png"},
    "OHL": {"src": "https://media.chl.ca/wp-content/uploads/sites/5/2023/05/25210408/logo_OHL_lg_white-1.png", "invert": True},
}


def get(url):
    # curl rather than urllib: urllib stalls ~30s per request on some of these CDNs (no IPv4 fallback race).
    result = subprocess.run(["curl", "-sSfL", "--max-time", "30", "--retry", "3", "--retry-all-errors", "-A", UA["User-Agent"], url],
                            capture_output=True, check=False)
    if result.returncode:
        raise OSError(result.stderr.decode().strip() or f"curl exit {result.returncode}")
    return result.stdout


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def clear_white_background(img):
    """JPG logos sit on a white box; make the white connected to the corners transparent."""
    img = img.convert("RGBA")
    w, h = img.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        r, g, b, a = img.getpixel(corner)
        if a and min(r, g, b) > 235:
            ImageDraw.floodfill(img, corner, (255, 255, 255, 0), thresh=40)
    return img


def save_raster(data, path, from_jpg=False, crop=None):
    img = Image.open(io.BytesIO(data))
    if crop:
        img = img.crop(crop)
    img = clear_white_background(img) if from_jpg else img.convert("RGBA")
    img = img.crop(img.getbbox() or (0, 0, *img.size))  # trim transparent padding
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    # A 256-color palette (alpha kept) is visually identical at this size and ~4x smaller.
    img.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, "PNG", optimize=True)


def save(url, path, **kw):
    """Download url into path (PNG, or SVG copied as-is). Returns the public URL path or None."""
    try:
        data = get(url)
    except Exception as e:  # noqa: BLE001 - a missing logo shouldn't stop the run
        print(f"  ! {url}: {e}", file=sys.stderr)
        return None
    if url.split("?")[0].endswith(".svg"):
        path = path.with_suffix(".svg")
        path.parent.mkdir(parents=True, exist_ok=True)
        # Drop embedded print color profiles (one logo carries ~1 MB of ICC data browsers ignore).
        svg = re.sub(rb"<color-profile\b.*?(?:/>|</color-profile>)", b"", data, flags=re.S)
        path.write_bytes(svg)
    else:
        path = path.with_suffix(".png")
        save_raster(data, path, from_jpg=bool(re.search(r"\.jpe?g($|\?)", url)), **kw)
    return "/" + path.relative_to(ROOT / "public").as_posix()


def main():
    manifest = {"ncaa": [], "teams": [], "leagues": {}}

    print("NCAA (ESPN)")
    data = json.loads(get(ESPN_TEAMS))
    espn = {int(t["team"]["id"]): t["team"] for t in data["sports"][0]["leagues"][0]["teams"]}
    names = {}
    for tid, t in espn.items():
        if t.get("logos"):
            names.setdefault(tid, set()).update(n for n in [t.get("displayName"), t.get("shortDisplayName")] if n)
    for name, tid in NCAA_ALIASES.items():
        names.setdefault(tid, set()).add(name)
    for tid, aliases in sorted(names.items()):
        src = save(ESPN_LOGO.format(variant="500", id=tid, size=SIZE * 2), OUT / "ncaa" / str(tid))
        dark = save(ESPN_LOGO.format(variant="500-dark", id=tid, size=SIZE * 2), OUT / "ncaa" / f"{tid}-dark")
        if src and dark and (ROOT / "public" / src[1:]).read_bytes() == (ROOT / "public" / dark[1:]).read_bytes():
            (ROOT / "public" / dark[1:]).unlink()  # ESPN often serves the same image for both
            dark = None
        if src:
            manifest["ncaa"].append({"names": sorted(aliases), "src": src, **({"dark": dark} if dark else {})})

    def add_team(name, league, src):
        if src:
            manifest["teams"].append({"name": name, "league": league, "aliases": TEAM_ALIASES.get(name, []), "src": src})

    for league, (code, teams) in CHL.items():
        print(league)
        for name, file in teams.items():
            add_team(name, league, save(f"{LS}/{code}/logos/{file}", OUT / slug(league) / slug(name)))

    for league, (code, teams) in HOCKEYTECH.items():
        print(league)
        for name, ref in teams.items():
            files = [ref] if isinstance(ref, str) else [f"{ref}.png", f"{ref}.jpg", f"50x50/{ref}.png"]
            src = None
            for file in files:
                src = save(f"{LS}/{code}/logos/{file}", OUT / slug(league) / slug(name))
                if src:
                    break
            add_team(name, league, src)

    print("USHL")
    for name, file in USHL.items():
        add_team(name, "USHL", save(USHL_BASE + file, OUT / "ushl" / slug(name)))

    print("NAHL")
    sprite = get(NAHL_SPRITE)
    for name, (x, y, w, h) in NAHL.items():
        path = OUT / "nahl" / f"{slug(name)}.png"
        save_raster(sprite, path, crop=(-x, -y, -x + w, -y + h))
        add_team(name, "NAHL", "/" + path.relative_to(ROOT / "public").as_posix())

    print("Leagues")
    for league, info in LEAGUES.items():
        src = save(info["src"], OUT / "leagues" / slug(league))
        dark = save(info["dark"], OUT / "leagues" / f"{slug(league)}-dark") if "dark" in info else None
        if src:
            manifest["leagues"][league] = {"src": src, **({"dark": dark} if dark else {}),
                                           **({"invert": True} if info.get("invert") else {})}

    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(manifest['ncaa'])} NCAA, {len(manifest['teams'])} junior teams, "
          f"{len(manifest['leagues'])} leagues -> {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
