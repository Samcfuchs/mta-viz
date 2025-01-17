import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

export function Cube() {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current! as HTMLDivElement;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(mount.clientWidth, mount.clientHeight);

        mount.appendChild(renderer.domElement);

        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0xeeeeee })
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        camera.position.z = 5;

        function animate() {
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }

        animate();

        return () => {
            mount.removeChild(renderer.domElement);
        }

    })

    return (
        <div
            ref={mountRef}
            className='renderWindow'
        ></div>
    )
}

export function Lines() {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current! as HTMLDivElement;
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(mount.clientWidth, mount.clientHeight);

        mount.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 1, 500);
        camera.position.set(0,0,100);
        camera.lookAt(0,0,0);

        const scene = new THREE.Scene()

        //const lineMaterial = new THREE.LineBasicMaterial( { color: 0xff6319, linewidth: 10, linejoin: 'round'} )
        const lineMaterial = new LineMaterial( { color: 0xff6319, linewidth: 10} )

        const points = [];
        points.push( new THREE.Vector3( - 10, 0, 0 ) );
        points.push( new THREE.Vector3( 0, 10, 0 ) );
        points.push( new THREE.Vector3( 10, 0, 0 ) );

        //const geometry = new THREE.BufferGeometry().setFromPoints( points );
        const geometry = new LineGeometry().setFromPoints(points);

        //const line = new THREE.Line(geometry, lineMaterial)
        const line = new Line2(geometry, lineMaterial)

        scene.add(line);

        const circleG = new THREE.CircleGeometry(5, 32);
        circleG.translate(-10, 0, 0)
        const basicM = new THREE.MeshBasicMaterial({ color: 0xff6319 });

        const circle = new THREE.Mesh(circleG, basicM);
        scene.add(circle);

        renderer.render(scene,camera);
        return () => {
            mount.removeChild(renderer.domElement);
        }
        
    });

    return (
        <div
            ref={mountRef}
            className='renderWindow'
        ></div>
    )
}

export default Cube;