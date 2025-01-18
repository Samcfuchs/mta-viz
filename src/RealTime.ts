
import GtfsRealtimeBindings from "gtfs-realtime-bindings"
import { TrainProps } from './Train'

const ACE_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace";
const IRT_API_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";


let trains = [];


function createTrain(entity:GtfsRealtimeBindings.transit_realtime.IFeedEntity) : TrainProps | void {
    if (!entity.vehicle) return;
    let t : TrainProps = {
        tripId: entity.vehicle.trip?.tripId ?? "",
        //parentStop: entity.vehicle.stopId?.slice(0,-1),
        parentStop: entity.vehicle.stopId ?? "F27N",
        status: Number(entity.vehicle.currentStatus),
        routeId: entity.vehicle.trip?.routeId,
        direction: entity.vehicle.stopId?.slice(-1)
    }
    return t

}

async function fetch_data(URL:string) : Promise<Array<TrainProps>> {
    let data : Promise<Array<TrainProps>> = fetch(URL)
        .then(response => {
            if (!response.ok) {
                //throw new Error("Failed to fetch realtime data (ACE)")
            }
            return response;
        })
        .then(response => response.arrayBuffer())
        .then(buf => GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf)))
        .then(feed => {console.log(feed); return feed})
        .then(feed => { feed.entity = 
            feed.entity.filter(entity => entity.vehicle);
            return feed
        })
        .then(feed => {
            let time = Number(feed.header.timestamp ?? 0);
            return feed.entity.map(entity => {
                if (entity.tripUpdate) {
                    /*
                    //return 'entity has tripUpdate';
                    //return undefined;
                    //return entity.tripUpdate;
                    entity.tripUpdate.stopTimeUpdate?.forEach(stopUpdate => {
                        if (stopUpdate.arrival?.time == null) return;
                        if (Number(stopUpdate.arrival?.time) > time) {
                            return { stopID:stopUpdate.stopId, arrivalTime:stopUpdate.arrival?.time }
                        }
                    });
                    */
                    //return "terminated wrongly"
                } else if (entity.vehicle) { }
                return createTrain(entity)!;
                //return feed.entity;
            });
        })
        //.then(trains => trains.filter(t => t))
    return data;
}

function bind_d3(data : any) {
}

function update_ACE() {

}

export function pull() {
    return data
}

let data : TrainProps[];

async function fetch_all() {
    console.log("Fetching data")

    data = [
        ...await fetch_data(ACE_API_URL),
        ...await fetch_data(IRT_API_URL)
    ]
    console.log(data);
}

export function init() {
    fetch_all();
    setInterval(() => {
        fetch_all()
    }, 30 * 1000);
}

export default init;