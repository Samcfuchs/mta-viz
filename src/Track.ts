import * as THREE from 'three';
import { coordinateLL, stopCoords } from './Viz.ts';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { StaticRoute } from './Static';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';

const lineOffsets : Record<string, number> = {
    'L':.25,
    '4':.25, '5':.50, '6':.75,
    '1':.25, '2':.50, '3':.75,
    'N':.25, 'Q':.50, 'R':.75, 'W':1.0,
    '7':.5,
    'A':.25, 'B':.50, 'C':.75, 'D':1.0,
    'E': 1.25,
    'F':1.50,
    'G':.5,
    'J':.5,
    'Z':.75,
}

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
    shape : TrackShape;

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
        const trainLine = shape.shape_id.split('..')[0];

        this.offset = offset ?? lineOffsets[trainLine] ?? 0;
        this.color =  color ?? 0x888888
        this.material = new LineMaterial({ color: this.color, linewidth: Track.WIDTH, worldUnits: true})
        this.id = shape.shape_id;
        this.route_id = shape.shape_id;
        this.shape = shape;

        this.stations = route.stops.map(stop => { 
            const stopInfo = stops[stop.stopID];
            const xy = coordinateLL(stopInfo.lat, stopInfo.lon)
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
        const waypointsXY = shape.waypoints.map(wp => coordinateLL(wp.lat, wp.lon));

        let a,b,c, bisector, v1, v2, finalV;

        b = waypointsXY[0].clone();
        c = waypointsXY[1].clone();

        v2 = c.clone().sub(b).normalize();
        bisector = new THREE.Vector2(v2.y, -v2.x);

        let stationIndex = 0;
        let nextStationIndex = 1;

        finalV = b.addScaledVector(bisector, this.offset)
        this.waypoints.push({ pos: finalV, lastStop: this.stations[stationIndex].id})

        // Update station vector position
        if (shape.waypoints[0].lat == this.stations[0].lat && 
            shape.waypoints[0].lon == this.stations[0].lon) {
                this.stations[0].v = finalV;
        }

        for (let i=1; i<waypointsXY.length-1; i++) {
        
            b = waypointsXY[i].clone();
            a = waypointsXY[i-1].clone();
            c = waypointsXY[i+1].clone();

            v1 = a.clone().sub(b).normalize();
            v2 = c.clone().sub(b).normalize();

            const v1x2 = v1.clone().multiplyScalar(v2.length());
            const v2x1 = v2.clone().multiplyScalar(v1.length());

            bisector = v1x2.add(v2x1).normalize();
            if (bisector.length() == 0) {
                bisector = new THREE.Vector2(v1.y, -v1.x);
            }
            if (bisector.length() == 0) {
                bisector = new THREE.Vector2(v2.y, -v2.x);
            }

            const handedness = v1.cross(v2) > 0 ? 1 : -1;
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

            finalV = b.addScaledVector(bisector, this.offset);

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

        finalV = b.addScaledVector(bisector, this.offset);
        if (!finalV) {
            throw Error;
        }
        this.waypoints.push({ 
            pos: finalV, 
            lastStop: this.stations[this.stations.length-1].id
        })

        this.waypoints.filter(x => x);

        if (shape.waypoints[shape.waypoints.length-1].lat == this.stations[this.stations.length-1].lat && 
            shape.waypoints[shape.waypoints.length-1].lon == this.stations[this.stations.length-1].lon) {
                this.stations[this.stations.length-1].v = finalV;
        }
        return this.waypoints;
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
        const v1 = this.stations.find(s => s.id == id1)!.v;
        const v2 = this.stations.find(s => s.id == id2)!.v;
        const difference = v2.sub(v1)
        const lerp = v1.addScaledVector(difference, r);
        return lerp;
    }

    previous(id : string) : Station {
        return this.stations[this.stations.findIndex(s => s.id == id) - 1]
    }

    stn(id : string) : Station | undefined {
        const station = this.stations.find(s => s.id == id);
        //if (!station) console.warn(`Station ${id} not found on line ${this.route_id}`)
        return station
    }

    next(id : string) : Station {
        return this.stations[this.stations.findIndex(s => s.id == id) + 1]
    }

    index(id : string) : number {
        return this.stations.findIndex(s => s.id == id);
    }

    drawStops(scene : THREE.Scene) {
        this.stations.forEach(s => Track.drawStop(s, scene))
    }


    static drawStop(row: Station, scene : THREE.Scene) {
        if (this.DRAWN_STOPS.includes(row.id)) return;
        const v = row.v
        stopCoords[row.id] = v;

        //if ((row.id.slice(-1) == 'N') || (row.id.slice(-1) == 'S')) return;
        //let geom = new THREE.CircleGeometry(.0004);
        const geom = new THREE.SphereGeometry(.25);
        //geom.lookAt(new THREE.Vector3(0, 0, 1));
        geom.translate(v.x, v.y, 0);

        //console.debug(row.name);


        const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
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
