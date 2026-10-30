"""데이터를 덮어쓰거나 백업 실패 후 배포하지 않도록 하는 보호 동작 검증."""

import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

from tools import deploy


CFG = {"volumes": {"postgres_data": {"name": "test-db"},
                   "media_data": {"name": "test-media"}},
       "services": {"db": {"volumes": [{"type": "volume", "source": "postgres_data",
                                         "target": "/var/lib/postgresql/data"}]},
                    "backend": {"volumes": [{"type": "volume", "source": "media_data",
                                              "target": "/app/media"}]}}}


class DeploymentSafetyTests(unittest.TestCase):
    def bind_config(self, directory):
        return {"services": {"db": {"volumes": [
                    {"type": "bind", "source": str(directory / "postgres"),
                     "target": "/var/lib/postgresql/data"}]},
                "backend": {"volumes": [
                    {"type": "bind", "source": str(directory / "media"), "target": "/app/media"}]}}}

    def test_ec2_initialization_preserves_existing_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            cfg = self.bind_config(directory)
            (directory / "postgres").mkdir()
            sentinel = directory / "postgres" / "existing-data"
            sentinel.write_bytes(b"keep existing database")
            with patch.object(deploy, "check_database_mount"), patch.object(deploy, "run") as run:
                deploy.init_storage(cfg)
                run.assert_not_called()
            deploy.require_storage(cfg)
            self.assertEqual(sentinel.read_bytes(), b"keep existing database")
            self.assertTrue((directory / "media").is_dir())

    def test_missing_ec2_path_is_not_automatically_created_on_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            with self.assertRaisesRegex(RuntimeError, "데이터 경로가 없습니다"):
                deploy.require_storage(self.bind_config(directory))
            self.assertFalse((directory / "postgres").exists())

    def test_changed_database_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            cfg = self.bind_config(Path(temporary))
            mounted = [{"Mounts": [{"Type": "bind", "Source": "/existing/database",
                                     "Destination": "/var/lib/postgresql/data"}]}]
            with patch.object(deploy, "output", side_effect=["container-id", json.dumps(mounted)]):
                with self.assertRaisesRegex(RuntimeError, "저장 위치가 다릅니다"):
                    deploy.check_database_mount(cfg)

    def create_backup(self, directory):
        (directory / "database.dump").write_bytes(b"database archive")
        with tarfile.open(directory / "media.tar.gz", "w:gz"):
            pass
        manifest = {"format": 1, "table_rows": {"auth_user": 1},
                    "sha256": {name: deploy.sha256(directory / name)
                               for name in ("database.dump", "media.tar.gz")}}
        (directory / "manifest.json").write_text(json.dumps(manifest))

    def test_restore_refuses_populated_database_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.create_backup(directory)
            with patch.object(deploy, "require_storage"), \
                 patch.object(deploy, "check_database_mount"), \
                 patch.object(deploy, "running_services", return_value=["db"]), \
                 patch.object(deploy, "row_counts", return_value={"auth_user": 1}), \
                 patch.object(deploy, "db_command") as db, \
                 patch.object(deploy, "media_command") as media:
                with self.assertRaisesRegex(RuntimeError, "대상 DB에 데이터"):
                    deploy.restore(CFG, directory)
                db.assert_not_called()
                media.assert_not_called()

    def test_restore_refuses_corrupt_backup_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.create_backup(directory)
            (directory / "database.dump").write_bytes(b"damaged")
            with patch.object(deploy, "require_storage"), \
                 patch.object(deploy, "check_database_mount"), \
                 patch.object(deploy, "db_command") as db:
                with self.assertRaisesRegex(RuntimeError, "검증 실패"):
                    deploy.restore(CFG, directory)
                db.assert_not_called()

    def test_restore_refuses_running_backend(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.create_backup(directory)
            with patch.object(deploy, "require_storage"), \
                 patch.object(deploy, "check_database_mount"), \
                 patch.object(deploy, "running_services", return_value=["db", "backend"]), \
                 patch.object(deploy, "db_command") as db:
                with self.assertRaisesRegex(RuntimeError, "backend를 중지"):
                    deploy.restore(CFG, directory)
                db.assert_not_called()

    def test_rejects_media_paths_and_links_outside_volume(self):
        for name, kind in [("../escaped", tarfile.REGTYPE),
                           ("/absolute", tarfile.REGTYPE),
                           ("link", tarfile.SYMTYPE), ("device", tarfile.CHRTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                archive_path = Path(temporary) / "media.tar.gz"
                with tarfile.open(archive_path, "w:gz") as archive:
                    item = tarfile.TarInfo(name)
                    item.type = kind
                    archive.addfile(item, io.BytesIO())
                with self.assertRaises(RuntimeError):
                    deploy.check_media_archive(archive_path)

    def test_deploy_does_not_take_down_service_when_backup_fails(self):
        with patch.object(deploy, "require_storage"), \
             patch.object(deploy, "running_services", return_value=["db", "backend"]), \
             patch.object(deploy, "backup", side_effect=RuntimeError("backup failed")), \
             patch.object(deploy, "compose") as compose:
            with self.assertRaisesRegex(RuntimeError, "backup failed"):
                deploy.deploy(CFG, Path("/unused"))
            compose.assert_called_once_with("build")

    def test_backup_failure_resumes_existing_backend(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(deploy, "require_storage"), \
                 patch.object(deploy, "check_database_mount"), \
                 patch.object(deploy, "running_services", return_value=["db", "backend"]), \
                 patch.object(deploy, "row_counts", side_effect=RuntimeError("dump failed")), \
                 patch.object(deploy, "compose") as compose:
                with self.assertRaisesRegex(RuntimeError, "dump failed"):
                    deploy.backup(CFG, Path(temporary), resume=False)
                self.assertEqual(compose.call_args_list[0].args, ("stop", "backend"))
                self.assertEqual(compose.call_args_list[-1].args, ("start", "backend"))


if __name__ == "__main__":
    unittest.main()
