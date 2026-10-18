from app.database import normalize_database_url


def test_normalize_neon_style_postgresql_url_to_psycopg3():
    assert normalize_database_url(
        "postgresql://demo_user:p%40ss@ep-example.neon.tech/demo?sslmode=require"
    ) == (
        "postgresql+psycopg://demo_user:p%40ss@ep-example.neon.tech/demo"
        "?sslmode=require"
    )


def test_normalize_legacy_postgres_alias_to_psycopg3():
    assert normalize_database_url("postgres://demo:dummy@localhost/sample") == (
        "postgresql+psycopg://demo:dummy@localhost/sample"
    )


def test_replace_explicit_psycopg2_driver_with_psycopg3():
    assert normalize_database_url(
        "postgresql+psycopg2://demo:dummy@localhost/sample"
    ) == "postgresql+psycopg://demo:dummy@localhost/sample"


def test_preserve_explicit_psycopg3_and_sqlite_urls():
    psycopg3_url = "postgresql+psycopg://demo:dummy@localhost/sample"
    sqlite_url = "sqlite:///./freshness.db"

    assert normalize_database_url(psycopg3_url) == psycopg3_url
    assert normalize_database_url(sqlite_url) == sqlite_url
