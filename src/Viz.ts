import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { Train } from './Train.ts';
import { getShapes, getStops, getRoutes, getStopTimes, StaticRoute, } from './Static.ts';
import { DataChunk, pull } from './RealTime.ts';
import * as d3 from 'd3';

const CENTER_LAT = 40.734789;
const CENTER_LON = -73.990568;
//const CENTER = new THREE.Vector3(CENTER_LON, CENTER_LAT, 0)
const CENTER = new THREE.Vector2(CENTER_LON, CENTER_LAT)
export const COORD_SCALE = 1e3;

let trains : Record<string, Train> = {};

function coordinateLL(lat:number, lon:number) : THREE.Vector2 {
    let v = new THREE.Vector2(lon, lat).sub(CENTER);
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

export let stopCoords : Record<string, THREE.Vector2> = {};
let scene : THREE.Scene;
export let staticStopTimes : any;
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

        let d = new Date();
        let t = d.getTime();

        Object.entries(trains).map((kv,_) => { kv[1].update(dt, t); // All the trains get an animation update
        })

        d3.select('#clock').text(d.toLocaleTimeString('en-us'))

        controls.update(.01);
        //target.position.set(...controls.target.toArray())

        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);

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
    let geom = new THREE.SphereGeometry(.5);
    //geom.lookAt(new THREE.Vector3(0, 0, 1));
    geom.translate(v.x, v.y, -1);


    let material = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const stop = new THREE.Mesh(geom, material)

    scene.add(stop);

    const stopDiv = document.createElement('div');
    stopDiv.className = 'stopLabel';
    stopDiv.textContent = row.stop_id;
    stopDiv.style.backgroundColor = 'transparent';

    const stopLabel = new CSS2DObject(stopDiv);
    stopLabel.position.set(v.x, v.y, 0);
    stopLabel.center.set(0,4);
    stop.add(stopLabel);

    return stop;
}

let lineOffsets : Record<string, number> = {
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
let routeMap : Record<string, THREE.Vector2[]> = {}

/**
 * Draw 3D subway lines in scene
 * @param json Routes from static data
 */
function drawRoutes(json: Record<string, [number,number][]>, lineColors? : Record<string,string>, offset? : number) {
    offset = offset ?? .5;
    console.log("Drawing lines");

    let lc = lineColors ? (route:string) => lineColors[route] : (route:string) => 'EEEEEE'

    Object.entries(json).forEach(([id, ll]) => {
        let waypoints : THREE.Vector2[] = ll.map(xy => coordinateLL(...xy));
        let route: string = id.split('..')[0];
        let track: string = id.split('..')[1] ?? id.split('.')[1];
        //console.debug(id, track);
        offset = lineOffsets[route] ?? .5;
        const lineM = new LineMaterial({ color: `#${lc(route)}` , linewidth: .15, worldUnits: true });

        try {
            let linePoints : THREE.Vector2[] = []

            let a, b, c, bisector, v1, v2;

            // Add the origin
            b = waypoints[0].clone();
            c = waypoints[1].clone();

            v2 = c.clone().sub(b).normalize();
            bisector = new THREE.Vector2(v2.y, -v2.x);
            linePoints.push(b.addScaledVector(bisector, offset));

            for (let i=1; i<waypoints.length-1; i++) {
                b = waypoints[i].clone();
                a = waypoints[i-1].clone();
                c = waypoints[i+1].clone();

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
                    console.warn("Lat-Long are overlapping when drawing paths. This point will be omitted from the data: ", ll[i-1], ll[i], ll[i+1]);
                    continue;
                }

                if (bisector.length() < .98) {
                    console.error("Bisector fails", a, b, c, "vs", v1, v2, "Bisector: ", bisector)
                }
                /*
                scene.add(putSphere(new THREE.Vector3(b.x, b.y, 0),.001));
                scene.add(drawLine(b, new THREE.Vector2(b.x + bisector.x, b.y + bisector.y), handedness > 0 ? 0x00ff00 : 0xff0000));
                scene.add(drawLine(b, b.clone().addScaledVector(v1,0.015), 0x0000ff));
                scene.add(drawLine(b, b.clone().addScaledVector(v2,0.015), 0xff0000));
                */

                linePoints.push(b.addScaledVector(bisector, offset));
            }

            // Add terminal
            a  = waypoints[waypoints.length-2].clone();
            b = waypoints[waypoints.length-1].clone();
            v1 = a.clone().sub(b).normalize();
            bisector = new THREE.Vector2(-v1.y, v1.x);
            linePoints.push(b.addScaledVector(bisector, offset));
            linePoints = linePoints.filter(n => n); // Remove null points

            routeMap[id] = linePoints;
            
            const lineG = new LineGeometry().setFromPoints(linePoints.map(v => new THREE.Vector3(v.x, v.y, -1)));
            const line = new Line2(lineG, lineM);
            scene.add(line);
        } catch (e) {
            console.error(e);
            console.error(`Failed to draw line ${id}: ${waypoints}`);
            //console.log(waypoints.filter(n => n));
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
                        //.then(shapes => {return {'A..N04R': shapes['A..N04R'] }}) // Reduce to one route
                        .then(shapes => drawRoutes(shapes, lineColors))
                        .then(() => console.log("Routes loaded")));
    
    staticStopTimes = await getStopTimes();
    
    console.info("Static stop times: ");
    console.info(staticStopTimes);

    console.debug("Processed routes: ", routeMap);

    //window.setTimeout(() => {setData(pull(), staticStopTimes)}, 5000)
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
        let rtd = realTimeData[key];

        // Trains with no stop times are probably at the end of their routes and won't be included
        // TODO check this against static data?
        if (!rtd.stopTimes[0][0]) {
            if (trains[rtd.tripID]) {
                trains[rtd.tripID]?.deleteFromScene(scene);
                delete trains[rtd.tripID]
            }
            return;
        }

        let staticData = Object.values(stopTimes).find((v,i,_) => v.longTripID.includes(rtd.tripID)) ??
                         Object.values(stopTimes).filter((v,i,_) => v.longTripID.includes(rtd.shortTripID))
                            /*  */.find(route => {
                                let firstRTstop = rtd.stopTimes[0][0].stopID;
                                let static_stops = route.stops.map(s => s.stopID);
                                return static_stops.includes(firstRTstop);
                            }) 
                         ?? Object.values(stopTimes).find((v,i,_) => v.stops.map(s=>s).map(s => s.stopID).includes(rtd.parentStopID!))
                         ?? undefined;
        
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

    Object.keys(trains).forEach(key => {
        let t : Train = trains[key];

        if (!t.nextStop) {
           t.deleteFromScene(scene); 
           delete trains[key]
        } 
    })
    console.info(`Matched ${nLive} / ${nTotal} real-time trains to static data`);

}
