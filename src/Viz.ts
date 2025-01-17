import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';


const CENTER_LAT = 40.734789;
const CENTER_LON = -73.990568;

function parseShapesToJSON(text: string) {
    const data_obj: Record<string, THREE.Vector3[]> = {}

    text.split('\n').slice(1, -1).forEach((row) => {
        let items: Array<string> = row.split(',')
        if (!items.length) return;

        // create slot if nexists
        if (!(items[0] in data_obj)) { data_obj[items[0]] = [] }

        //data_obj[items[0]][Number(items[1])] = new THREE.Vector3(Number(items[2]), 0, Number(items[3]));
        data_obj[items[0]][Number(items[1])] = new THREE.Vector3(Number(items[3]), 0, Number(items[2]));
    })

    return data_obj;
}

export function init() {
    const mount = document.getElementById('renderWindow') as HTMLDivElement;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(20, mount.clientWidth / mount.clientHeight, 0.001, 1000);

    const controls = new MapControls(camera, renderer.domElement);
    camera.position.set(CENTER_LON, 1, CENTER_LAT);
    camera.lookAt(CENTER_LON, 0, CENTER_LAT);

    controls.target = new THREE.Vector3(CENTER_LON, 0, CENTER_LAT);
    controls.maxPolarAngle = Math.PI * .45;
    controls.enableDamping = true;
    controls.dampingFactor = .05;

    controls.update();


    function addStop(row: any) {
        let geom = new THREE.CircleGeometry(.0004);
        geom.lookAt(new THREE.Vector3(0, 1, 0));
        //geom.translate(row['stop_lat'], .0001, row['stop_lon']);
        geom.translate(row['stop_lon'], .0001, row['stop_lat']);
        let material = new THREE.MeshBasicMaterial({ color: 0xffffff })

        scene.add(new THREE.Mesh(geom, material));
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
                console.log(id);
                console.log(v);
                console.log(v.filter(n => n));
            }
        })
    }

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
        })
    

    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        // cameraPosition.current = {
        //     x: camera.position.x,
        //     y: camera.position.y,
        //     z: camera.position.z
        // };

        renderer.render(scene, camera);
    }

    animate();

};