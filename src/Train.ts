import * as THREE from 'three';
import { DataChunk } from './RealTime';
import {stopCoords, staticStopTimes } from './Viz';
import { StaticRoute } from './Static';

export type TrainProps = {
    tripId: string | undefined,
    parentStop : string | undefined,
    status: number | undefined,
    routeId: string | undefined | null,
    direction: string | undefined
};

export class Train {
    mesh : THREE.Mesh;
    props : TrainProps;
    tripID : string;
    data : DataChunk;
    testArrivalTime: number;
    scene : THREE.Scene;
    staticData : StaticRoute;

    static SIZE : number = .002

    constructor(tripID : string) {
        this.tripID = tripID;

    }

    setProps(t : TrainProps) : void {
        this.props = t;
    }

    setData(realTimeData : DataChunk, staticData? : any) : void {
        this.data = realTimeData;
        this.staticData = staticData ?? this.staticData;
        //this.manageDataChange();
    }

    /**
     * Adds or removes the 3D elements based on the contents of this.data.
     * Should run every ~30 seconds when realtime data is updated.
     */
    manageDataChange() {
        if (this.data.hasVehicle && !this.mesh) this.createMesh();
        if (!this.data.hasVehicle && this.mesh && this.scene) this.deleteFromScene(this.scene!);
    }

    createMesh() : THREE.Mesh {
        if (this.mesh) return this.mesh;
        //let geometry = new THREE.BoxGeometry(Train.SIZE, Train.SIZE, Train.SIZE)
        //console.log("Making mesh");
        let geometry = new THREE.ConeGeometry(.001, .002);

        geometry.lookAt(new THREE.Vector3(0,0,-1));
        let material = new THREE.MeshNormalMaterial();
        let obj = new THREE.Mesh(geometry, material);
        this.mesh = obj;

        return obj;
    }

    setPos(v:THREE.Vector3) {
        if (!this.mesh) {
            console.warn("Attempted to set position but there's no mesh")
            return;
        }
        //let rand = new THREE.Vector3().randomDirection()
        //let vec = v.addScaledVector(rand, .0005);
        let vec = v;
        this.mesh.position.set(...vec.toArray());
        //this.mesh.lookAt(new THREE.Vector3(0,100,0))
    }

    setHeading(deg : number) {
        let rads = -(deg % 360) * (Math.PI * 2 / 360) ;
        let y = Math.sin(rads);
        let x = Math.cos(rads);

        this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1), rads)
    }

    addToScene(s : THREE.Scene) {
        if (!this.mesh) { this.createMesh() }
        this.scene = s;
        s.add(this.mesh);
    }

    deleteFromScene(s : THREE.Scene) {
        s.remove(this.mesh);
    }

    /**
     * Update the train's position, etc, on the basis of its internal data. Use
     * in the animation loop.
     * @param ms the number of ms elapsed since the previous update
     * @param time the current unix time in ms
     * @returns void
     */
    update(ms : number, time? : number) {
        if (!this.mesh) return;
        time = time ?? new Date().getTime()

        let nextStop = this.data.stopTimes[0][0]
        let shortTripID = this.tripID.split('_')[1]
        let altSchedule = staticStopTimes[shortTripID]
        if (!nextStop) {
            if (altSchedule) {
                //console.warn(`But it does have a schedule in static data under ${shortTripID}`)
                nextStop = altSchedule['stops'][2]
                //if (!nextStop) {console.error("whoops")}
            }

        }

        if (!nextStop) {
            console.warn(`Train ${shortTripID} has no schedule anywhere`);
            return;
        }
        let nextCoords = stopCoords[nextStop.stopID]
        if (!nextCoords) {
            //console.warn(`Stop ${nextStop.stopId} has no coords`);
            return
        };

        let arrivalTime = +(nextStop.stopTime) * 1000;

        nextCoords = stopCoords['A33']
        arrivalTime = this.testArrivalTime;

        let difference = new THREE.Vector3().subVectors(nextCoords, this.mesh.position)
        let dt = arrivalTime - time;

        //if (dt < 0) dt = 0;

        //this.setPos(this.mesh.position.addScaledVector(difference, ms/dt*100))
        //this.mesh.position.addScaledVector(difference, ms/dt*1);
        //this.mesh.position.addScaledVector(new THREE.Vector3(0,0,1), .01)
        //this.setPos(this.mesh.position.addScaledVector(new THREE.Vector3(0,0,.01), ms/dt))
        //console.log("updating")
        this.mesh.rotateZ(Math.sin(ms/4000)*10);
        //this.setHeading(180);
    }
}

export default Train;