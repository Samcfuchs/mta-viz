import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/Addons.js';
import { Train, TrainProps } from './Train.ts';

const CENTER_LAT = 40.734789;
const CENTER_LON = -73.990568;
const CENTER = new THREE.Vector3(CENTER_LON, CENTER_LAT, 0)

let trains : Record<string, Train> = {};

function parseShapesToJSON(text: string) {
    const data_obj: Record<string, THREE.Vector3[]> = {}

    text.split('\n').slice(1, -1).forEach((row) => {
        let items: Array<string> = row.split(',')
        if (!items.length) return;

        // create slot if nexists
        if (!(items[0] in data_obj)) { data_obj[items[0]] = [] }

        //data_obj[items[0]][Number(items[1])] = new THREE.Vector3(Number(items[2]), 0, Number(items[3]));
        //let v = new THREE.Vector3()
        let v = coordinateLL(Number(items[2]), Number(items[3]))
        data_obj[items[0]][Number(items[1])] = v;
    })

    return data_obj;
}

function coordinate(v:THREE.Vector3) {
    v.sub(CENTER);
}

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

let stopCoords : Record<string, THREE.Vector3> = {};
let scene : THREE.Scene;

export function init() {
    const mount = document.getElementById('renderWindow') as HTMLDivElement;

    scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    //labelRenderer.setSize(mount.clientWidth, mount.clientHeight);
    labelRenderer.setSize( window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);


    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.001, 1000);

    console.log(camera.position.toArray());

    camera.up.set(0,0,1);
    camera.position.set(0,-1,1);
    camera.lookAt(0,0,0);
    const controls = new MapControls(camera, renderer.domElement);
    //const controls = new MapControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * .48;
    controls.enableDamping = true;
    //controls.dampingFactor = .05;

    controls.update(.01);


    let origin = new THREE.Vector3()
    let target = putCube(controls.target)
    scene.add(target);
    /*
    scene.add(putCube(origin.clone().add(new THREE.Vector3(0,.02,0))));
    scene.add(putCube(origin.clone().add(new THREE.Vector3(.02,0,0))));
    scene.add(putCube(origin.clone().add(new THREE.Vector3(0,0,.02))));
    //scene.add(putSurface(controls.target));

    scene.add(putSurface(origin.clone().add(new THREE.Vector3(0,0,-.02))));
    */


    function addStop(row: any) {

        let v = coordinateLL(row['stop_lat'], row['stop_lon']);
        stopCoords[row['stop_id']] = v;

        if ((row['stop_id'].slice(-1) == 'N') || (row['stop_id'].slice(-1) == 'S')) return;
        //let geom = new THREE.CircleGeometry(.0004);
        let geom = new THREE.SphereGeometry(.0004);
        geom.lookAt(new THREE.Vector3(0, 0, 1));
        //geom.translate(row['stop_lat'], .0001, row['stop_lon']);
        //geom.translate(row['stop_lon'], .0001, row['stop_lat']);
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
        stopLabel.center.set(0,2);
        stop.add(stopLabel);

        return stop;
    }

    function drawLines(json: Record<string, THREE.Vector3[]>) {
        console.log("Drawing lines");

        Object.entries(json).forEach(([id, v]) => {
            let route: string = id.split('.')[0];
            const lineM = new LineMaterial({ color: `#${lineColors[route]}`, linewidth: 10 });
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

    let geometry = new THREE.ConeGeometry(.001, .002);

    geometry.translate(0,0,.005);
    //geometry.center();
    //geometry.lookAt(new THREE.Vector3(0,-1,0));
    let material = new THREE.MeshNormalMaterial();
    let obj = new THREE.Mesh(geometry, material);

    scene.add(obj);

    fetch('http://localhost:3000/shapes.txt')
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch shapes");
            return response.text();
        })
        .then(parseShapesToJSON)
        .then(drawLines)
        .then(() => console.log("Lines loaded"));


    fetch('http://localhost:3000/stops')
        .then(response => response.json())
        //.then(json => { console.log(json); return json; })
        .then(json => json.forEach(addStop))
        .then(_ => renderer.render(scene, camera));

    let lineColors: Record<string, string> = {};

    fetch('http://localhost:3000/routes.json')
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch routes");
            return response.json();
        })
        .then(json => {
            json.forEach((route: any) => lineColors[route['route_id']] = route['route_color'])
        });
    
    

    function animate() {
        let d = new Date();
        let t = d.getTime();

        //obj.position.add(new THREE.Vector3(0,0,0.0001 * Math.sin(t/100)));
        //obj.rotateOnAxis(new THREE.Vector3(0,0,1), .005)

        Object.entries(trains).forEach(([_,train]) => train.update(t));
        /*
        try {
            trains["039200_2..S05R"].update(t);
        } catch {
        }
        */



        requestAnimationFrame(animate);
        controls.update(.01);
        target.position.set(...controls.target.toArray())

        // cameraPosition.current = {
        //     x: camera.position.x,
        //     y: camera.position.y,
        //     z: camera.position.z
        // };

        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    }

    animate();

};

export function update(data : TrainProps[]) {
    console.info(`Updating ${data.length} trains`);
    console.log(trains);
    data.forEach((t) => {
        if (!t.tripId) return;

        let train : Train = trains[t.tripId]
        if (!train) {
            //console.log("New")
            train = new Train(t);
            trains[t.tripId] = train;
            train.add_to_scene(scene);
        }

        
        let pos = stopCoords[t.parentStop!];
        if (!pos) {
            console.warn(`Stop ${t.parentStop} has no coordinates`)
            console.log(t.parentStop);
            console.log(stopCoords);
            return
        };
        train.set_pos(pos);


        //cube.position.set(pos.x, pos.y, pos.z);
        
    })
}