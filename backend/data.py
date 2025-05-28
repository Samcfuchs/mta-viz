import sqlite3
import csv
import json

### data.py should import the static GTFS files, and process
### them into a database that is appropriate for the frontend
### to query **ONCE** when the page loads.
REALTIME_API_URLS = {
    'ACE': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
    'IRT': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
    'L': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
    'BDFM': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
    'G': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
    'JZ': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
    'NQRW': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
    'SIR': "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"
}

create_realtime_table_query = """
    create table if not exists updates (
        id text primary key,
        prev_stop_id text,
        next_stop_id text,
        prev_stop_time text,
        next_stop_time text,
    );
"""

STOPS_FILE = "data/stops.txt"
DB_NAME = "data/gtfs_rt.db"

def create_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(create_realtime_table_query)
    conn.commit()
    conn.close()

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
def query(q):
    cursor.execute(q)
    conn.commit()

def csv_to_json(fname, out):
    with open(fname, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        routes = [r for r in reader]
    
    with open(out, 'w') as f:
        json.dump(routes, f)


if __name__ == "__main__":

    


    conn.close()

