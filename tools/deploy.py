#!/usr/bin/env python3
"""DB·첨부파일 이전 및 백업 후 배포. 호스트 Python 3.9+, Docker Compose v2.17+."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile
import tempfile
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parents[1]
# EC2 .env의 COMPOSE_FILE도 일반 docker compose와 동일하게 적용합니다.
COMPOSE = ["docker", "compose", "--project-directory", str(ROOT), "--env-file", str(ROOT / ".env")]
DB_SHELL = 'exec "$@" -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
COUNTS_SQL = """
SELECT COALESCE(jsonb_object_agg(tablename,
  (xpath('/row/n/text()', query_to_xml(
    format('SELECT count(*) AS n FROM public.%I', tablename), false, true, '')
  ))[1]::text::bigint), '{}'::jsonb)
FROM pg_tables WHERE schemaname = 'public';
"""


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def compose(*args, **kwargs):
    return run(COMPOSE + list(args), **kwargs)


def output(args):
    return run(args, stdout=subprocess.PIPE, text=True).stdout.strip()


def config():
    compose("config", "--quiet")
    # 값은 메모리에서만 읽습니다. 비밀번호·키가 있는 전체 설정은 출력하지 않습니다.
    return json.loads(output(COMPOSE + ["config", "--format", "json"]))


def storage(cfg, key):
    service, target = {"postgres_data": ("db", "/var/lib/postgresql/data"),
                       "media_data": ("backend", "/app/media")}[key]
    mount = next(m for m in cfg["services"][service]["volumes"] if m["target"] == target)
    kind = mount["type"]
    source = mount["source"] if kind == "bind" else cfg["volumes"][mount["source"]]["name"]
    if kind not in ("bind", "volume"):
        raise RuntimeError("DB·첨부파일은 영구 저장 경로나 볼륨에 연결해야 합니다.")
    return kind, source


def mount_matches(cfg, key, mounted):
    kind, source = storage(cfg, key)
    actual = mounted.get("Source") if kind == "bind" else mounted.get("Name")
    return mounted.get("Type") == kind and actual == source


def require_storage(cfg):
    for key in ("postgres_data", "media_data"):
        kind, name = storage(cfg, key)
        if kind == "bind":
            if not Path(name).is_dir():
                raise RuntimeError(f"데이터 경로가 없습니다: {name}. 기존 서버라면 경로와 디스크 연결을 확인하세요. "
                                   "새 설치에서만 init-storage를 실행하세요.")
            continue
        result = subprocess.run(["docker", "volume", "inspect", name],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode:
            raise RuntimeError(f"볼륨이 없습니다: {name}. 기존 서버라면 볼륨 이름을 확인하세요. "
                               "새 설치에서만 init-storage를 실행하세요.")


def check_database_mount(cfg):
    container = output(COMPOSE + ["ps", "--all", "--quiet", "db"])
    if container:
        mounts = json.loads(output(["docker", "inspect", container]))[0]["Mounts"]
        actual = next((m for m in mounts if m["Destination"] == "/var/lib/postgresql/data"), {})
        if not mount_matches(cfg, "postgres_data", actual):
            raise RuntimeError("기존 DB와 설정의 저장 위치가 다릅니다. 기존 DB 경로/볼륨을 유지하세요.")


def init_storage(cfg):
    check_database_mount(cfg)
    for key in ("postgres_data", "media_data"):
        kind, name = storage(cfg, key)
        if kind == "bind":
            Path(name).mkdir(parents=True, exist_ok=True, mode=0o700)
        else:
            run(["docker", "volume", "create", name], stdout=subprocess.DEVNULL)
    print("저장 공간 준비 완료. 기존 데이터는 유지했습니다.")


def running_services():
    return output(COMPOSE + ["ps", "--status", "running", "--services"]).splitlines()


def db_command(*args, **kwargs):
    return compose("exec", "-T", "db", "sh", "-ec", DB_SHELL, "sh", *args, **kwargs)


def row_counts():
    result = db_command("psql", "-XAt", "-v", "ON_ERROR_STOP=1", "-c", COUNTS_SQL,
                        stdout=subprocess.PIPE, text=True)
    return json.loads(result.stdout)


def media_command(cfg, readonly, *args, **kwargs):
    kind, source = storage(cfg, "media_data")
    mount = f'type={kind},src={source},dst=/media'
    if readonly:
        mount += ",readonly"
    return run(["docker", "run", "--rm", "-i", "--network", "none", "--mount", mount,
                "--entrypoint", args[0], cfg["services"]["db"]["image"], *args[1:]], **kwargs)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def check_media_archive(path):
    # 복원할 파일이 볼륨 밖으로 나가거나 링크를 통해 다른 경로에 쓰이지 않게 합니다.
    with tarfile.open(path, "r:gz") as archive:
        for item in archive:
            name = PurePosixPath(item.name)
            if name.is_absolute() or ".." in name.parts or not (item.isfile() or item.isdir()):
                raise RuntimeError("첨부파일 백업에 허용되지 않는 경로/파일 형식이 있습니다.")


def backup(cfg, destination, resume=True):
    require_storage(cfg)
    check_database_mount(cfg)
    if "db" not in running_services():
        raise RuntimeError("백업할 DB가 실행 중이어야 합니다.")
    destination = destination.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    directory = Path(tempfile.mkdtemp(prefix=f"{stamp}-", suffix=".partial", dir=destination))
    was_running = "backend" in running_services()
    success = False
    try:
        # DB와 첨부파일을 같은 시점으로 보관하도록 웹 쓰기를 잠시 멈춥니다.
        if was_running:
            compose("stop", "backend")
        counts = row_counts()
        with (directory / "database.dump").open("wb") as stream:
            db_command("pg_dump", "--format=custom", "--no-owner", "--no-acl", stdout=stream)
        with (directory / "database.dump").open("rb") as stream:
            db_command("pg_restore", "--list", stdin=stream, stdout=subprocess.DEVNULL)

        # 이전 버전의 컨테이너 내부 /app/media도 최초 전환 시 보존합니다.
        container = output(COMPOSE + ["ps", "--all", "--quiet", "backend"])
        with tempfile.TemporaryDirectory(dir=directory) as temporary:
            media = Path(temporary) / "media"
            media.mkdir()
            if container:
                paths = json.loads(output(["docker", "inspect", container]))[0]
                mounts = paths["Mounts"]
                mounted = next((m for m in mounts if m["Destination"] == "/app/media"), None)
                if mounted and not mount_matches(cfg, "media_data", mounted):
                    raise RuntimeError("실행 컨테이너와 설정의 첨부파일 저장 위치가 다릅니다.")
                # docker cp는 중지된 컨테이너에서도 동작합니다.
                copied = subprocess.run(["docker", "cp", f"{container}:/app/media/.", str(media)],
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
                if copied.returncode and (mounted or "Could not find the file /app/media/." not in copied.stderr):
                    raise RuntimeError("첨부파일을 복사하지 못했습니다. 기존 컨테이너를 유지하세요.")
                with tarfile.open(directory / "media.tar.gz", "w:gz") as archive:
                    archive.add(media, arcname=".")
            else:
                with (directory / "media.tar.gz").open("wb") as stream:
                    media_command(cfg, True, "tar", "-C", "/media", "-czf", "-", ".", stdout=stream)
        check_media_archive(directory / "media.tar.gz")
        manifest = {"format": 1, "created_at": stamp, "table_rows": counts,
                    "sha256": {name: sha256(directory / name)
                               for name in ("database.dump", "media.tar.gz")}}
        (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        final = directory.with_suffix("")
        directory.rename(final)
        success = True
        print(f"백업 완료: {final}", flush=True)
        return final
    finally:
        # 실패한 백업은 .partial로 남기고 배포하지 않습니다.
        if was_running and (resume or not success):
            compose("start", "backend")


def restore(cfg, directory):
    require_storage(cfg)
    check_database_mount(cfg)
    directory = directory.expanduser().resolve()
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest.get("format") != 1:
        raise RuntimeError("지원하지 않는 백업 형식입니다.")
    for name in ("database.dump", "media.tar.gz"):
        if sha256(directory / name) != manifest["sha256"][name]:
            raise RuntimeError(f"백업 파일 검증 실패: {name}")
    check_media_archive(directory / "media.tar.gz")
    if "backend" in running_services():
        raise RuntimeError("복원 전에 backend를 중지하세요. 새 EC2에서 db만 실행한 상태로 복원합니다.")
    # 빈 신규 DB만 허용합니다. 초기 init SQL의 빈 테이블은 허용합니다.
    counts = row_counts()
    if any(counts.values()):
        raise RuntimeError("대상 DB에 데이터가 있어 복원을 중단했습니다. 기존 DB에는 덮어쓰지 않습니다.")
    contents = media_command(cfg, True, "find", "/media", "-mindepth", "1", "-print", "-quit",
                              stdout=subprocess.PIPE, text=True).stdout
    if contents:
        raise RuntimeError("대상 첨부파일 저장 공간이 비어 있지 않아 복원을 중단했습니다.")
    # init SQL과 과거 Django 버전의 FK 이름이 달라도 복원할 수 있도록,
    # 검증된 빈 public 스키마의 교체와 전체 복원을 한 트랜잭션으로 묶습니다.
    # SQL은 비공개 임시 파일로만 생성하며 실패 시 초기 구조까지 롤백합니다.
    with tempfile.TemporaryFile() as sql:
        sql.write(b"SET LOCAL client_min_messages = warning;\n"
                  b"DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n")
        sql.flush()
        with (directory / "database.dump").open("rb") as stream:
            compose("exec", "-T", "db", "pg_restore", "--clean", "--if-exists",
                    "--no-owner", "--no-acl", "--file=-", stdin=stream, stdout=sql)
        sql.seek(0)
        db_command("psql", "-Xq", "--single-transaction", "--set=ON_ERROR_STOP=1",
                   stdin=sql, stdout=subprocess.DEVNULL)
    if row_counts() != manifest["table_rows"]:
        raise RuntimeError("복원 후 테이블별 행 수가 일치하지 않습니다. 서비스를 시작하지 마세요.")
    with (directory / "media.tar.gz").open("rb") as stream:
        media_command(cfg, False, "tar", "--no-same-owner", "-C", "/media", "-xzf", "-", stdin=stream)
    print("복원 완료: 모든 테이블의 행 수와 백업 파일 체크섬이 일치합니다.")


def deploy(cfg, destination):
    require_storage(cfg)
    if "db" not in running_services():
        raise RuntimeError("배포 전 기존 DB를 실행하세요. 최초 설치는 문서의 복원/시작 절차를 따르세요.")
    # 빌드 실패가 서비스 중단으로 이어지지 않도록 먼저 빌드합니다.
    compose("build")
    was_running = "backend" in running_services()
    directory = backup(cfg, destination, resume=False)
    try:
        # 최초 변경 시 컨테이너 내부의 첨부파일을 새 영구 볼륨으로 이전합니다.
        container = output(COMPOSE + ["ps", "--all", "--quiet", "backend"])
        if container:
            mounts = json.loads(output(["docker", "inspect", container]))[0]["Mounts"]
            if not any(m["Destination"] == "/app/media" for m in mounts):
                contents = media_command(cfg, True, "find", "/media", "-mindepth", "1", "-print", "-quit",
                                          stdout=subprocess.PIPE, text=True).stdout
                if contents:
                    raise RuntimeError("최초 첨부파일 이전 대상 저장 공간이 비어 있지 않습니다.")
                with (directory / "media.tar.gz").open("rb") as stream:
                    media_command(cfg, False, "tar", "--no-same-owner", "-C", "/media", "-xzf", "-", stdin=stream)
    except BaseException:
        if was_running:
            compose("start", "backend")
        raise
    compose("down")  # 외부 DB·첨부 볼륨을 유지합니다. -v를 사용하지 않습니다.
    compose("up", "--build", "-d", "--wait", "--wait-timeout", "180")
    compose("ps")
    print("배포 완료. 기존 DB·첨부파일 저장 위치를 그대로 사용하며 Django 마이그레이션을 적용했습니다.")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-storage", help="최초 설치용 데이터 경로/볼륨 준비 (기존 데이터 보존)")
    for name in ("backup", "deploy"):
        command = commands.add_parser(name)
        command.add_argument("--backup-dir", type=Path, default=ROOT / ".backups")
    command = commands.add_parser("restore", help="빈 DB·첨부파일 저장 공간에만 복원")
    command.add_argument("directory", type=Path)
    args = parser.parse_args()
    cfg = config()
    if args.command == "init-storage":
        init_storage(cfg)
    elif args.command == "backup":
        backup(cfg, args.backup_dir)
    elif args.command == "restore":
        restore(cfg, args.directory)
    else:
        deploy(cfg, args.backup_dir)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, tarfile.TarError) as error:
        print(f"중단: {error}", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError:
        # 전체 명령/Compose 설정을 출력하면 비밀값이 노출될 수 있어 요약만 표시합니다.
        print("Docker 작업에 실패해 중단했습니다. 오류와 컨테이너 상태를 확인하세요.", file=sys.stderr)
        sys.exit(1)
