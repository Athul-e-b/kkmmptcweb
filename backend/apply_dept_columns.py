"""Add the department-content tables and columns without dropping existing data.

Startup already does this. Run it once by hand if the server is not restarted:

    ./venv/bin/python apply_dept_columns.py
"""
import models  # noqa: F401  (registers tables)
from database import Base, engine, ensure_sqlite_columns

Base.metadata.create_all(bind=engine)
ensure_sqlite_columns()
print("Department content tables and columns are ready.")
