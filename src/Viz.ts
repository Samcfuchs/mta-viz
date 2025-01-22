import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { Train, TrainProps } from './Train.ts';
import { getShapes, getStops, getRoutes, getStopTimes, StaticRoute } from './Static.ts';
import { DataChunk, pull } from './RealTime.ts';

const CENTER_LAT = 40.734789;
const CENTER_LON = -73.990568;
const CENTER = new THREE.Vector3(CENTER_LON, CENTER_LAT, 0)

let trains : Record<string, Train> = {};

function coordinateLL(lat:number, lon:number) {
    let v = new THREE.Vector3(lon, lat, 0).sub(CENTER);
    //console.log(v.toArray());
    return v
}

function putCube(pos:THREE.Vector3) : THREE.Mesh {
    const geometry = new THREE.BoxGeometry(.005,.005,.005);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(pos.x, pos.y, pos.z);
    return cube
}

function putSphere(pos:THREE.Vector3) : THREE.Mesh {
    const geometry = new THREE.SphereGeometry(.01);
    const material = new THREE.MeshNormalMaterial();
    const obj = new THREE.Mesh(geometry, material);
    obj.position.set(pos.x, pos.y, pos.z);
    return obj;
}

function putSurface(normal:THREE.Vector3) : THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(.1,.1)
    const material = new THREE.MeshNormalMaterial();
    //geometry.center();
    geometry.lookAt(normal.clone().add(new THREE.Vector3(0,0,1)));
    const plane = new THREE.Mesh(geometry, material);
    //plane.lookAt(normal.add(new THREE.Vector3(0,1,0)))
    plane.position.set(normal.x, normal.y, normal.z);

    return plane

}

export let stopCoords : Record<string, THREE.Vector3> = {};
let scene : THREE.Scene;
export let staticStopTimes : any;
export const createShadows = true;

export function initScene() {
    const mount = document.getElementById('renderWindow') as HTMLDivElement;

    scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = createShadows;
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    //labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
    labelRenderer.setSize( window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.001, 1000);

    camera.up.set(0,0,1);
    camera.position.set(0,-.1,.1);
    camera.lookAt(0,0,0);
    const controls = new MapControls(camera, renderer.domElement);
    //const controls = new MapControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * .48;
    controls.enableDamping = true;
    //controls.dampingFactor = .05;

    controls.update(.01);

    const light = new THREE.AmbientLight(0xffffff, .5);
    //scene.add(light);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0,1,1);
    dirLight.castShadow = createShadows;
    dirLight.shadow.radius = .01
    dirLight.shadow.mapSize.width = 1e7;
    dirLight.shadow.mapSize.height = 1e7;
    scene.add(dirLight);

    const ground = new THREE.PlaneGeometry(1,1);
    const groundMat = new THREE.MeshStandardMaterial({color: 0x2d3030});
    //const groundMat = new THREE.MeshStandardMaterial({color: 0xffffff});
    const groundMesh = new THREE.Mesh(ground, groundMat);
    groundMesh.position.set(0,0,-.001);
    groundMesh.lookAt(new THREE.Vector3(0,0,0));
    groundMesh.castShadow = createShadows;
    groundMesh.receiveShadow = createShadows;
    scene.add(groundMesh)

    let target = putCube(controls.target)
    //scene.add(target);

    let start : number;
    let prev : number;

    function animate(timestamp:number) {
        requestAnimationFrame(animate);

        if (start === undefined) { start = timestamp }
        const elapsed = timestamp - start;
        const dt = timestamp - prev

        let d = new Date();
        let t = d.getTime();
        //console.info(dt);
        let destination = stopCoords['L02']

        Object.entries(trains).map((kv,_) => {
            kv[1].update(dt, t); // All the trains get an animation update

            // Temporary debug behavior
            if (kv[1].mesh) {
                //kv[1].mesh.position.addScaledVector(new THREE.Vector3(0,0,1), .00001);
            }
        })

        controls.update(.01);
        //target.position.set(...controls.target.toArray())

        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);

        //this.mesh.position.addScaledVector(difference, ms/dt*1);

        prev = timestamp;
    }

    animate(.01);

};

/**
 * Add a 3D modeled stop to the current scene
 * @param row A row of data from stops.txt to generate a stop from
 * @returns void
 */
function addStop(row: any) {

    let v = coordinateLL(row['stop_lat'], row['stop_lon']);
    stopCoords[row['stop_id']] = v;

    if ((row['stop_id'].slice(-1) == 'N') || (row['stop_id'].slice(-1) == 'S')) return;
    //let geom = new THREE.CircleGeometry(.0004);
    let geom = new THREE.SphereGeometry(.0002);
    geom.lookAt(new THREE.Vector3(0, 0, 1));
    geom.translate(v.x, v.y, v.z)


    let material = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const stop = new THREE.Mesh(geom, material)

    scene.add(stop);

    const stopDiv = document.createElement('div');
    stopDiv.className = 'stopLabel';
    stopDiv.textContent = row.stop_id;
    stopDiv.style.backgroundColor = 'transparent';

    const stopLabel = new CSS2DObject(stopDiv);
    stopLabel.position.set(...v.toArray());
    stopLabel.center.set(0,4);
    stop.add(stopLabel);

    return stop;
}

