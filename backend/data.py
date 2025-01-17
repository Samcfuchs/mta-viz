import sqlite3
import csv
import json

### data.py should import the static GTFS files, and process
### them into a database that is appropriate for the frontend
### to query **ONCE** when the page loads.

DB_NAME = "data/gtfs.db"
create_table_query = """
create table if not exists stops (
    stop_id text primary key,
    stop_name text not null,
    stop_lat real not null,
    stop_lon real not null,
    zone_id text
);
"""

STOPS_FILE = "data/stops.txt"

def create_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(create_table_query)
    conn.commit()
    conn.close()

def insert_stops():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    with open(STOPS_FILE, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        stops = [
            (row['stop_id'], row['stop_name'], row['stop_lat'], row['stop_lon'], row.get('zone_id'))
            for row in reader
        ]

    cursor.executemany("insert or ignore into stops values (?, ?, ?, ?, ?)", stops)
    conn.commit()
    conn.close()

def csv_to_json(fname, out):
    with open(fname, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        routes = [r for r in reader]
    
    with open(out, 'w') as f:
        json.dump(routes, f)


if __name__ == "__main__":
    create_db()
    insert_stops()
    print("Imported stops data")

    csv_to_json('data/routes.txt', 'data/routes.json')