#!/usr/bin/env python3
"""Review draft only. Standard gh REST calls, fixed release and exact validated bytes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import quote, urlencode
import zipfile

REPO = "Sagittaryuz/Calendar-Timeline"
ROOT = "repos/" + REPO
RELEASE_ID = 416542156
TAG = "android-v0.5.0-debug"
SOURCE = "374a35489975d133f3a23647804106a3d34b9165"
APK = "Calendar-Timeline-Android-debug.apk"
MANIFEST = "calendar-timeline-update.json"
EXPECTED = {
    APK: (401767, "181daf8f321726dcad2dcc52153f431ebacd30bc650f7b789f878f6441dce28e"),
    MANIFEST: (486, "0ba20da5aac837b038e4ae3b05d6dbcee58766d611c63b67d32fa457e1e1d6ae"),
}
CERTIFICATE = "78a17f3f0779bbc15ff3c6ffdb711075d769565e8a79a3d273536bc73633bb6d"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def verify_bytes(name, data):
    size, digest = EXPECTED[name]
    require(len(data) == size and hashlib.sha256(data).hexdigest() == digest,
            "Unexpected bytes for " + name)


def verify_local(directory):
    directory = Path(directory)
    for name in EXPECTED:
        path = directory / name
        require(path.is_file() and not path.is_symlink(), "Missing regular input: " + name)
        verify_bytes(name, path.read_bytes())
    manifest = json.loads((directory / MANIFEST).read_text())
    expected_fields = {
        "format": "calendar-timeline-android-release", "schemaVersion": 1,
        "tested": True, "applicationId": "com.sagittaryuz.calendartimeline",
        "versionCode": 7, "versionName": "0.5.0-debug", "minSdk": 26,
        "signingCertificateSha256": CERTIFICATE, "buildType": "debug",
        "channel": "test", "apk": APK, "sha256": EXPECTED[APK][1],
    }
    require(manifest == expected_fields, "Unexpected release manifest")
    with zipfile.ZipFile(directory / APK) as apk:
        require(not any(re.search(r"\.(?:keystore|jks|p12|pfx)$", n, re.I)
                        for n in apk.namelist()), "Private signing material in APK")


class ApiError(RuntimeError):
    def __init__(self, operation, status=None):
        self.status = status
        super().__init__(operation + (" (HTTP " + str(status) + ")" if status else " failed"))


class GitHub:
    def run(self, arguments, *, payload=None):
        command = ["gh", "api", *arguments]
        if payload is not None:
            command += ["--input", "-"]
        result = subprocess.run(command, input=json.dumps(payload).encode() if payload is not None else None,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
        if result.returncode:
            match = re.search(rb"HTTP\s+(\d{3})", result.stderr)
            raise ApiError("GitHub request", int(match[1]) if match else None)
        return result.stdout

    def get(self, path):
        return json.loads(self.run(["--method", "GET", path]))

    def asset_bytes(self, asset_id):
        require(type(asset_id) is int and asset_id > 0, "Invalid asset ID")
        return self.run(["--method", "GET", ROOT + "/releases/assets/" + str(asset_id),
                         "-H", "Accept: application/octet-stream"])

    def upload(self, path):
        address = "https://uploads.github.com/" + ROOT + "/releases/" + str(RELEASE_ID)
        address += "/assets?" + urlencode({"name": path.name})
        content_type = "application/vnd.android.package-archive" if path.name == APK else "application/json"
        self.run(["--method", "POST", address, "-H", "Content-Type: " + content_type,
                  "--input", str(path)])

    def publish(self):
        self.run(["--method", "PATCH", ROOT + "/releases/" + str(RELEASE_ID)],
                 payload={"draft": False, "prerelease": False, "target_commitish": SOURCE,
                          "make_latest": "false"})


def verify_release(release):
    require(release.get("id") == RELEASE_ID and release.get("tag_name") == TAG,
            "Unexpected release identity")
    require(release.get("prerelease") is False, "Unexpected prerelease state")
    assets = release.get("assets")
    require(isinstance(assets, list), "Missing asset metadata")
    names = [a.get("name") for a in assets]
    require(len(names) == len(set(names)) and set(names) <= set(EXPECTED),
            "Unexpected or duplicate assets; nothing was replaced")
    for asset in assets:
        require(asset.get("state") == "uploaded" and asset.get("size") == EXPECTED[asset["name"]][0],
                "Asset is incomplete or has unexpected size")
    return {a["name"]: a for a in assets}


def publish(directory, api):
    verify_local(directory)  # No network or write happens before exact byte checks.
    path = ROOT + "/releases/" + str(RELEASE_ID)
    release = api.get(path)
    assets = verify_release(release)
    commit = api.get(ROOT + "/commits/" + quote(release["target_commitish"], safe=""))
    require(commit.get("sha") == SOURCE, "Draft target no longer matches the tested source")
    try:
        tag = api.get(ROOT + "/git/ref/tags/" + TAG)["object"]
    except ApiError as error:
        if error.status != 404:
            raise
    else:
        for _ in range(5):
            if tag.get("type") == "commit":
                break
            require(tag.get("type") == "tag" and re.fullmatch(r"[0-9a-f]{40}", tag.get("sha", "")),
                    "Invalid existing tag")
            tag = api.get(ROOT + "/git/tags/" + tag["sha"])["object"]
        require(tag.get("type") == "commit" and tag.get("sha") == SOURCE,
                "Existing tag does not match the tested source; tag was not moved")
    # A published release must already have exactly the two correct assets.
    if not release.get("draft"):
        require(set(assets) == set(EXPECTED), "Published release is incomplete; refusing mutation")
    for name in EXPECTED:
        if name in assets:
            verify_bytes(name, api.asset_bytes(assets[name]["id"]))
    for name in EXPECTED:
        if name not in assets:
            api.upload(Path(directory) / name)
            assets = verify_release(api.get(path))
            require(name in assets, "Upload result not confirmed; draft preserved")
            verify_bytes(name, api.asset_bytes(assets[name]["id"]))
    # Re-read/download both before publishing. Never overwrite or delete an existing asset.
    assets = verify_release(api.get(path))
    require(set(assets) == set(EXPECTED), "Two verified assets are required before publication")
    for name in EXPECTED:
        verify_bytes(name, api.asset_bytes(assets[name]["id"]))
    if release.get("draft"):
        api.publish()
    final = api.get(path)
    require(final.get("draft") is False and set(verify_release(final)) == set(EXPECTED),
            "Publication outcome not confirmed; inspect the release before retrying")
    print("Confirmed publication metadata and exact asset bytes for " + TAG)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    verify_local(args.directory)
    if args.verify_only:
        print("Exact validated APK and manifest verified; no GitHub request made")
        return
    require(os.environ.get("GITHUB_ACTIONS") == "true"
            and os.environ.get("GITHUB_REPOSITORY") == REPO
            and os.environ.get("GITHUB_REF") == "refs/heads/main"
            and os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch",
            "Publication is restricted to the approved manual Actions job on main")
    publish(args.directory, GitHub())


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else type(error).__name__, file=sys.stderr)
        sys.exit(1)