/**
 * Draw 3D subway lines in scene
 * @param json Routes from static data
 */
function drawRoutes(json: Record<string, [number,number][]>, lineColors? : Record<string,string>) {
    console.log("Drawing lines");

    let lc = lineColors ? (route:string) => lineColors[route] : (route:string) => 'EEEEEE'

    Object.entries(json).forEach(([id, ll]) => {
        let v : THREE.Vector3[] = ll.map(xy => coordinateLL(...xy));
        let route: string = id.split('.')[0];
        const lineM = new LineMaterial({ color: `#${lc(route)}`, linewidth: 10 });
        try {
            const lineG = new LineGeometry().setFromPoints(v.filter(n => n));
            const line = new Line2(lineG, lineM);
            scene.add(line);
        } catch {
            console.warn("Failed to draw a line");
            console.log(id);
            console.log(v);
            console.log(v.filter(n => n));
        }
    })
}

export async function initData() {

    getStops()
        .then(json => json.forEach(addStop))
        //.then(_ => renderer.render(scene,camera));

    let lineColors: Record<string, string> = {};

    getRoutes()
        .then(json => {
            json.forEach((route: any) => lineColors[route['route_id']] = route['route_color'])
        }).then(() => getShapes()
                        .then(shapes => drawRoutes(shapes, lineColors))
                        .then(() => console.log("Routes loaded")));
    
    staticStopTimes = await getStopTimes();
    
    console.info("Static stop times: ");
    console.info(staticStopTimes);

    //window.setTimeout(() => {setData(pull(), staticStopTimes)}, 5000)
}

export function setData(realTimeData : Record<string, DataChunk>, stopTimes? : Record<string,StaticRoute>) {
    stopTimes = stopTimes ? stopTimes : staticStopTimes;
    if (!stopTimes) { console.error("Static stops not loaded"); return };

    console.info(`Initializing ${Object.keys(stopTimes).length} static routes 
        and ${Object.keys(realTimeData).length} live trains`);


    let nLive = 0, nTotal = 0;
    // All the static routes appear in the realtime data.
    
    Object.keys(realTimeData).forEach(key => {
        // rtd.tripID: "091200_L..N" (also the key)
        // staticData.key = "AFA24GEN-1038-Sunday-00_000600_1..S03R"

        nTotal++;
        let rtd = realTimeData[key];
        let staticData = Object.values(stopTimes).find((v,i,_) => v.longTripID.includes(rtd.tripID)) ??
                         Object.values(stopTimes).find((v,i,_) => v.longTripID.includes(rtd.shortTripID))
        
        if(!staticData) {
            // No match with static data
            console.warn(`No static data found for train ${key} w/ ${rtd.shortTripID}`)
            return;
        }

        let train : Train = trains[rtd.tripID]
        if (!train) {
            // Create one
            train = new Train(rtd.tripID)
            train.setData(rtd, staticData);

            if (rtd.hasVehicle) {
                train.createMesh();
                let pos = stopCoords[train.data.parentStopID!]
                train.setPos(pos);
                train.addToScene(scene);
            }

            trains[rtd.tripID] = train;
        }

        // could also add static data here
        train.setData(rtd, staticData);
        train.manageDataChange();

        nLive++;
    })
    console.log(`Matched ${nLive} / ${nTotal} real-time trains to static data`);

}

/*
export function update(data : Record<string, DataChunk>) {
    console.info(`Updating ${Object.keys(data).length} trains`);
    //console.info(data);
    //console.log(trains);
    Object.entries(data).forEach(kv => {
        let d : DataChunk = kv[1];
        let id = d.tripID;

        let train : Train = trains[id];
        if (!train) {
            // Then create one
            train = new Train(id);
            train.setData(d);

            if (d.hasVehicle) {
                train.createMesh()
                train.addToScene(scene);
            }
            trains[id] = train;
        }

        train.setData(d);
        if (d.hasVehicle && !train.mesh) {
            train.createMesh()
            train.addToScene(scene);
        }

        if (!d.hasVehicle && train.mesh) {
            train.deleteFromScene(scene)
        }

        if (d.hasVehicle) {
            let pos = stopCoords[train.data.parentStopID!]
            if (!pos) {
                console.warn(`Stop ${train.data.parentStopID}`)// has no coordinates but hasVehicle: ${d.hasVehicle}`)
                console.debug(train.data);
                //console.log(stopCoords);
                return
            } else {
                train.setPos(pos);
            }

        }

        
        let t = new Date().getTime();
        train.testArrivalTime = t + 3000
    })
}
*/
