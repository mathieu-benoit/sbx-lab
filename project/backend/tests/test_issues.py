"""
Tests for the issues router.

Some tests here intentionally fail (or are marked xfail) until the known bugs and
unfinished features of this demo app are fixed — they drive the lab exercises.
Run these tests with:  pytest tests/test_issues.py -v
"""

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────


def _create_issue(client, auth_headers, project_id, title="Bug: login fails", priority="high"):
    resp = client.post(
        f"/projects/{project_id}/issues/",
        json={"title": title, "description": "Steps to reproduce...", "priority": priority},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ── Basic CRUD ────────────────────────────────────────────────────────────────


def test_create_issue(client, auth_headers, project):
    issue = _create_issue(client, auth_headers, project["id"])
    assert issue["title"] == "Bug: login fails"
    assert issue["status"] == "open"
    assert issue["priority"] == "high"


def test_get_issue(client, auth_headers, project):
    created = _create_issue(client, auth_headers, project["id"])
    resp = client.get(
        f"/projects/{project['id']}/issues/{created['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_update_issue_status(client, auth_headers, project):
    issue = _create_issue(client, auth_headers, project["id"])
    resp = client.put(
        f"/projects/{project['id']}/issues/{issue['id']}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


def test_delete_issue(client, auth_headers, project):
    issue = _create_issue(client, auth_headers, project["id"])
    resp = client.delete(
        f"/projects/{project['id']}/issues/{issue['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 204


# ── Pagination bug ────────────────────────────────────────────────────────────


def test_pagination_first_page_returns_results(client, auth_headers, project):
    """
    BUG TEST: page=1 should return the first page_size items, not skip them.

    With the bug (skip = page * page_size), requesting page=1 with page_size=3
    skips items 0-2 instead of returning them.  This test will FAIL until
    the bug is fixed (skip should be (page - 1) * page_size).
    """
    titles = ["Issue A", "Issue B", "Issue C", "Issue D", "Issue E"]
    for t in titles:
        _create_issue(client, auth_headers, project["id"], title=t)

    resp = client.get(
        f"/projects/{project['id']}/issues/",
        params={"page": 1, "page_size": 3},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Page 1 should return exactly 3 items. With the bug it returns fewer
    # because it's skipping 3 items from a 5-item list.
    assert len(data["items"]) == 3, (
        f"Expected 3 items on page 1 but got {len(data['items'])}. "
        "Hint: check the skip calculation in list_issues()."
    )


def test_pagination_total_count(client, auth_headers, project):
    """Total count should match regardless of page."""
    for i in range(7):
        _create_issue(client, auth_headers, project["id"], title=f"Issue {i}")

    resp = client.get(
        f"/projects/{project['id']}/issues/",
        params={"page": 1, "page_size": 3},
        headers=auth_headers,
    )
    assert resp.json()["total"] == 7


def test_pagination_second_page(client, auth_headers, project):
    """
    BUG TEST: page 2 should return the next page_size items, distinct from page 1.

    With the bug (skip = page * page_size), page 2 of a 6-item list skips
    everything and comes back empty.
    """
    for i in range(6):
        _create_issue(client, auth_headers, project["id"], title=f"Issue {i}")

    page1 = client.get(
        f"/projects/{project['id']}/issues/",
        params={"page": 1, "page_size": 3},
        headers=auth_headers,
    ).json()["items"]

    page2 = client.get(
        f"/projects/{project['id']}/issues/",
        params={"page": 2, "page_size": 3},
        headers=auth_headers,
    ).json()["items"]

    page1_ids = {i["id"] for i in page1}
    page2_ids = {i["id"] for i in page2}
    assert len(page1) == 3 and len(page2) == 3, (
        f"Expected 3 items on each page but got {len(page1)} and {len(page2)}. "
        "Hint: check the skip calculation in list_issues()."
    )
    assert page1_ids.isdisjoint(page2_ids), (
        "Page 1 and page 2 contain overlapping items — pagination is broken."
    )


# ── Search (not yet implemented) ──────────────────────────────────────────────


@pytest.mark.xfail(
    reason="Search is not implemented yet (the endpoint returns 501) — see prompts/implement-search.txt",
    strict=False,
)
def test_search_finds_matching_issues(client, auth_headers, project):
    """
    TODO TEST: expected to fail until GET /projects/{id}/issues/search is implemented.

    Once the endpoint is implemented this test starts passing (reported as XPASS);
    remove the xfail marker above to turn it into a regular test.
    """
    _create_issue(client, auth_headers, project["id"], title="Login page crashes on Safari")
    _create_issue(client, auth_headers, project["id"], title="Dashboard layout broken")

    resp = client.get(
        f"/projects/{project['id']}/issues/search",
        params={"q": "login"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["title"] == "Login page crashes on Safari"


# ── updated_at bug ────────────────────────────────────────────────────────────


def test_updated_at_changes_on_update(client, auth_headers, project):
    """
    BUG TEST: updated_at should change when an issue is updated.

    With the bug (no onupdate= in the Column definition), the timestamp
    stays frozen at creation time. This test will FAIL until the model
    is fixed to include onupdate=utcnow.
    """
    import time

    issue = _create_issue(client, auth_headers, project["id"])
    original_updated_at = issue["updated_at"]

    time.sleep(1)  # ensure at least 1s passes

    resp = client.put(
        f"/projects/{project['id']}/issues/{issue['id']}",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    new_updated_at = resp.json()["updated_at"]

    assert new_updated_at != original_updated_at, (
        f"updated_at did not change after update: {original_updated_at} == {new_updated_at}. "
        "Hint: add onupdate=utcnow to the updated_at Column in models.py."
    )
