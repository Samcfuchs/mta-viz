import * as THREE from 'three';
import { DataChunk } from './RealTime';
import { StaticRoute } from './Static';
import { Track } from './Track';
import { createShadows, dataHover, dataPanel, stopCoords } from './Viz';
import { transit_realtime } from 'gtfs-realtime-bindings';

export class Train {
    mesh : THREE.Mesh;
    scene : THREE.Scene;

    tripID : string;
    data : DataChunk;
    testArrivalTime: number;
    staticData : StaticRoute;
    nextStop : { stopTime: number; stopID: string; } | undefined;
    prevStop : { stopTime: number; stopID: string; } | undefined;
    track : Track;
    stopTimes : { stopTime: number; stopID: string; }[];

    isActive : boolean;
    delete : boolean;
    status : string;
    isInScene : boolean;

    static standardMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f0da, roughness:1 });
    static highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness:1 });
    static warningMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d14e, roughness:1 });
    static errorMaterial = new THREE.MeshStandardMaterial({ color: 0xf5544e, roughness:1 });
    static SIZE : number = 0.5;
    static geometry = new THREE.BoxGeometry(Train.SIZE, Train.SIZE, Train.SIZE*6)

    constructor(tripID : string) {
        this.tripID = tripID;
        this.delete = false;
        this.status = 'New';
        this.isActive = false;

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
    _manageDataChange() {
        if (this.data.hasVehicle && !this.mesh) this.createMesh();
        if (!this.data.hasVehicle && this.mesh && this.scene) this.deleteFromScene(this.scene!);
        if (!this.data.hasVehicle) return;

        const time = new Date().getTime()

        //const seq = this.data.currentStopSequence!;

        //const parentStopStaticTime = this.staticData.stops.find(s => s.stopID == this.data.parentStopID)?.stopTime;
        const parentStopStaticSeq = this.staticData.stops.findIndex(s => s.stopID == this.data.parentStopID);

        if (parentStopStaticSeq != -1) {
            this.nextStop = {
                stopID: this.data.parentStopID!, 
                stopTime: Train.stringTimestamp(this.staticData.stops[parentStopStaticSeq].stopTime)
            }

            if (parentStopStaticSeq == 0) {
                // Next stop is first stop. Train's not active yet.
                this.isActive = false;
                return;
            }
            let pStop = this.staticData.stops[parentStopStaticSeq-1]
            this.prevStop = {
                stopID: pStop.stopID,
                stopTime: Train.stringTimestamp(pStop.stopTime)
            }
        } else {
            let nextStopIndex = this.data.stopTimes[0].findIndex(v => v.stopTime*1000 > time)

            this.nextStop = this.data.stopTimes[0][nextStopIndex]


            while (!this.track.stn(this.nextStop.stopID)) {
                nextStopIndex++;
                this.nextStop = this.data.stopTimes[0][nextStopIndex];

                if (nextStopIndex == this.data.stopTimes[0].length) {
                    console.warn(`Train ${this.tripID} could not find real stops`);
                    break;
                }
            }

            if (this.track.index(this.nextStop.stopID) == 0) {
                // Once again, next stop is first stop. Train's not active
                this.isActive = false;
                return;
            }
            let pStop = this.track.previous(this.nextStop.stopID);

            this.prevStop = this.data.stopTimes[0].find(s => s.stopID == pStop.id);

            if (!this.prevStop) console.warn(`Train ${this.tripID} could not match a previous stop`);
            //return;
        }

        if (!this.nextStop) {
            console.error(`Train ${this.tripID} with parent stop ${this.data.parentStopID} can't identify its next stop.`)
            return;
        }

        if (!this.prevStop) {
            console.warn(`Train ${this.tripID} to ${this.nextStop.stopID} @ ${this.nextStop.stopTime} can't identify its previous stop`);
        }

        if (!this.track.stn(this.nextStop.stopID)) {
            console.warn(`Train ${this.tripID} has nextStop ${this.nextStop.stopID} which is not real`);
        }
    }


    /*
     * Convenience function to process StopUpdates into stoptimes.
     */
    getRealTimeStopUpdates() {
        const sups : Record<string,transit_realtime.TripUpdate.IStopTimeUpdate> = this.data.stopUpdates;

        
        this.stopTimes = Object.values(sups).map( (sup) => {
            return {
                stopTime: +((sup.arrival ?? sup.departure)!.time!),
                stopID: String(sup.stopId)
            }
        }).sort((a,b) => a.stopTime - b.stopTime);

        return this.stopTimes;

    }

    manageDataChange() {
        if (this.data.hasVehicle && !this.mesh) this.createMesh();
        if (!this.data.hasVehicle && this.mesh && this.scene) this.deleteFromScene(this.scene!);
        if (!this.data.hasVehicle) return;

        const time = new Date().getTime()

        this.getRealTimeStopUpdates();

        let nextStopIndex = this.stopTimes.findIndex(v => v.stopTime*1000 > time)

        if (nextStopIndex == -1) {
            this.delete = true;
            //this.deleteFromScene(this.scene);
            return;
        } else if (nextStopIndex == 0) {
            return;
        }

        this.nextStop = this.stopTimes[nextStopIndex];

        if (!this.nextStop) console.error(`NextStop is null`);

        while (!stopCoords[this.nextStop.stopID]) {
            this.nextStop = this.stopTimes[nextStopIndex]
            nextStopIndex++;

            if (nextStopIndex >= this.stopTimes.length) {

                // Next stop is last stop, and imaginary
                this.delete = true;
                this.isActive = false;
                this.status = 'Next stop is last & imaginary'
                return;
            }
        }

        this.prevStop = this.stopTimes[nextStopIndex-1]
        let gap = 1;
        while (!stopCoords[this.prevStop.stopID]) {
            this.prevStop = this.stopTimes[nextStopIndex - gap]
            gap++;

            if (gap >= nextStopIndex) {
                // Previous stop is first stop and also imaginary
                this.delete = true;
                this.isActive = false;
                this.status = 'Prev stop is first & imaginary'
                return;
            }
        }

        if (!stopCoords[this.prevStop.stopID] || !stopCoords[this.nextStop.stopID]) {
            console.error(`Train ${this.tripID} has invalid stops`);
        }

        if (this.prevStop && this.nextStop) {
            this.isActive = true;
            this.status = 'Good'
        }

        if (stopCoords[this.prevStop.stopID] && stopCoords[this.nextStop.stopID] && !this.isInScene) {
            this.addToScene(this.scene);
        }

    }

    createMesh() : THREE.Mesh {
        if (this.mesh) return this.mesh;
        const geometry = Train.geometry;

        const material = Train.standardMaterial;
        const obj = new THREE.Mesh(geometry, material);
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

    /**
     * Expects a timestamp in HH:MM:SS format, returns seconds since epoch
    */
    static stringTimestamp(s : string) {
        const date = new Date();
        const timeParts = s.split(':');

        date.setHours(+timeParts[0])
        date.setMinutes(+timeParts[1])
        date.setSeconds(+timeParts[2])

        return Math.floor(date.getTime() / 1000);
    }

    toString() : string {
        return [
            `Line: ${this.staticData.routeID}`,
            `TripID: ${this.tripID}`,
            `${this.status}`,
            `Active: ${this.isActive}`,
            `Delete: ${this.delete}`,
            //`Parent stop: ${this.data.parentStopID}`,
            `Previous stop: ${this.prevStop?.stopID} @ ${Train.timestampString(this.prevStop?.stopTime)}`,
            `Next stop: ${this.nextStop?.stopID} @ ${Train.timestampString(this.nextStop?.stopTime)}`,
            `Schedule: \n${this.stopTimes.map(stop => `\t${stop.stopID} @ ${Train.timestampString(stop.stopTime)}`).join('\n')}`,
            //`Static schedule: \n${this.staticData.stops.map(stop => `\t${stop.stopID} @ ${Train.timestampString(stop.stopTime)}`).join('\n')}`
        ].join('\n');
    }

    highlight(state : boolean) {
        if (!this.mesh) return;
        if (state) {
            this.changeMaterial(Train.highlightMaterial);
            //this.mesh.material = Train.highlightMaterial;
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
        const vec = v.clone()
        this.mesh.position.set(...vec.toArray());
    }

    setHeading(deg : number) {
        const rads = -(deg % 360) * (Math.PI * 2 / 360) ;
        const y = Math.sin(rads);
        const x = Math.cos(rads);

        this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1), rads)
    }

    setHeadingFromVector(v:THREE.Vector3) {
        const ang = Math.atan2(v.y, v.x);
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
        this.isInScene = true;
    }

    deleteFromScene(s : THREE.Scene) {
        s.remove(this.mesh);
        this.isInScene = false;
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
        if (!this.nextStop) return;
        if (!this.prevStop) return;
        if (!this.isActive) return;
        time = time ?? new Date().getTime() / 1000

        this.status = 'Updating'

        if (time > this.nextStop.stopTime) {
            this.manageDataChange();
        }


        const nextCoords = stopCoords[this.nextStop.stopID];
        const prevCoords = stopCoords[this.prevStop.stopID];

        const nextVec = new THREE.Vector3(nextCoords.x, nextCoords.y, 0);
        const prevVec = new THREE.Vector3(prevCoords.x, prevCoords.y, 0);
        const difference = new THREE.Vector3().subVectors(nextVec, prevVec);
        //const v = new THREE.Vector3(nextVec.x, nextVec.y, 0);

        //const arrivalTime = +(this.nextStop.stopTime) * 1000;

        //let dt = arrivalTime - time;
        //dt = dt < 0 ? 2000 : dt;

        const tripTime = this.nextStop.stopTime - this.prevStop.stopTime;
        const travelTime = time - this.prevStop.stopTime;
        const r = travelTime / tripTime;
        const targetPos = prevVec.clone().addScaledVector(difference, r);

        const currPos = this.mesh.position.clone();

        if (currPos.equals(new THREE.Vector3())) {
            this.setPos(targetPos);
        } else {
            const posDiff = new THREE.Vector3().subVectors(targetPos, currPos);
            this.setPos(currPos.addScaledVector(posDiff, 1 / ms));
        }
        this.mesh.lookAt(nextVec);


        return;
    }
}

export default Train;
