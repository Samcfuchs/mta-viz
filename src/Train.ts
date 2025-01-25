import * as THREE from 'three';
import { DataChunk } from './RealTime';
import {stopCoords, staticStopTimes, createShadows, COORD_SCALE, dataPanel, dataHover } from './Viz';
import { StaticRoute } from './Static';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';

export class Train {
    mesh : THREE.Mesh;
    scene : THREE.Scene;

    tripID : string;
    data : DataChunk;
    testArrivalTime: number;
    staticData : StaticRoute;
    nextStop : { stopTime: number; stopID: string; } | undefined;
    prevStop : { stopTime: number; stopID: string; } | undefined;

    static standardMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f0da, roughness:1 });
    static highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness:1 });
    static warningMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d14e, roughness:1 });
    static errorMaterial = new THREE.MeshStandardMaterial({ color: 0xf5544e, roughness:1 });
    static SIZE : number = 0.5;

    constructor(tripID : string) {
        this.tripID = tripID;

    }

    setData(realTimeData : DataChunk, staticData? : any) : void {
        this.data = realTimeData;
        this.staticData = staticData ?? this.staticData;

        // Remove this before using stop sequence values
        this.staticData.stops = this.staticData.stops.filter(x => x);
    }

    /**
     * Adds or removes the 3D elements based on the contents of this.data.
     * Should run every ~30 seconds when realtime data is updated.
     */
    manageDataChange() {
        if (this.data.hasVehicle && !this.mesh) this.createMesh();
        if (!this.data.hasVehicle && this.mesh && this.scene) this.deleteFromScene(this.scene!);

        let time = new Date().getTime()
        this.nextStop = this.data.stopTimes[0].find(v => v.stopTime*1000 > time)
        if (this.staticData && this.nextStop) {
            try {
                let pStopNumber = this.staticData.stops.findIndex(stop => stop.stopID == this.nextStop?.stopID, this);
            } catch {
                console.debug(this.nextStop)
                console.debug(this.staticData.stops)
                throw Error();
            }

        }
    }

    createMesh() : THREE.Mesh {
        if (this.mesh) return this.mesh;
        let geometry = new THREE.BoxGeometry(Train.SIZE, Train.SIZE, Train.SIZE*6)

        let material = Train.standardMaterial;
        let obj = new THREE.Mesh(geometry, material);
        this.mesh = obj;

        obj.castShadow = createShadows;
        obj.receiveShadow = false;

        obj.name = this.tripID;

        return obj;
    }

    changeMaterial(m : THREE.Material) : THREE.Mesh {
        this.mesh.material = m;
        return this.mesh;
    }

    static timestampString(t : number | undefined) {
        if (!t) return "none";
        return new Date((t) * 1000).toLocaleTimeString('en-us');
    }

    toString() : string {
        return [
            `Line: ${this.staticData.routeID}`,
            `TripID: ${this.tripID}`,
            `Parent stop: ${this.data.parentStopID}`,
            `Next stop: ${this.nextStop?.stopID} @ ${Train.timestampString(this.nextStop?.stopTime)}`,
            `Previous stop: ${this.prevStop?.stopID}`,
            `Schedule: \n${this.data.stopTimes[0].map(stop => `\t${stop.stopID} @ ${Train.timestampString(stop.stopTime)}`).join('\n')}`,
            //`Static schedule: \n${this.staticData.stops.map(stop => `\t${stop.stopID} @ ${Train.timestampString(stop.stopTime)}`).join('\n')}`
        ].join('\n');
    }

    highlight(state : boolean) {
        if (!this.mesh) return;
        if (state) {
            this.mesh.material = Train.highlightMaterial;
            dataPanel!.innerHTML = '<pre>' + this.toString() + '</pre>';
            dataHover!.innerHTML = '<pre>' + this.toString() + '</pre>';
        } else this.mesh.material = Train.standardMaterial;
    }

    setPos(v : THREE.Vector3 | THREE.Vector2) {

        if (!this.mesh) {
            console.warn("Attempted to set position but there's no mesh")
            return;
        }

        if (!v) {
            console.warn("Attempted to setPos to a null vector");
            return;
        }

        if (v instanceof THREE.Vector2) v = new THREE.Vector3(v.x,v.y,0);
        let vec = v.clone()
        this.mesh.position.set(...vec.toArray());
    }

    setHeading(deg : number) {
        let rads = -(deg % 360) * (Math.PI * 2 / 360) ;
        let y = Math.sin(rads);
        let x = Math.cos(rads);

        this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1), rads)
    }

    setHeadingFromVector(v:THREE.Vector3) {
        let ang = Math.atan2(v.y, v.x);
        //ang = (Math.PI / 2) - ang;
        this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1), ang)
    }

    approachVectorHeading(v:THREE.Vector3, rate:number) {
        //let targetAngle = Math.atan2(v.y, v.z);
        //let currAngle = Math.atan2(this.mesh.get)
        //this.mesh.rotateOnWorldAxis(new THREE.Vector3(0,0,1), rate)
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

        //let nextStop = this.data.stopTimes[0][0]
        //console.log(time);
        //this.nextStop = this.data.stopTimes[0].find(v => v.stopTime*1000 > time)
        this.nextStop = this.data.stopTimes[0][0]


        let shortTripID = this.tripID.split('_')[1]

        if (!this.nextStop) {
            //console.warn("FUCK")
            this.changeMaterial(Train.errorMaterial);
            return
        }

        let nextCoords = stopCoords[this.nextStop.stopID]
        // If nextCoords aren't available, just skip to the next station
        if (!nextCoords) {
            let i = this.data.stopTimes[0].findIndex(s => s == this.nextStop);
            this.nextStop = this.data.stopTimes[0][i+1];
            nextCoords = stopCoords[this.nextStop.stopID]
        }
        if (!nextCoords) {
            console.warn(`Stop ${this.nextStop.stopID} has no coords`);
            return
        };

        let staticStopSeq : number = this.staticData.stops.findIndex(s => s.stopID == this.nextStop!.stopID)
        if (staticStopSeq == 0) { return; }
        if (staticStopSeq == -1) { return; }

        this.prevStop = this.staticData.stops[staticStopSeq - 1] ??
                        this.staticData.stops[staticStopSeq - 2];
        if (!this.prevStop) {
            console.warn(`Train ${this.tripID} to ${this.nextStop.stopID} @ ${this.nextStop.stopTime} can't identify its previous stop`);
        }
        //this.prevStop = this.staticData.stops[0];

        //console.info(`Train ${shortTripID} has nextStop ${nextStop}`);

        let v = new THREE.Vector3(nextCoords.x, nextCoords.y, 0);

        let arrivalTime = +(this.nextStop.stopTime) * 1000;

        let difference = new THREE.Vector3().subVectors(v, this.mesh.position)
        let dt = arrivalTime - time;
        dt = dt < 0 ? 2000 : dt;

        //if (dt < 0) dt = 0;
        //let targetAngle = difference.clone().normalize()
        //var qrot = new THREE.Quaternion().setFromUnitVectors(this.mesh.rotation.to, targetAngle)

        //this.setPos(this.mesh.position.addScaledVector(difference, ms/dt*100))
        this.mesh.position.addScaledVector(difference, ms/dt*1);

        this.mesh.lookAt(v);
        //this.setPos(this.mesh.position.addScaledVector(new THREE.Vector3(0,0,.01), ms/dt))
        //console.log("updating")
        //this.mesh.rotateZ(Math.sin(ms/4000)*10);
        //this.setHeading(180);
    }
}

export default Train;