import * as THREE from 'three';
import { coordinateLL, stopCoords } from './Viz.ts';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { StaticRoute } from './Static';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';

type Station = {
    id : string,
    parent : string
    name : string,
    lat : number,
    lon : number,
    x : number,
    y : number,
    v : THREE.Vector2
}

export type TrackShape = {
    shape_id : string,
    waypoints : {lat:number, lon:number}[]
}

export type StopInfo = {
    id : string,
    name : string,
    lat : number,
    lon : number,
    parent? : string
}

export class Track {

    id : string;
    route_id : string;
    direction : number;
    stations : Station[];

    offset : number;
    waypoints : { pos:THREE.Vector2, lastStop:string }[];
    color : THREE.ColorRepresentation;
    material : LineMaterial;

    static VERTICAL_OFFSET = -1;
    static WIDTH = .15;
    static DRAWN_STOPS : string[] = []


    /**
     * Create an instance of a track
     * 
     * @param shape The data from shapes.txt
     * @param route The data from stop_times.txt
     */
    constructor(shape : TrackShape, route : StaticRoute, stops : Record<string, StopInfo>, offset? : number, color? : THREE.ColorRepresentation) {
        this.offset = offset ?? 0;
        this.color =  color ?? 0x888888
        this.material = new LineMaterial({ color: this.color, linewidth: Track.WIDTH, worldUnits: true})
        this.id = shape.shape_id;
        this.route_id = shape.shape_id;

        this.stations = route.stops.map(stop => { 
            let stopInfo = stops[stop.stopID];
            let xy = coordinateLL(stopInfo.lat, stopInfo.lon)
            return {
                id: stop.stopID,
                parent: stopInfo.parent ?? "",
                name: stopInfo.name,
                lat: stopInfo.lat,
                lon: stopInfo.lon,
                x: xy.x,
                y: xy.y,
                v: new THREE.Vector2(...xy), // Offset here if desired
            }
        }).filter(x => x);

        this.waypoints = [];
        this.generateWaypoints(shape);


    }

    generateWaypoints(shape : TrackShape) {
        let waypointsXY = shape.waypoints.map(xy => coordinateLL(xy.lat, xy.lon));
        let linePoints : THREE.Vector2[] = [];

        let a,b,c, bisector, v1, v2;

        b = waypointsXY[0].clone();
        c = waypointsXY[1].clone();

        v2 = c.clone().sub(b).normalize();
        bisector = new THREE.Vector2(v2.y, -v2.x);
        linePoints.push(b.addScaledVector(bisector, this.offset));

        let stationIndex = 0;
        let nextStationIndex = 1;
        this.waypoints.push({ pos: b.addScaledVector(bisector, this.offset), lastStop: this.stations[stationIndex].id})

        for (let i=1; i<waypointsXY.length-1; i++) {
        //for (let i=1; i<waypointsXY.length-1; i++) {
        
            b = waypointsXY[i].clone();
            a = waypointsXY[i-1].clone();
            c = waypointsXY[i+1].clone();

            v1 = a.clone().sub(b).normalize();
            v2 = c.clone().sub(b).normalize();

            let v1x2 = v1.clone().multiplyScalar(v2.length());
            let v2x1 = v2.clone().multiplyScalar(v1.length());

            bisector = v1x2.add(v2x1).normalize();
            if (bisector.length() == 0) {
                bisector = new THREE.Vector2(v1.y, -v1.x);
            }
            if (bisector.length() == 0) {
                bisector = new THREE.Vector2(v2.y, -v2.x);
            }

            let handedness = v1.cross(v2) > 0 ? 1 : -1;
            bisector.multiplyScalar(handedness);


            if (v1.length() == 0 || v2.length() == 0) {
                //console.warn("Points are overlapping", a, b, c, "vs", v1, v2, "Bisector: ", bisector)
                console.warn("Lat-Long are overlapping when drawing paths. This point will be omitted from the data: ", 
                    shape.waypoints[i-1], shape.waypoints[i], shape.waypoints[i+1]);
                continue;
            }

            if (bisector.length() < .98) {
                console.error("Bisector fails", a, b, c, "vs", v1, v2, "Bisector: ", bisector)
            }

            let finalV = b.addScaledVector(bisector, this.offset);

            this.waypoints.push({ pos: finalV, lastStop: this.stations[stationIndex].id})

            // Update station vector position

            if (stationIndex == this.stations.length - 1) continue;

            if (shape.waypoints[i].lat == this.stations[nextStationIndex].lat && 
                shape.waypoints[i].lon == this.stations[nextStationIndex].lon) {
                    this.stations[nextStationIndex].v = finalV;
                    stationIndex++;
                }

            nextStationIndex = stationIndex + 1;
        }

        a = waypointsXY[waypointsXY.length-2].clone();
        b = waypointsXY[waypointsXY.length-1].clone();

        v1 = a.clone().sub(b).normalize();
        bisector = new THREE.Vector2(-v1.y, v1.x);
        //linePoints.push(b.addScaledVector(bisector, this.offset))
        //linePoints = linePoints.filter(n=>n);

        this.waypoints.push({ 
            pos: b.addScaledVector(bisector, this.offset), 
            lastStop: this.stations[this.stations.length-1].id
        })
    }

