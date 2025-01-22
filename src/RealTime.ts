
import GtfsRealtimeBindings from "gtfs-realtime-bindings"

const ACE_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";
const IRT_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";
const L_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
const BDFM_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
const G_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
const JZ_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
const NQRW_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
const SIR_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si"


let trains = [];


function inspect(feed : GtfsRealtimeBindings.transit_realtime.FeedMessage) {
    console.info(feed);
    feed.entity.forEach(e => console.info(e.tripUpdate?.trip.tripId))
    return feed;
}

export type DataChunk = {
    tripID: string,
    trip?: { routeId : string, startDate: string, startTime: string, tripId : string } | GtfsRealtimeBindings.transit_realtime.ITripDescriptor
    stopTimes: { stopTime: number, stopID: string }[][],
    hasVehicle: boolean,
    parentStopID?: string,
    vehicleTimestamp?: number,
    currentStopSequence?: number,
    status?: number,
    shortTripID: string,
}

function consolidate(feed : GtfsRealtimeBindings.transit_realtime.FeedMessage) : Record<string, any> {
    let trips : Record<string, DataChunk> = {};

    feed.entity.forEach(entity => {
        if (entity.tripUpdate) {
            let update = entity.tripUpdate;
            let tripID = update.trip.tripId!;
            if (!trips[tripID]) trips[tripID] = { 
                tripID:tripID, 
                trip:update.trip, 
                stopTimes:[],
                hasVehicle: false,
                shortTripID: tripID.split('_')[1],
            }

            let t : DataChunk = trips[tripID]

            // Soonest STU is first, always
            let customUpdates : {stopTime: number, stopID: string}[] = update.stopTimeUpdate!.map(stu => {
                return {
                    stopTime: +((stu.arrival ?? stu.departure)!.time!),
                    stopID: String(stu.stopId)
                }
            })

            // Insert the most recent updates at the beginning of the array
            t.stopTimes.unshift(customUpdates);

            trips[tripID] = t;

        } else if (entity.vehicle) {
            let tripID = entity.vehicle.trip!.tripId!;
            if (!trips[tripID]) trips[tripID] = { tripID:tripID, stopTimes:[], hasVehicle: false, shortTripID: tripID.split('_')[1] }
            let t : DataChunk = trips[tripID]

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

async function fetch_data(URL:string) : Promise<Record<string, DataChunk>> {
    let data = fetch(URL)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch realtime data")
            }
            return response;
        })
        .then(response => response.arrayBuffer())
        .then(buf => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf)))
        //.then(inspect)
        .then(consolidate)
        //.then(d => {console.info(d); return d})
        ;

    return data;
}

export function pull() {
    return data
}

let data : Record<string, any> = {};

async function fetch_all() {
    console.log("Fetching data")

    data = {
        ...await fetch_data(ACE_API_URL),
        ...await fetch_data(BDFM_API_URL),
        ...await fetch_data(G_API_URL),
        ...await fetch_data(JZ_API_URL),
        ...await fetch_data(NQRW_API_URL),
        ...await fetch_data(L_API_URL),
        ...await fetch_data(IRT_API_URL)
    }
    //console.log(data);
}

export async function init() {
    await fetch_all();
    setInterval(() => {
        fetch_all();
    }, 30 * 1000);

    return data;
}

export default init;