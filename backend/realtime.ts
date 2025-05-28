/* eslint-disable @typescript-eslint/no-unused-vars */
import { transit_realtime } from "gtfs-realtime-bindings"
import * as express from 'express';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import SuperJSON from 'superjson';


const ACE_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";
const IRT_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";
const L_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
const BDFM_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
const G_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
const JZ_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
const NQRW_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
const SIR_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"

type DataChunk = {
    tripID: string,
    trip?: { routeId : string, startDate: string, startTime: string, tripId : string } | transit_realtime.ITripDescriptor
    stopTimes: { stopTime: number, stopID: string }[][],
    stopUpdates: Record<string, transit_realtime.TripUpdate.IStopTimeUpdate>,
    hasVehicle: boolean,
    parentStopID?: string,
    vehicleTimestamp?: number,
    currentStopSequence?: number,
    status?: number,
    shortTripID: string,
}

function getChunk(trip: transit_realtime.ITripDescriptor) : DataChunk {
    return { 
        tripID:trip.tripId!,
        trip:trip,
        stopTimes:[],
        stopUpdates: {},
        hasVehicle: false,
        shortTripID: trip.tripId!.split('_')[1],
    }
}


function consolidate(feed: transit_realtime.FeedMessage) : Record<string, DataChunk> {
    const trips : Record<string, DataChunk> = {};


    feed.entity.forEach(entity => {
        if (entity.tripUpdate) {
            const tripID = entity.tripUpdate.trip.tripId!;
            const t : DataChunk = trips[tripID] ?? getChunk(entity.tripUpdate.trip!);

            // Soonest STU is first, always
            const customUpdates : {stopTime: number, stopID: string}[] = entity.tripUpdate.stopTimeUpdate!.map(stu => {
                return {
                    stopTime: +((stu.arrival ?? stu.departure)!.time!),
                    stopID: String(stu.stopId)
                }
            })

            entity.tripUpdate.stopTimeUpdate?.forEach(stu => {
                t.stopUpdates[stu.stopId!] = stu
            })

            // Insert the most recent updates at the beginning of the array
            t.stopTimes.unshift(customUpdates);

            trips[tripID] = t;

        } else if (entity.vehicle) {
            const tripID = entity.vehicle.trip!.tripId!;
            const t : DataChunk = trips[tripID] ?? getChunk(entity.vehicle.trip!);

            t.parentStopID = entity.vehicle.stopId!;
            t.vehicleTimestamp = +(entity.vehicle.timestamp!);
            t.currentStopSequence = entity.vehicle.currentStopSequence ?? -1;
            t.status = entity.vehicle.currentStatus ?? -1;
            t.hasVehicle = true;

            
            trips[tripID] = t;

        }
    })
    

    return trips;

}

async function fetch_data(URL: string) : Promise<Record<string, DataChunk>> {
    return fetch(URL)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch realtime data")
            }
            return response;
        })
        .then(response => response.arrayBuffer())
        .then(buf => transit_realtime.FeedMessage.decode(new Uint8Array(buf)))
        .then(consolidate);
}

let data : Record<string, DataChunk> = {};

async function fetch_all() {
    data = {
        ...await fetch_data(ACE_API_URL),
        ...await fetch_data(BDFM_API_URL),
        ...await fetch_data(G_API_URL),
        ...await fetch_data(JZ_API_URL),
        ...await fetch_data(NQRW_API_URL),
        ...await fetch_data(L_API_URL),
        ...await fetch_data(IRT_API_URL)
    }

    return data;

}

const PATH = path.join(__dirname, '../data/rt')

function exportData(data : Record<string, DataChunk>, path: string) {
    fs.writeFile(path, SuperJSON.stringify(data), err => {
        if(err) console.log("Export error:", err)
    });    
}

function importData() : Record<string, DataChunk> {
    return SuperJSON.parse<typeof data>(fs.readFileSync(path.join(PATH, 'data.sjson'), 'utf-8'));
    //return loaded;
}

function getTime() : string {
    const date = new Date();
    const hrs = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    const s = date.getSeconds().toString().padStart(2, '0')

    return `${hrs}${mins}${s}`;
}

async function periodic() {
    console.log("Runs periodic function");
    fetch_all()
        .then(d => {
            //exportData(d, path.join(PATH, `data_${getTime()}.sjson`))
            exportData(d, path.join(PATH, `data.sjson`))
            console.info(`Retrieved ${Object.keys(d).length} records from API`);
        });

    //exportData(data, path.join(PATH, `data_${getTime()}.sjson`))

}

export async function init() {

    try {
        data = importData();
        console.log(`Imported ${Object.keys(data).length} records`)
    } catch {
        console.warn("No data to import");
    }

    periodic();

    setInterval(periodic, 30*1000)

    //return data;
}

init();
export default init;

/*
 
 ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
 ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
 ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
 ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
 ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
 ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
                                                  
 
*/


const app = express();
app.use(cors());
const port = 3000;
const staticDataPath = '../data/gtfs_subway'

app.get('/stops.txt', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'stops.txt'))
})

app.get('/shapes.txt', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'shapes.txt'))
})

app.get('/routes.txt', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'routes.txt'))
})

app.get('/routes.json', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'routes.json'))
})

app.get('/stop_times.txt', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'stop_times.txt'))
})

app.get('/trips.txt', (req, res) => {
    res.sendFile(path.join(__dirname, staticDataPath, 'trips.txt'))
})

app.get('/realtime', (reg, res) => {
    res.send(data);
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})
