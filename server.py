from flask import Flask, send_from_directory, send_file, jsonify
import zipfile
import os
from flask_cors import CORS, cross_origin

FOLDER = 'data'
necessary_files = ['routes.txt','stops.txt','trips.txt','stop_times.txt','shapes.txt']


def extract_zip():
    with zipfile.ZipFile('data/gtfs_subway.zip', 'r') as zipdata:
        zipdata.extractall('data/gtfs_subway')


app = Flask(__name__)
cors = CORS(app)
#app.config['CORS_HEADERS'] = 'Content-Type'


@app.route('/data/mta/<path:f>')
#@cross_origin
def fetch(f):
    return send_from_directory(FOLDER,'gtfs_subway/' + f)

from google.transit import gtfs_realtime_pb2
import requests

@app.route('/data/mta/realtime/<path:line>')
def get_line(line):
    updates = []
    url = REALTIME_API_URLS[line]
    feed = gtfs_realtime_pb2.FeedMessage()
    response = requests.get(url)
    feed.ParseFromString(response.content)
    for entity in feed.entity:
        if entity.HasField('trip_update'):
            updates.append(str(entity.trip_update))
    
    return 200, jsonify(updates)

@app.route('/data/mta/realtime')
def get_all_realtime():
    for k,v in REALTIME_API_URLS.items():
        get_line(k)
    


if __name__ == '__main__':

    for f in necessary_files:
        if not os.path.exists(f'{FOLDER}/gtfs_subway/{f}'):
            extract_zip()
            break

    port = 3000
    app.run(host='0.0.0.0', port=port, debug=True)
