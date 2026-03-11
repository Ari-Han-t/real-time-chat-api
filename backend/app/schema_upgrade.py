from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_schema_upgrades(engine: Engine) -> None:
    inspector = inspect(engine)
    if "messages" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("messages")}
    dialect = engine.dialect.name

    statements: list[str] = []
    if "updated_at" not in existing_columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE messages ADD COLUMN updated_at TIMESTAMPTZ")
        else:
            statements.append("ALTER TABLE messages ADD COLUMN updated_at DATETIME")
    if "is_edited" not in existing_columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT FALSE")
        else:
            statements.append("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT 0")
    if "is_deleted" not in existing_columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE")
        else:
            statements.append("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))

