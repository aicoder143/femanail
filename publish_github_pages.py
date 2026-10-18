#!/usr/bin/env python3
"""Publish this static site to a GitHub repository's gh-pages branch.

Usage: python3 publish_github_pages.py https://github.com/OWNER/REPO
Requires Git and an existing GitHub sign-in, or a GITHUB_TOKEN environment variable.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

API_VERSION = "2022-11-28"
BRANCH = "gh-pages"
BUILD_WAIT_SECONDS = 180


class PublishError(Exception):
    pass


def repository_from_url(value: str) -> tuple[str, str]:
    value = value.strip()
    if value.startswith("git@github.com:"):
        path = value.removeprefix("git@github.com:")
    else:
        parsed = urlparse(value)
        if parsed.scheme != "https" or parsed.hostname != "github.com" or parsed.port or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise PublishError("Provide a repository link like https://github.com/OWNER/REPO")
        path = parsed.path.lstrip("/")
    path = path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    pieces = path.split("/")
    if len(pieces) != 2 or not all(re.fullmatch(r"[A-Za-z0-9_.-]+", piece) for piece in pieces):
        raise PublishError("The link must point to a GitHub repository, not a file or branch inside it.")
    return pieces[0], pieces[1]


def site_files(site_dir: Path) -> list[tuple[Path, Path]]:
    if not (site_dir / "index.html").is_file():
        raise PublishError(f"No index.html found in {site_dir}")
    files = []
    for source in site_dir.rglob("*"):
        relative = source.relative_to(site_dir)
        if any(part.startswith(".") and part != ".nojekyll" for part in relative.parts):
            continue
        if "__pycache__" in relative.parts or source.name == ".DS_Store":
            continue
        if source.is_symlink():
            raise PublishError(f"The site contains a symlink, which will not be published: {relative}")
        if source.is_file():
            files.append((source, relative))
    if not any(relative == Path("index.html") for _, relative in files):
        raise PublishError("The site must contain index.html")
    return sorted(files, key=lambda item: str(item[1]))


def github_token() -> str:
    candidates = [os.environ.get("GITHUB_TOKEN"), os.environ.get("GH_TOKEN")]
    if shutil.which("gh"):
        result = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=False)
        if result.returncode == 0 and result.stdout.strip():
            candidates.append(result.stdout.strip())
    if shutil.which("git"):
        result = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n", capture_output=True, text=True, check=False)
        if result.returncode == 0:
            credentials = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
            candidates.append(credentials.get("password"))
    for candidate in candidates:
        if candidate:
            token = candidate.strip()
            try:
                status, _ = api_request("GET", "/user", token)
                if status == 200:
                    return token
            except PublishError:
                pass
    if sys.stdin.isatty():
        token = getpass.getpass("GitHub token (hidden): ").strip()
        if token:
            status, _ = api_request("GET", "/user", token)
            if status == 200:
                return token
    raise PublishError("No valid GitHub sign-in found. Run `gh auth login`, or set GITHUB_TOKEN, then try again.")


def api_request(method: str, path: str, token: str, data: dict | None = None) -> tuple[int, dict]:
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    request = Request(
        f"https://api.github.com{path}",
        data=payload,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "Femanail-Pages-Publisher",
            **({"Content-Type": "application/json"} if payload is not None else {}),
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except HTTPError as error:
        body = error.read()
        try:
            details = json.loads(body) if body else {}
        except json.JSONDecodeError:
            details = {}
        message = details.get("message") or error.reason
        if error.code == 404:
            return 404, details
        raise PublishError(f"GitHub API {method} {path} failed ({error.code}): {message}") from None
    except URLError as error:
        raise PublishError(f"Cannot reach GitHub: {error.reason}") from None


def git(args: list[str], cwd: Path | None, env: dict, token: str, allow_failure: bool = False) -> subprocess.CompletedProcess:
    result = subprocess.run(["git", *args], cwd=cwd, env=env, text=True, capture_output=True, check=False)
    if result.returncode and not allow_failure:
        detail = (result.stderr or result.stdout or "Git failed").strip().replace(token, "[redacted]")
        raise PublishError(detail)
    return result


def prepare_checkout(checkout: Path, site_dir: Path, files: list[tuple[Path, Path]], owner: str, repo: str, token: str, env: dict) -> str:
    remote = f"https://x-access-token@github.com/{owner}/{repo}.git"
    git(["clone", "--quiet", remote, str(checkout)], None, env, token)
    branch_exists = git(["show-ref", "--verify", "--quiet", f"refs/remotes/origin/{BRANCH}"], checkout, env, token, allow_failure=True).returncode == 0
    if branch_exists:
        git(["switch", "--quiet", "-c", BRANCH, "--track", f"origin/{BRANCH}"], checkout, env, token)
    else:
        git(["switch", "--quiet", "--orphan", BRANCH], checkout, env, token)
    existing_cname = (checkout / "CNAME").read_bytes() if (checkout / "CNAME").is_file() and not (site_dir / "CNAME").exists() else None
    for path in checkout.iterdir():
        if path.name == ".git":
            continue
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
        else:
            path.unlink()
    for source, relative in files:
        destination = checkout / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    if existing_cname is not None:
        (checkout / "CNAME").write_bytes(existing_cname)
    if not (checkout / ".nojekyll").exists():
        (checkout / ".nojekyll").touch()
    git(["add", "--all"], checkout, env, token)
    changed = git(["diff", "--cached", "--quiet"], checkout, env, token, allow_failure=True).returncode != 0
    if changed:
        author = git(["config", "user.name"], checkout, env, token, allow_failure=True).stdout.strip()
        email = git(["config", "user.email"], checkout, env, token, allow_failure=True).stdout.strip()
        if not author or not email:
            _, user = api_request("GET", "/user", token)
            login, user_id = user.get("login"), user.get("id")
            if not login or not user_id:
                raise PublishError("Set Git user.name and user.email before publishing.")
            author = author or login
            email = email or f"{user_id}+{login}@users.noreply.github.com"
        git(["-c", f"user.name={author}", "-c", f"user.email={email}", "commit", "--quiet", "-m", "Publish Femanail Prompt Studio"], checkout, env, token)
        git(["push", "--quiet", "origin", BRANCH], checkout, env, token)
    else:
        print("Site files already match the gh-pages branch.")
    commit = git(["rev-parse", "HEAD"], checkout, env, token).stdout.strip()
    print(f"Published source commit: {commit[:12]}")
    return commit


def configure_pages(owner: str, repo: str, token: str) -> str:
    path = f"/repos/{owner}/{repo}/pages"
    status, pages = api_request("GET", path, token)
    desired = {"branch": BRANCH, "path": "/"}
    if status == 404:
        print("Enabling GitHub Pages from gh-pages / ...")
        try:
            api_request("POST", path, token, {"build_type": "legacy", "source": desired})
        except PublishError as error:
            if "(409)" not in str(error):
                raise
        for _ in range(6):
            status, pages = api_request("GET", path, token)
            if status == 200:
                break
            time.sleep(2)
        if status != 200:
            raise PublishError("GitHub reports Pages is enabled, but its settings are not readable yet. Run the script again shortly.")
    if pages.get("source") != desired or pages.get("build_type") == "workflow":
        print("Setting GitHub Pages source to gh-pages / ...")
        api_request("PUT", path, token, {"build_type": "legacy", "source": desired})
    else:
        print("GitHub Pages already uses gh-pages /.")
    _, pages = api_request("GET", path, token)
    return pages.get("html_url") or (f"https://{owner}.github.io/" if repo.lower() == f"{owner.lower()}.github.io" else f"https://{owner}.github.io/{repo}/")


def wait_for_build(owner: str, repo: str, commit: str, token: str, url: str) -> None:
    deadline = time.monotonic() + BUILD_WAIT_SECONDS
    path = f"/repos/{owner}/{repo}/pages/builds/latest"
    while time.monotonic() < deadline:
        status, build = api_request("GET", path, token)
        if status != 404 and build.get("commit") == commit:
            state = build.get("status")
            if state == "built":
                print(f"GitHub Pages is live: {url}")
                return
            if state == "errored":
                raise PublishError(f"GitHub Pages build failed: {build.get('error', {}).get('message') or 'check repository Pages settings'}")
        time.sleep(5)
    print(f"Pages is configured and the build is still pending. Check: {url}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish Femanail Prompt Studio to a GitHub Pages repository.")
    parser.add_argument("repository", help="GitHub repository URL, such as https://github.com/OWNER/REPO")
    parser.add_argument("--site-dir", type=Path, default=Path(__file__).resolve().parent / "dist", help="Directory containing the static website")
    parser.add_argument("--dry-run", action="store_true", help="Validate inputs without signing in or changing GitHub")
    args = parser.parse_args()
    owner, repo = repository_from_url(args.repository)
    site_dir = args.site_dir.resolve()
    files = site_files(site_dir)
    print(f"Site: {site_dir}")
    print(f"Repository: https://github.com/{owner}/{repo}")
    print(f"Static files: {len(files)}; publishing branch: {BRANCH}")
    if args.dry_run:
        print("Dry run complete. No GitHub changes were made.")
        return 0
    if not shutil.which("git"):
        raise PublishError("Git is required. Install Git and run this script again.")
    token = github_token()
    repository_status, repository = api_request("GET", f"/repos/{owner}/{repo}", token)
    if repository_status == 404:
        raise PublishError("The repository was not found or this account cannot access it.")
    if repository.get("archived"):
        raise PublishError("The repository is archived and cannot accept a publish.")
    if not repository.get("permissions", {}).get("push", False):
        raise PublishError("Your GitHub account needs permission to push to this repository.")
    with tempfile.TemporaryDirectory(prefix="femanail-pages-") as temp:
        temporary = Path(temp)
        askpass = temporary / "askpass.sh"
        askpass.write_text('#!/bin/sh\ncase "$1" in *Username*) printf "%s\\n" "x-access-token";; *) printf "%s\\n" "$GITHUB_TOKEN";; esac\n')
        askpass.chmod(0o700)
        env = os.environ.copy()
        env.update({"GITHUB_TOKEN": token, "GIT_ASKPASS": str(askpass), "GIT_TERMINAL_PROMPT": "0"})
        commit = prepare_checkout(temporary / "repository", site_dir, files, owner, repo, token, env)
    url = configure_pages(owner, repo, token)
    print(f"Pages URL: {url}")
    wait_for_build(owner, repo, commit, token, url)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PublishError as error:
        print(f"Publish stopped: {error}", file=sys.stderr)
        raise SystemExit(1)