    drawMap(scene?:THREE.Scene) : Line2 {
        //const lineG = new LineGeometry().setFromPoints(this.stations.map(s => new THREE.Vector3(s.x, s.y, -1)))
        const lineG = new LineGeometry().setFromPoints(this.waypoints.map(wp => wp.pos))
        const line = new Line2(lineG, this.material);


        //console.debug(this.route_id);
        if (scene) {
            scene.add(line);
            this.drawStops(scene);
        }
        return line;
    }

    /**
     * 
     * @param id1 Origin station
     * @param id2 Target station
     * @param r scalar
     * @returns XY coordinate between the two points
     */
    interp(id1 : string, id2 : string, r : number) : THREE.Vector2 {
        let v1 = this.stations.find(s => s.id == id1)!.v;
        let v2 = this.stations.find(s => s.id == id2)!.v;
        let difference = v2.sub(v1)
        let lerp = v1.addScaledVector(difference, r);
        return lerp;
    }

    previous(id : string) : Station {
        return this.stations[this.stations.findIndex(s => s.id == id) - 1]
    }

    stn(id : string) : Station | undefined {
        let station = this.stations.find(s => s.id == id);
        if (!station) console.warn(`Station ${id} not found on line ${this.route_id}`)
        return station
    }

    next(id : string) : Station {
        return this.stations[this.stations.findIndex(s => s.id == id) + 1]
    }

    drawStops(scene : THREE.Scene) {
        this.stations.forEach(s => Track.drawStop(s, scene))
    }


    static drawStop(row: Station, scene : THREE.Scene) {
        if (this.DRAWN_STOPS.includes(row.id)) return;
        let v = row.v
        stopCoords[row.id] = v;

        //if ((row.id.slice(-1) == 'N') || (row.id.slice(-1) == 'S')) return;
        //let geom = new THREE.CircleGeometry(.0004);
        let geom = new THREE.SphereGeometry(.5);
        //geom.lookAt(new THREE.Vector3(0, 0, 1));
        geom.translate(v.x, v.y, 0);

        //console.debug(row.name);


        let material = new THREE.MeshBasicMaterial({ color: 0xffffff })
        const stop = new THREE.Mesh(geom, material)

        scene.add(stop);

        const stopDiv = document.createElement('div');
        stopDiv.className = 'stopLabel';
        stopDiv.textContent = row.id;
        stopDiv.style.backgroundColor = 'transparent';

        const stopLabel = new CSS2DObject(stopDiv);
        stopLabel.position.set(v.x, v.y, 0);
        stopLabel.center.set(0,4);
        stop.add(stopLabel);

        this.DRAWN_STOPS.push(row.id)

        return stop;
    }


}