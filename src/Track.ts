import * as THREE from 'three';
import { coordinateLL } from './Viz.ts';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { StaticRoute } from './Static';

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

type Shape = {
    shape_id : string,
    waypoints : {lat:number, lon:number}[]
}

type StopInfo = {
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


    /**
     * Create an instance of a track
     * 
     * @param shape The data from shapes.txt
     * @param route The data from stop_times.txt
     */
    Track(shape : Shape, route : StaticRoute, stops : Record<string, StopInfo>, offset? : number, color? : THREE.ColorRepresentation) {
        this.offset = offset ?? 0;
        this.color = color ?? 0xEEEEEE
        this.material = new LineMaterial({ color: color, linewidth: Track.WIDTH, worldUnits: true})
        this.id = shape.shape_id;

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
                v: new THREE.Vector2(...xy),
            }
        })

        this.generateWaypoints(shape);

    }

    generateWaypoints(shape : Shape) {
        let waypointsXY = shape.waypoints.map(xy => coordinateLL(xy.lat, xy.lon));
        let linePoints : THREE.Vector2[] = [];

        let a,b,c, bisector, v1, v2;

        b = waypointsXY[0].clone();
        c = waypointsXY[1].clone();

        v2 = c.clone().sub(b).normalize();
        bisector = new THREE.Vector2(v2.y, -v2.x);
        linePoints.push(b.addScaledVector(bisector, this.offset));

        let stationIndex = 0;
        this.waypoints.push({ pos: b.addScaledVector(bisector, this.offset), lastStop: this.stations[stationIndex].id})

        for (let i=1; i<waypointsXY.length-1; i++) {
        //for (let i=1; i<waypointsXY.length-1; i++) {
            if (shape.waypoints[i].lat == this.stations[stationIndex+1].lat &&
                shape.waypoints[i].lon == this.stations[stationIndex+1].lon
            ) { stationIndex++; }
        
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

            linePoints.push(b.addScaledVector(bisector, this.offset));
            this.waypoints.push({ pos: b.addScaledVector(bisector, this.offset), lastStop: this.stations[stationIndex].id})
        }

        a = waypointsXY[waypointsXY.length-2].clone();
        b = waypointsXY[waypointsXY.length-1].clone();

        v1 = a.clone().sub(b).normalize();
        bisector = new THREE.Vector2(-v1.y, v1.x);
        linePoints.push(b.addScaledVector(bisector, this.offset))
        linePoints = linePoints.filter(n=>n);

        this.waypoints.push({ 
            pos: b.addScaledVector(bisector, this.offset), 
            lastStop: this.stations[waypointsXY.length-1].id
        })
    }

    drawMap(scene?:THREE.Scene) : Line2 {
        const lineG = new LineGeometry().setFromPoints(this.stations.map(s => new THREE.Vector3(s.x, s.y, -1)))
        const line = new Line2(lineG, this.material);

        if (scene) scene.add(line);
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

    next(id : string) : Station {
        return this.stations[this.stations.findIndex(s => s.id == id) + 1]
    }


}