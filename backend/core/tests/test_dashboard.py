# 실행법: cd backend && pytest --ds=config.settings core/tests
# 대시보드 슬라이스 테스트: 패널 CRUD, 사용자별 격리, 수식·옵션·값 검증, 순서 변경.
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.dashboard_expr import FORMULA_VARS, FUNCTION_VARS, ExprError, validate_expression

PASSWORD = "pass12345!"
PANELS_URL = "/api/dashboard/panels/"
REORDER_URL = "/api/dashboard/panels/reorder/"


def _detail_url(pk):
    return f"/api/dashboard/panels/{pk}/"


@pytest.fixture
def alice_client(db):
    get_user_model().objects.create_user(username="alice", password=PASSWORD)
    client = APIClient()
    assert client.login(username="alice", password=PASSWORD)
    return client


@pytest.fixture
def bob_client(db):
    get_user_model().objects.create_user(username="bob", password=PASSWORD)
    client = APIClient()
    assert client.login(username="bob", password=PASSWORD)
    return client


def _create(client, **extra):
    body = {"title": "CPU", "viz_type": "timeseries", "values": [{"label": "1", "value": 10}], **extra}
    return client.post(PANELS_URL, body, format="json")


# --- 수식 문법 ---


@pytest.mark.parametrize(
    "src",
    ["x * 2 + 1", "-x^2", "round(x / max * 100, 1)", "clamp(x, 0, 100)", "min(x, prev) + avg", "(x - min) / (max - min)", "1.5e3 + .5"],
)
def test_formula_valid(src):
    validate_expression(src, FORMULA_VARS)


@pytest.mark.parametrize(
    "src, message",
    [
        ("", "비어"),
        ("x +", "중간에 끝"),
        ("(x + 1", "닫는 괄호"),
        ("y * 2", "알 수 없는 이름 'y'"),
        ("foo(x)", "'foo' 함수는 지원하지 않습니다"),
        ("pow(x)", "2개 필요"),
        ("x $ 2", "'$'"),
        ("2x", "끝나야"),
        ("abs", "괄호와 함께"),
    ],
)
def test_formula_invalid(src, message):
    with pytest.raises(ExprError) as exc:
        validate_expression(src, FORMULA_VARS)
    assert message in str(exc.value)


def test_function_vars_do_not_include_x():
    validate_expression("sin(t) * 10 + pi", FUNCTION_VARS)
    with pytest.raises(ExprError):
        validate_expression("x * 2", FUNCTION_VARS)


# --- API ---


def test_requires_login(db):
    assert APIClient().get(PANELS_URL).status_code == 403


def test_create_list_and_defaults(alice_client):
    r = _create(alice_client)
    assert r.status_code == 201
    assert r.data["position"] == 0
    assert r.data["width"] == 12 and r.data["height"] == 8
    assert r.data["options"]["unit"] == "none"
    assert r.data["options"]["thresholds"] == []
    r2 = _create(alice_client, title="메모리")
    assert r2.data["position"] == 1
    lst = alice_client.get(PANELS_URL)
    assert [p["title"] for p in lst.data] == ["CPU", "메모리"]


def test_panels_are_private(alice_client, bob_client):
    pid = _create(alice_client).data["id"]
    assert bob_client.get(PANELS_URL).data == []
    assert bob_client.get(_detail_url(pid)).status_code == 404
    assert bob_client.patch(_detail_url(pid), {"title": "x"}, format="json").status_code == 404
    assert bob_client.delete(_detail_url(pid)).status_code == 404


def test_patch_viz_type_and_size(alice_client):
    pid = _create(alice_client).data["id"]
    r = alice_client.patch(_detail_url(pid), {"viz_type": "stat", "width": 6, "height": 4}, format="json")
    assert r.status_code == 200
    assert (r.data["viz_type"], r.data["width"], r.data["height"]) == ("stat", 6, 4)
    assert r.data["values"] == [{"label": "1", "value": 10}]  # 다른 값은 그대로
    bad = alice_client.patch(_detail_url(pid), {"width": 25, "height": 2}, format="json")
    assert bad.status_code == 400
    assert set(bad.data) == {"width", "height"}
    assert alice_client.patch(_detail_url(pid), {"viz_type": "pie"}, format="json").status_code == 400


def test_formula_error_message(alice_client):
    r = _create(alice_client, formula="x * y")
    assert r.status_code == 400
    assert "알 수 없는 이름 'y'" in r.data["formula"][0]


def test_values_validation(alice_client):
    assert _create(alice_client, values=[{"label": "a", "value": "10"}]).status_code == 400
    assert _create(alice_client, values=[{"label": "a", "value": True}]).status_code == 400
    assert _create(alice_client, values=[{"label": "a" * 31, "value": 1}]).status_code == 400
    assert _create(alice_client, values=[{"value": 1, "extra": 2}]).status_code == 400
    assert _create(alice_client, values=[{"value": 1}] * 201).status_code == 400
    ok = _create(alice_client, values=[{"value": 1}, {"label": " 화 ", "value": 2.5}])
    assert ok.status_code == 201
    assert ok.data["values"] == [{"label": "", "value": 1}, {"label": "화", "value": 2.5}]


def test_function_source(alice_client):
    ok = _create(alice_client, source="function", func_expr="sin(t) * 10", func_from=0, func_to=10, func_step=0.5)
    assert ok.status_code == 201
    assert _create(alice_client, source="function", func_expr="").status_code == 400
    assert _create(alice_client, source="function", func_expr="t", func_step=0).status_code == 400
    assert _create(alice_client, source="function", func_expr="t", func_from=5, func_to=1).status_code == 400
    too_many = _create(alice_client, source="function", func_expr="t", func_from=0, func_to=1000, func_step=1)
    assert too_many.status_code == 400
    assert "500" in too_many.data["func_step"][0]
    assert _create(alice_client, source="function", func_expr="x").status_code == 400


def test_options_validation(alice_client):
    opts = {"unit": "percent", "decimals": 1, "min": 0, "max": 100, "color": "green",
            "thresholds": [{"value": 90, "color": "red"}, {"value": 70, "color": "orange"}]}
    r = _create(alice_client, viz_type="gauge", options=opts)
    assert r.status_code == 201
    assert [s["value"] for s in r.data["options"]["thresholds"]] == [70, 90]  # 정렬 저장
    assert r.data["options"]["reduce"] == "last"
    for bad in (
        {"unit": "kg"},
        {"decimals": 7},
        {"min": 10, "max": 5},
        {"color": "pink"},
        {"thresholds": [{"value": 1}]},
        {"unknown": 1},
        {"reduce": "median"},
    ):
        assert _create(alice_client, options=bad).status_code == 400, bad


def test_reorder(alice_client, bob_client):
    ids = [_create(alice_client, title=f"p{i}").data["id"] for i in range(3)]
    r = alice_client.post(REORDER_URL, {"ids": [ids[2], ids[0], ids[1]]}, format="json")
    assert r.status_code == 200
    assert [p["id"] for p in r.data] == [ids[2], ids[0], ids[1]]
    assert alice_client.post(REORDER_URL, {"ids": ids[:2]}, format="json").status_code == 400
    bob_id = _create(bob_client).data["id"]
    assert alice_client.post(REORDER_URL, {"ids": ids + [bob_id]}, format="json").status_code == 400


def test_delete(alice_client):
    pid = _create(alice_client).data["id"]
    assert alice_client.delete(_detail_url(pid)).status_code == 204
    assert alice_client.get(PANELS_URL).data == []
