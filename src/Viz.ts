import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { Train } from './Train.ts';
import { getShapes, getStops, getRoutes, getStopTimes, StaticRoute, getShapesAsShapes, } from './Static.ts';
import { DataChunk } from './RealTime.ts';
import * as d3 from 'd3';
import { StopInfo, Track } from './Track.ts';

const CENTER_LAT = 40.734789;
const CENTER_LON = -73.990568;
//const CENTER = new THREE.Vector3(CENTER_LON, CENTER_LAT, 0)
const CENTER = new THREE.Vector2(CENTER_LON, CENTER_LAT)
export const COORD_SCALE = 1e3;

const trains : Record<string, Train> = {};

export function coordinateLL(lat:number, lon:number) : THREE.Vector2 {
    const v = new THREE.Vector2(lon, lat).sub(CENTER);
    v.multiplyScalar(COORD_SCALE);
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

function putSphere(pos:THREE.Vector3, size? : number) : THREE.Mesh {
    const geometry = new THREE.SphereGeometry(size ?? 1);
    const material = new THREE.MeshNormalMaterial();
    const obj = new THREE.Mesh(geometry, material);
    obj.position.set(pos.x, pos.y, pos.z);
    return obj;
}

function drawLine(a : THREE.Vector2, b : THREE.Vector2, color? : any) {
    const geometry = new THREE.BufferGeometry().setFromPoints([a,b])
    const material = new THREE.LineBasicMaterial({ color: color ?? 0xffffff })
    const obj = new THREE.Line(geometry, material);
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

export const stopCoords : Record<string, THREE.Vector2> = {};
export let stopInfos : Record<string, StopInfo> = {};
let scene : THREE.Scene;
export let staticStopTimes : Record<string, StaticRoute>;
export const createShadows = true;
export const dataPanel = document.getElementById('dataView');
export const dataHover = document.getElementById('hover');
let renderer : THREE.WebGLRenderer;
let camera : THREE.PerspectiveCamera;

export function initScene() {
    const mount = document.getElementById('renderWindow') as HTMLDivElement;

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = createShadows;
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    //labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
    labelRenderer.setSize( window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);

    camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.001, 1000);

    camera.up.set(0,0,1);
    camera.position.set(0,-10,10);
    camera.lookAt(0,0,0);
    const controls = new MapControls(camera, renderer.domElement);
    //const controls = new MapControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * .43;
    controls.enableDamping = true;
    //controls.maxZoom = 1;
    //controls.minZoom = 0;
    controls.maxDistance = 100;
    controls.minDistance = 5;
    //controls.dampingFactor = .05;

    controls.update(.01);

    const light = new THREE.AmbientLight(0xffffff, .5);
    scene.add(light);

    const dirLight = new THREE.DirectionalLight(0xffffff, 4);
    dirLight.position.set(0,100,100);
    dirLight.castShadow = createShadows;
    dirLight.shadow.radius = 2;

    const shadowRes = 4096;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;

    const shadowBounds = 200;
    dirLight.shadow.camera.top = shadowBounds;
    dirLight.shadow.camera.bottom = -shadowBounds;
    dirLight.shadow.camera.right = shadowBounds;
    dirLight.shadow.camera.left = -shadowBounds;
    scene.add(dirLight);

    const ground = new THREE.PlaneGeometry(COORD_SCALE,COORD_SCALE);
    const groundMat = new THREE.MeshStandardMaterial({color: 0x2d3030});
    //const groundMat = new THREE.MeshStandardMaterial({color: 0xffffff});
    const groundMesh = new THREE.Mesh(ground, groundMat);
    groundMesh.position.set(0,0,-2);
    groundMesh.lookAt(new THREE.Vector3(0,0,0));
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = createShadows;
    scene.add(groundMesh)

    window.addEventListener('resize', onWindowResize, false);
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.render(scene, camera);

        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.render(scene,camera)
    }

    const mouse = new THREE.Vector2;
    const raycaster = new THREE.Raycaster()
    let intersects: THREE.Intersection[];
    let intersectedObject : THREE.Object3D | null;

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    function onDocumentMouseMove(event: MouseEvent) {
        mouse.set(
            (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
            -((event.clientY / renderer.domElement.clientHeight) * 2 - 1)
        );

        raycaster.setFromCamera(mouse, camera);
        intersects = raycaster.intersectObjects(Object.keys(trains).map(t => trains[t].mesh).filter(t=>t))

        if (intersects.length > 0) {
            intersectedObject = intersects[0].object

            dataHover!.style.left = `${event.clientX}px`;
            dataHover!.style.top = `${event.clientY}px`;
            dataHover!.style.display = 'block';
        } else {
            intersectedObject = null;
            dataPanel!.textContent = "";
            dataHover!.textContent = "";
            dataHover!.style.display = 'none';
        }

        //console.log(intersectedObject?.name);
        Object.keys(trains).forEach(tripid => {
            if (intersectedObject && tripid == intersectedObject.name) {
                trains[tripid].highlight(true);
            } else {
                trains[tripid].highlight(false);
            }
        })
            
    }

    let start : number;
    let prev : number;

    function animate(timestamp?:number) {
        timestamp = timestamp ?? new Date().getTime();
        requestAnimationFrame(animate);

        if (start === undefined) { start = timestamp }
        const elapsed = timestamp - start;
        const dt = timestamp - prev

        const d = new Date();
        const t = d.getTime();
        //console.log(dt);

        //Object.entries(trains).map((kv,_) => { kv[1].update(dt, t); })

        d3.select('#clock').text(d.toLocaleTimeString('en-us'))

        controls.update(.01);
        //target.position.set(...controls.target.toArray())

        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);

        prev = timestamp;
    }

    animate(.01);

};

