import * as d3 from 'd3';

const BASE_URL = 'http://localhost:3000/data/mta';
const SHAPES_URL = BASE_URL + '/shapes.txt';
const STOPS_URL = BASE_URL + '/stops.txt';
const ROUTES_URL = BASE_URL + '/routes.txt'
const STOP_TIMES_URL = BASE_URL + '/stop_times.txt'

function parseShapesToJSON(text: string) : Record<string, [number,number][]> {
    const data_obj: Record<string, [number,number][]> = {}

    text.split('\n').slice(1, -1).forEach((row) => {
        let items: Array<string> = row.split(',')
        if (!items.length) return;

        // create slot if nexists
        if (!(items[0] in data_obj)) { data_obj[items[0]] = [] }

        //let v = coordinateLL(Number(items[2]), Number(items[3]))
        let ll : [number, number] = [ Number(items[2]), Number(items[3]) ];
        data_obj[items[0]][Number(items[1])] = ll;
    })

    return data_obj;
}


export type StaticRoute = {
    shortTripID: string,
    longTripID: string,
    stops : {stopID: string, stopTime : number}[],
    routeID: string
}

function parseStopTimesToJSON(text: string) : any {
    const data_obj : Record<string, StaticRoute> = {};
    const regex = new RegExp(".*_(.+)")

    text.split('\n').slice(1,-1).forEach(row => {
        let items : string[] = row.split(',')
        if (!items.length) return;

        let trip_id = items[0];
        let stop_id = items[1];
        let time = +items[2];
        let seq = Number(items[4]);

        let short_trip_id = regex.exec(trip_id)![length];
        let route_id = trip_id.split('_')[2]

        let key = trip_id;

        if (!data_obj[key]) {
            data_obj[key] = {
                shortTripID: short_trip_id,
                longTripID: trip_id,
                stops: [],
                routeID: route_id
            }
        }

        data_obj[key].stops[seq] = { stopID: stop_id, stopTime: time } // Must parse HH:MM:SS timestamp into epoch time
    });

    return data_obj;
}

// This one is just the raw text file
export async function getShapes() : Promise<Record<string,[number,number][]>> {
    return fetch(SHAPES_URL)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch shapes");
            return response.text();
        })
        .then(parseShapesToJSON);
}

// Stops are preprocessed
export async function getStops() : Promise<any> {
    return d3.csv(STOPS_URL)
}

// Routes are just converted from txt to json
export async function getRoutes() {
    return d3.csv(ROUTES_URL);
}

// Just text
export async function getStopTimes() {
    return fetch(STOP_TIMES_URL)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch stop times");
            return response.text();
        }).then(parseStopTimesToJSON)
}
