from flask import Flask, send_from_directory, send_file
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

if __name__ == '__main__':

    for f in necessary_files:
        if not os.path.exists(f'{FOLDER}/gtfs_subway/{f}'):
            extract_zip()
            break

    port = 3000
    app.run(host='0.0.0.0', port=port, debug=True)