const routeMap : Record<string, THREE.Vector2[]> = {}


const allTracks : Record<string, Track> = {}
export async function initDataTracks() {
    const shapes = await getShapesAsShapes();
    staticStopTimes = await getStopTimes();
    //let stops = await getStops();
    stopInfos = await getStops();

    const lineColors: Record<string, string> = {};
    const routes = await getRoutes();

    routes.forEach(route => lineColors[route['route_id']] = route['route_color'])
    //console.info("LC:", lineColors)

    for (const route_id in shapes) {
        const staticRouteData = Object.values(staticStopTimes).find(r => r.routeID == route_id)
        const route: string = route_id.split('..')[0];

        if (!staticRouteData) {
            console.error("Couldn't find a static route for routeID: ", route_id);
            continue
        }

        const t : Track = new Track(shapes[route_id], staticRouteData, stopInfos, undefined, `#${lineColors[route]}`);
        t.drawMap(scene);

        allTracks[route_id] = t;
    }
    console.info("Loaded tracks")
}

export async function setData(realTimeData : Record<string, DataChunk>, stopTimes? : Record<string,StaticRoute>) {
    stopTimes = stopTimes ?? staticStopTimes;
    if (!stopTimes) { console.error("Static stops not loaded"); return };

    console.info(`Initializing ${Object.keys(stopTimes).length} static routes 
        and ${Object.keys(realTimeData).length} live trains`);


    let nLive = 0, nTotal = 0;
    // All the static routes appear in the realtime data.
    
    Object.keys(realTimeData).forEach(key => {
        // rtd.tripID: "091200_L..N" (also the key)
        // staticData.key = "AFA24GEN-1038-Sunday-00_000600_1..S03R"

        nTotal++;
        const rtd = realTimeData[key];

        // Trains with no stop times are probably at the end of their routes and won't be included
        // TODO check this against static data?
        if (!rtd.stopTimes[0][0]) {
            if (trains[rtd.tripID]) {
                trains[rtd.tripID]?.deleteFromScene(scene);
                delete trains[rtd.tripID]
            }
            return;
        }


        let train : Train = trains[rtd.tripID]
        if (!train) {
            const staticData = Object.values(stopTimes).find((v,i,_) => v.longTripID.includes(rtd.tripID)) ??
                            Object.values(stopTimes).filter((v,i,_) => v.longTripID.includes(rtd.shortTripID))
                                /*  */.find(route => {
                                    const firstRTstop = rtd.stopTimes[0][0].stopID;
                                    const static_stops = route.stops.map(s => s.stopID);
                                    return static_stops.includes(firstRTstop);
                                }) 
                            ?? Object.values(stopTimes).find((v,i,_) => v.stops.map(s=>s).map(s => s.stopID).includes(rtd.parentStopID!))
                            ?? undefined;
            
            if(!staticData) {
                // No match with static data
                console.warn(`No static data found for train ${key} w/ ${rtd.shortTripID}`)
                return;
            }
            // Create one
            train = new Train(rtd.tripID)
            train.setData(rtd, staticData);
            train.track = allTracks[rtd.tripID.split('_')[1]];

            if (rtd.hasVehicle) {
                train.createMesh();
                const pos = stopCoords[train.data.parentStopID!]
                //console.debug(pos)
                //console.debug(train.data.parentStopID);
                train.setPos(pos);
                train.addToScene(scene);
            }

            trains[rtd.tripID] = train;
        }

        // could also add static data here
        train.setData(rtd);
        train.manageDataChange();

        nLive++;
    })

    /*
    Object.keys(trains).forEach(key => {
        let t : Train = trains[key];

        if (!t.nextStop) {
           t.deleteFromScene(scene); 
           delete trains[key]
        } 
    })
    */
    console.info(`Matched ${nLive} / ${nTotal} real-time trains to static data`);
    console.info("Trains created:", trains)

}
