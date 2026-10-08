from __future__ import annotations

import getpass
import os
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent
ENV = ROOT / "backend" / ".env"


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if ENV.exists():
        for raw in ENV.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    return values


def write_env(values: dict[str, str]) -> None:
    ENV.write_text(
        "\n".join([
            f"MYSQL_USER={values['MYSQL_USER']}",
            f"MYSQL_PASSWORD={values['MYSQL_PASSWORD']}",
            f"MYSQL_HOST={values['MYSQL_HOST']}",
            f"MYSQL_PORT={values['MYSQL_PORT']}",
            f"MYSQL_DATABASE={values['MYSQL_DATABASE']}",
            "CORS_ORIGINS=http://localhost:5173",
            "SECRET_KEY=freshguard-local-development-secret",
            "TOKEN_EXPIRE_MINUTES=1440",
            "",
        ]),
        encoding="utf-8",
    )


def connect(password: str):
    return pymysql.connect(
        host="localhost",
        port=3306,
        user="root",
        password=password,
        charset="utf8mb4",
        autocommit=True,
    )


def main() -> int:
    print("\n============================================")
    print("        FRESHGUARD MYSQL SETUP")
    print("============================================\n")

    values = read_env()
    password = values.get("MYSQL_PASSWORD", "")

    # If an existing password works, do not ask again.
    if password:
        try:
            conn = connect(password)
            conn.close()
            print("MySQL connection verified using the existing backend/.env")
        except Exception:
            print("The password currently stored in backend/.env did not work.")
            password = ""

    while not password:
        password = getpass.getpass("Enter your MySQL root password: ")
        if not password:
            print("Password cannot be empty. Please try again.\n")
            continue
        try:
            conn = connect(password)
            conn.close()
        except Exception as exc:
            print(f"\nMySQL login failed: {exc}")
            print("Make sure MySQL Server is running and try again.\n")
            password = ""

    try:
        conn = connect(password)
        with conn.cursor() as cur:
            cur.execute(
                "CREATE DATABASE IF NOT EXISTS `foodfreshness` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.close()
    except Exception as exc:
        print(f"Could not create/access the foodfreshness database: {exc}")
        return 1

    write_env({
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": password,
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_DATABASE": "foodfreshness",
    })

    print("\nMySQL connection: OK")
    print("Database 'foodfreshness': OK")
    print("backend/.env: OK")
    print("\nStarting FreshGuard...\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
